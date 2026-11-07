"""
recommendations.py - rule-based personalised recommendation engine (Phase 3 of the notebook).

This file was extracted from the final notebook (Section 11). It uses the Python standard library only and is
completely independent of the machine-learning classifier: the classifier predicts Low/Medium/High, while this
engine reads the user's actual lifestyle answers and applies 12 hand-written rules.

Main function:  generate_recommendations(user_profile)  ->  dict (JSON-ready)

The suggestions are general ideas. They do not guarantee a higher rating or any measured environmental improvement,
and nothing here calculates carbon emissions.
"""
# Constants and input validation. Standard library only.
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

# Exact category names, typed from the dataset inspection above (tests/test_backend.py checks they still match the CSV).
VALID_CATEGORIES: Dict[str, List[str]] = {
    "Location":             ["Urban", "Suburban", "Rural"],
    "DietType":             ["Mostly Plant-Based", "Balanced", "Mostly Animal-Based"],
    "LocalFoodFrequency":   ["Always", "Often", "Sometimes", "Rarely"],
    "TransportationMode":   ["Car", "Public Transit", "Bike", "Walk"],
    "EnergySource":         ["Renewable", "Mixed", "Non-Renewable"],
    "HomeType":             ["House", "Apartment", "Other"],
    "ClothingFrequency":    ["Rarely", "Sometimes", "Often", "Always"],
    "CommunityInvolvement": ["None", "Low", "Moderate", "High"],
    "UsingPlasticProducts": ["Never", "Rarely", "Sometimes", "Often"],
    "DisposalMethods":      ["Landfill", "Recycling", "Composting", "Combination"],
    "PhysicalActivities":   ["None", "Low", "Moderate", "High"],
}
# Numeric fields: (minimum, maximum). None = no upper limit.
NUMERIC_RANGES: Dict[str, Tuple[float, Optional[float]]] = {
    "Age": (0, 120), "HomeSize": (1, None), "EnvironmentalAwareness": (1, 5),
    "MonthlyElectricityConsumption": (0, None), "MonthlyWaterConsumption": (0, None),
}
REQUIRED_FIELDS: List[str] = list(VALID_CATEGORIES) + list(NUMERIC_RANGES) + ["SustainableBrands"]   # the 17 lifestyle inputs
PRIORITY_RANK = {"High": 0, "Medium": 1, "Low": 2}
DISCLAIMER = ("These are general, rule-based ideas based only on the answers provided. They are not a carbon calculation "
              "and do not guarantee a higher rating or any measured environmental improvement. Electricity and water "
              "comparisons are against the participants in this dataset, not universal standards.")


def validate_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Check a lifestyle profile and return a cleaned COPY. Raises ValueError listing every problem found.
    Extra keys (e.g. Gender, ParticipantID, Rating) are ignored."""
    problems, clean = [], {}
    for field in REQUIRED_FIELDS:
        if field not in profile or profile[field] is None:
            problems.append(f"missing field '{field}'")
            continue
        value = profile[field]
        if field in VALID_CATEGORIES:
            if value not in VALID_CATEGORIES[field]:
                problems.append(f"{field}: '{value}' is not one of {VALID_CATEGORIES[field]}")
            else:
                clean[field] = value
        elif field == "SustainableBrands":
            if isinstance(value, bool):
                clean[field] = value
            elif isinstance(value, str) and value.strip().lower() in ("true", "false"):
                clean[field] = value.strip().lower() == "true"
            else:
                problems.append(f"SustainableBrands: '{value}' must be True or False")
        else:   # numeric
            low, high = NUMERIC_RANGES[field]
            try:
                number = float(value)
            except (TypeError, ValueError):
                problems.append(f"{field}: '{value}' is not a number")
                continue
            if number < low or (high is not None and number > high):
                problems.append(f"{field}: {number:g} is outside the allowed range ({low} to {high if high is not None else 'no limit'})")
            else:
                clean[field] = number
    if problems:
        raise ValueError("Invalid lifestyle profile: " + "; ".join(problems))
    return clean


def _percentile(values: List[float], q: float) -> float:
    """Percentile with linear interpolation (same method as pandas/numpy default)."""
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def compute_thresholds(electricity_values: List[float], water_values: List[float]) -> Dict[str, float]:
    """Median and 75th percentile of the dataset's consumption columns (comparison against THIS dataset only)."""
    return {"electricity_median": _percentile(electricity_values, 0.5), "electricity_p75": _percentile(electricity_values, 0.75),
            "water_median": _percentile(water_values, 0.5), "water_p75": _percentile(water_values, 0.75)}

# Data containers and one rule function per topic.

@dataclass
class Recommendation:
    rule_id: str        # which rule produced it (useful for tests)
    feature: str        # the lifestyle feature it is about
    category: str       # topic, e.g. "Transportation"
    title: str
    description: str    # actionable suggestion
    priority: str       # "High" | "Medium" | "Low"
    triggered_by: str   # the lifestyle response that triggered it


@dataclass
class Strength:
    rule_id: str
    feature: str
    title: str
    message: str
    triggered_by: str


def _rec(rule_id, feature, category, title, description, priority, triggered_by):
    return ("rec", Recommendation(rule_id, feature, category, title, description, priority, triggered_by))

def _strength(rule_id, feature, title, message, triggered_by):
    return ("strength", Strength(rule_id, feature, title, message, triggered_by))


# ---- Each rule takes (profile, thresholds) and returns ("rec", ...), ("strength", ...) or None ----

def rule_transport(p, t):
    mode = p["TransportationMode"]
    if mode == "Car":
        if p["Location"] == "Rural":     # public transit and cycling are often less practical in rural areas
            return _rec("transport", "TransportationMode", "Transportation", "Share and combine your car trips",
                        "Public transport can be limited in rural areas, so try combining errands into one trip, "
                        "carpooling with neighbours or colleagues, and walking or cycling for short local journeys where practical.",
                        "Medium", "TransportationMode = Car (Location = Rural)")
        return _rec("transport", "TransportationMode", "Transportation", "Replace some car trips with public transit, cycling or walking",
                    "Pick one regular trip (for example commuting or shopping) and try public transit, a bike or walking for it. "
                    "For trips that still need a car, carpooling can help.",
                    "High", f"TransportationMode = Car (Location = {p['Location']})")
    return _strength("transport", "TransportationMode", f"Getting around by {mode.lower()}",
                     f"Using {mode.lower()} instead of driving alone is usually a lower-emission way to travel. Keep it up.",
                     f"TransportationMode = {mode}")


def rule_energy(p, t):
    src = p["EnergySource"]
    if src == "Renewable":
        return _strength("energy", "EnergySource", "Renewable household energy",
                         "Powering your home with renewable energy is one of the more impactful habits. Keep it up.", "EnergySource = Renewable")
    if p["HomeType"] == "House":
        how = ("Ask your electricity provider about a renewable or 'green' plan, and look into rooftop or community solar "
               "options if they are available where you live.")
    else:
        how = ("Ask your electricity provider about a renewable or 'green' plan, and if you rent, ask your landlord or "
               "building manager about renewable options for the building.")
    if src == "Non-Renewable":
        return _rec("energy", "EnergySource", "Household energy", "Start moving your home towards renewable energy", how,
                    "High", "EnergySource = Non-Renewable")
    return _rec("energy", "EnergySource", "Household energy", "Increase the renewable share of your home energy", how,
                "Medium", "EnergySource = Mixed")


def rule_waste(p, t):
    d = p["DisposalMethods"]
    compost_how = ("a backyard compost bin" if p["HomeType"] == "House"
                   else "a community or municipal food-waste collection, or a small countertop bin, if available")
    if d == "Landfill":
        return _rec("waste", "DisposalMethods", "Waste", "Start separating recyclables and food scraps",
                    f"Set up a separate bin for paper, glass, metal and plastics your local service accepts, and consider composting food scraps using {compost_how}.",
                    "High", "DisposalMethods = Landfill")
    if d == "Recycling":
        return _rec("waste", "DisposalMethods", "Waste", "Add food-scrap composting to your recycling habit",
                    f"Recycling is a good habit. A next step is composting food scraps, for example using {compost_how}.",
                    "Low", "DisposalMethods = Recycling")
    if d == "Composting":
        return _rec("waste", "DisposalMethods", "Waste", "Add dry-recyclables sorting to your composting habit",
                    "Composting is a good habit. A next step is to also sort paper, glass, metal and plastics your local service accepts into recycling.",
                    "Low", "DisposalMethods = Composting")
    return _strength("waste", "DisposalMethods", "Combining recycling and composting",
                     "Using a combination of disposal methods is a strong waste habit. Keep it up.", "DisposalMethods = Combination")


def rule_plastic(p, t):
    use = p["UsingPlasticProducts"]
    tip = "Carry a reusable bottle, bag and food container, and choose loose or refillable options where you can."
    if use == "Often":
        return _rec("plastic", "UsingPlasticProducts", "Single-use plastic", "Cut back on single-use plastic", tip,
                    "High", "UsingPlasticProducts = Often")
    if use == "Sometimes":
        return _rec("plastic", "UsingPlasticProducts", "Single-use plastic", "Reduce occasional single-use plastic", tip,
                    "Medium", "UsingPlasticProducts = Sometimes")
    return _strength("plastic", "UsingPlasticProducts", "Very low plastic use",
                     f"You report {use.lower()} using plastic products, which is already a strong habit. Keep it up.",
                     f"UsingPlasticProducts = {use}")


def rule_electricity(p, t):
    v = p["MonthlyElectricityConsumption"]
    if v > t["electricity_p75"]:
        return _rec("electricity", "MonthlyElectricityConsumption", "Electricity use", "Look for ways to use less electricity",
                    "Switch to LED bulbs, unplug or switch off devices on standby, use efficient appliances, and avoid running "
                    "heating or cooling when rooms are empty. Even with renewable supply, using less energy is a good habit.",
                    "Medium", f"MonthlyElectricityConsumption = {v:g} kWh (above this dataset's 75th percentile, {t['electricity_p75']:g} kWh)")
    if v <= t["electricity_median"]:
        return _strength("electricity", "MonthlyElectricityConsumption", "Lower electricity use",
                         "Your electricity use is at or below the median of this dataset's participants. Keep it up.",
                         f"MonthlyElectricityConsumption = {v:g} kWh (at or below this dataset's median, {t['electricity_median']:g} kWh)")
    return None


def rule_water(p, t):
    v = p["MonthlyWaterConsumption"]
    if v > t["water_p75"]:
        return _rec("water", "MonthlyWaterConsumption", "Water use", "Look for ways to use less water",
                    "Fix dripping taps and leaks, take shorter showers, run dishwashers and washing machines only with full loads, "
                    "and reuse water for plants where practical.",
                    "Medium", f"MonthlyWaterConsumption = {v:g} litres (above this dataset's 75th percentile, {t['water_p75']:g} litres)")
    if v <= t["water_median"]:
        return _strength("water", "MonthlyWaterConsumption", "Lower water use",
                         "Your water use is at or below the median of this dataset's participants. Keep it up.",
                         f"MonthlyWaterConsumption = {v:g} litres (at or below this dataset's median, {t['water_median']:g} litres)")
    return None


def rule_diet(p, t):
    d = p["DietType"]
    if d == "Mostly Animal-Based":
        return _rec("diet", "DietType", "Food", "Add more plant-based meals",
                    "Try a few meat-free meals each week, such as bean, lentil or vegetable-based dishes, while keeping your meals balanced.",
                    "Medium", "DietType = Mostly Animal-Based")
    if d == "Balanced":
        return _rec("diet", "DietType", "Food", "Try a few more plant-based meals",
                    "You already eat a balanced diet. If you like, swap one or two more meals a week for plant-based options.",
                    "Low", "DietType = Balanced")
    return _strength("diet", "DietType", "Mostly plant-based diet",
                     "A mostly plant-based diet is generally associated with lower food-related emissions. Keep it up.", "DietType = Mostly Plant-Based")


def rule_local_food(p, t):
    f = p["LocalFoodFrequency"]
    if f == "Rarely":
        return _rec("local_food", "LocalFoodFrequency", "Food", "Buy more local and seasonal food",
                    "Try a farmers' market or a local produce box, and choose seasonal fruit and vegetables when you shop.",
                    "Medium", "LocalFoodFrequency = Rarely")
    if f == "Sometimes":
        return _rec("local_food", "LocalFoodFrequency", "Food", "Make local food a little more regular",
                    "Pick one or two staple items each week to buy from local producers or markets.",
                    "Low", "LocalFoodFrequency = Sometimes")
    return _strength("local_food", "LocalFoodFrequency", "Buying local food",
                     f"You buy local food {f.lower()}, which supports local producers and often means less transport. Keep it up.",
                     f"LocalFoodFrequency = {f}")


def rule_clothing(p, t):
    c = p["ClothingFrequency"]
    tip = "Buy only what you need, choose second-hand or swap clothes with friends, and repair or re-wear items before replacing them."
    if c == "Always":
        return _rec("clothing", "ClothingFrequency", "Clothing", "Buy fewer new clothes", tip, "Medium", "ClothingFrequency = Always")
    if c == "Often":
        return _rec("clothing", "ClothingFrequency", "Clothing", "Buy fewer new clothes", tip, "Low", "ClothingFrequency = Often")
    if c == "Rarely":
        return _strength("clothing", "ClothingFrequency", "Low clothing consumption",
                         "Buying clothes rarely keeps clothing-related waste low. Keep it up.", "ClothingFrequency = Rarely")
    return None


def rule_brands(p, t):
    if p["SustainableBrands"]:
        return _strength("brands", "SustainableBrands", "Choosing sustainable brands",
                         "Choosing sustainable brands is a good habit. Keep it up.", "SustainableBrands = True")
    if p["ClothingFrequency"] == "Rarely":      # they rarely buy clothes, so this advice is less relevant
        return None
    return _rec("brands", "SustainableBrands", "Shopping", "Check for credible sustainability labels",
                "When you buy clothes or everyday products, look for recognised certifications, repairable products and second-hand options.",
                "Low", "SustainableBrands = False")


def rule_community(p, t):
    c = p["CommunityInvolvement"]
    if c == "None":
        return _rec("community", "CommunityInvolvement", "Community", "Join a local environmental activity",
                    "Try a neighbourhood clean-up, community garden or repair cafe. Small group actions are an easy way to start.",
                    "Low", "CommunityInvolvement = None")
    if c == "High":
        return _strength("community", "CommunityInvolvement", "Active in your community",
                         "High community involvement helps spread good habits to others. Keep it up.", "CommunityInvolvement = High")
    return None


def rule_awareness(p, t):
    a = p["EnvironmentalAwareness"]
    if a <= 2:
        return _rec("awareness", "EnvironmentalAwareness", "Learning", "Learn which actions matter most where you live",
                    "Look up your local recycling rules and energy options, and explore a trusted household-footprint guide to find easy first steps.",
                    "Low", f"EnvironmentalAwareness = {a:g} (self-rated, 1-5)")
    if a >= 4:
        return _strength("awareness", "EnvironmentalAwareness", "Good environmental awareness",
                         "You rate your environmental awareness highly, which is a good base for sharing tips with others.",
                         f"EnvironmentalAwareness = {a:g} (self-rated, 1-5)")
    return None


# Order = general relevance order; it is also the tie-breaker between suggestions of the same priority.
RULES = [rule_transport, rule_energy, rule_waste, rule_plastic, rule_electricity, rule_water,
         rule_diet, rule_local_food, rule_clothing, rule_brands, rule_community, rule_awareness]

# The main function and a text formatter.

# Dataset-relative thresholds: the median and 75th percentile of the dataset's electricity and water columns
# (data/lifestyle_sustainability_data.csv, 499 rows). They are comparisons against THIS dataset only,
# NOT universal sustainability standards. tests/test_backend.py checks they still match the CSV.
DATASET_THRESHOLDS = {"electricity_median": 295.0, "electricity_p75": 400.0,
                      "water_median": 3350.0, "water_p75": 4100.0}


def generate_recommendations(user_profile: Dict[str, Any], max_recommendations: int = 5, max_strengths: int = 3,
                             thresholds: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Return personalised suggestions for one lifestyle profile (a dict with the 17 lifestyle inputs).

    Result keys: recommendations (sorted High -> Low, at most max_recommendations), strengths (positive feedback),
    summary (counts), message (short text) and disclaimer. The result is plain dicts/lists, so it is JSON-ready.
    """
    t = thresholds if thresholds is not None else DATASET_THRESHOLDS
    if t is None:
        raise ValueError("Thresholds are required: pass thresholds=... or set DATASET_THRESHOLDS.")
    p = validate_profile(user_profile)

    recs, strengths = [], []
    for rule in RULES:                      # every rule returns a recommendation, a strength, or nothing
        outcome = rule(p, t)
        if outcome is None:
            continue
        kind, item = outcome
        (recs if kind == "rec" else strengths).append(item)

    # Sort by priority (High first); Python's sort is stable, so equal priorities keep the RULES order
    recs.sort(key=lambda r: PRIORITY_RANK[r.priority])
    total_triggered = len(recs)
    shown = recs[:max_recommendations]
    shown_strengths = strengths[:max_strengths]

    if total_triggered == 0:                # fallback: nothing to improve according to the rules
        shown = [Recommendation("fallback_maintain", "All", "Overall", "Keep your current habits going",
                                "None of the improvement rules were triggered. Keep up your current habits and consider sharing them with friends and family.",
                                "Low", "No improvement rule was triggered by the answers provided")]
        message = "No specific improvement suggestions were triggered by your answers. Keep maintaining your current habits and continue looking for ways to make sustainable choices."
    elif shown_strengths:
        message = f"Here are {len(shown)} suggestion(s) to consider, plus {len(shown_strengths)} habit(s) you are already doing well."
    else:
        message = f"Here are {len(shown)} suggestion(s) to consider. Small steps count, so start with the first one."

    return {"recommendations": [asdict(r) for r in shown],
            "strengths": [asdict(s) for s in shown_strengths],
            "summary": {"suggestions_triggered": total_triggered, "suggestions_shown": len(shown),
                        "suggestions_not_shown": max(total_triggered - len(shown), 0), "strengths_found": len(strengths)},
            "message": message,
            "disclaimer": DISCLAIMER}


def format_recommendations(result: Dict[str, Any]) -> str:
    """Turn the result dict into readable text (handy for notebooks and demos)."""
    lines = [result["message"], ""]
    for i, r in enumerate(result["recommendations"], 1):
        lines += [f"{i}. [{r['priority']}] {r['title']}", f"   Do: {r['description']}", f"   Because you answered: {r['triggered_by']}"]
    if result["strengths"]:
        lines += ["", "Already doing well:"]
        lines += [f"  + {s['title']} ({s['triggered_by']})" for s in result["strengths"]]
    if result["summary"]["suggestions_not_shown"]:
        lines += ["", f"({result['summary']['suggestions_not_shown']} further lower-priority suggestion(s) not shown.)"]
    lines += ["", "Note: " + result["disclaimer"]]
    return "\n".join(lines)
