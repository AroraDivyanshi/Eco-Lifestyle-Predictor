"""
tests/test_backend.py - plain-Python tests (no pytest needed) for everything that does NOT need the web server.

Run from the project root:   python tests/test_backend.py

Covers: the 14 recommendation-engine tests from the notebook, request-schema consistency, model loading and
prediction, error handling, saved-metrics parity with the notebook, and the analytics calculations.
The model tests need the files created by:  python -m backend.train_model
"""

import ast
import copy
import json
import random
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
import pandas as pd

from backend import recommendations as rec
from backend.analytics import build_analytics
from backend.predict import get_model_insights, get_model_status, load_model, predict_profile
from backend.recommendations import (DATASET_THRESHOLDS, NUMERIC_RANGES, PRIORITY_RANK, REQUIRED_FIELDS,
                                     VALID_CATEGORIES, generate_recommendations)
from backend.train_model import (CLASS_ORDER, FEATURE_COLUMNS, METRICS_PATH, MODEL_PATH, load_dataset,
                                 prepare_features_and_targets)

df = load_dataset()

# ------------------------------------------------------------------------------------------
# Example profiles (copied from notebook Section 11.4)
# ------------------------------------------------------------------------------------------
base_profile = {"Age": 35, "Location": "Suburban", "DietType": "Balanced", "LocalFoodFrequency": "Sometimes",
                "TransportationMode": "Public Transit", "EnergySource": "Mixed", "HomeType": "Apartment", "HomeSize": 1000,
                "ClothingFrequency": "Sometimes", "SustainableBrands": True, "EnvironmentalAwareness": 3,
                "CommunityInvolvement": "Moderate", "MonthlyElectricityConsumption": 300, "MonthlyWaterConsumption": 3300,
                "UsingPlasticProducts": "Sometimes", "DisposalMethods": "Recycling", "PhysicalActivities": "Moderate"}

example_profiles = {
    "A. Car-dependent, high consumption": {**base_profile, "Location": "Urban", "DietType": "Mostly Animal-Based", "LocalFoodFrequency": "Rarely",
        "TransportationMode": "Car", "EnergySource": "Non-Renewable", "HomeType": "House", "HomeSize": 2400, "ClothingFrequency": "Always",
        "SustainableBrands": False, "EnvironmentalAwareness": 1, "CommunityInvolvement": "None",
        "MonthlyElectricityConsumption": 450, "MonthlyWaterConsumption": 5000, "UsingPlasticProducts": "Often", "DisposalMethods": "Landfill"},
    "B. Rural car owner with renewable energy": {**base_profile, "Location": "Rural", "TransportationMode": "Car", "EnergySource": "Renewable",
        "HomeType": "House", "DisposalMethods": "Combination", "UsingPlasticProducts": "Sometimes", "LocalFoodFrequency": "Often",
        "MonthlyElectricityConsumption": 200, "MonthlyWaterConsumption": 2800},
    "C. Public-transit user, waste to landfill": {**base_profile, "TransportationMode": "Public Transit", "DisposalMethods": "Landfill",
        "UsingPlasticProducts": "Rarely", "EnergySource": "Renewable", "SustainableBrands": False, "ClothingFrequency": "Rarely"},
    "D. Already very sustainable": {**base_profile, "DietType": "Mostly Plant-Based", "LocalFoodFrequency": "Always", "TransportationMode": "Bike",
        "EnergySource": "Renewable", "ClothingFrequency": "Rarely", "SustainableBrands": True, "EnvironmentalAwareness": 5,
        "CommunityInvolvement": "High", "MonthlyElectricityConsumption": 100, "MonthlyWaterConsumption": 1500,
        "UsingPlasticProducts": "Never", "DisposalMethods": "Combination"},
    "E. Mixed habits, high water use": {**base_profile, "TransportationMode": "Walk", "DietType": "Mostly Animal-Based", "EnergySource": "Mixed",
        "MonthlyWaterConsumption": 4800, "ClothingFrequency": "Often", "SustainableBrands": False, "DisposalMethods": "Composting"},
}
example_results = {name: generate_recommendations(profile) for name, profile in example_profiles.items()}

FORBIDDEN_PHRASES = ["guarantee", "will increase your rating", "will improve your rating", "proven to", "will reduce your carbon"]


def check_invariants(profile, result):
    """Rules every recommendation output must obey. Returns a list of problems (empty list = OK)."""
    problems = []
    recs, strengths = result["recommendations"], result["strengths"]
    ranks = [PRIORITY_RANK[r["priority"]] for r in recs]
    if ranks != sorted(ranks): problems.append("recommendations not sorted High->Low")
    if not 1 <= len(recs) <= 5: problems.append(f"{len(recs)} recommendations (expected 1-5)")
    if len(strengths) > 3: problems.append("too many strengths")
    for item in recs + strengths:
        if not all(str(v).strip() for v in item.values()): problems.append(f"empty field in {item['rule_id']}")
    rec_ids, str_ids = [r["rule_id"] for r in recs], [s["rule_id"] for s in strengths]
    if len(set(rec_ids)) != len(rec_ids): problems.append("duplicate recommendation rule")
    if set(rec_ids) & set(str_ids): problems.append("same rule both recommends and praises")
    if {r["feature"] for r in recs} & {s["feature"] for s in strengths}: problems.append("feature both improved and praised")
    if profile["TransportationMode"] != "Car" and "transport" in rec_ids: problems.append("transport advice for non-car user")
    if profile["UsingPlasticProducts"] in ("Never", "Rarely") and "plastic" in rec_ids: problems.append("plastic advice for low-plastic user")
    if profile["EnergySource"] == "Renewable" and "energy" in rec_ids: problems.append("energy advice for renewable user")
    if profile["DisposalMethods"] == "Combination" and "waste" in rec_ids: problems.append("waste advice for combination user")
    if profile["DietType"] == "Mostly Plant-Based" and "diet" in rec_ids: problems.append("diet advice for plant-based user")
    if profile["SustainableBrands"] in (True, "True") and "brands" in rec_ids: problems.append("brand advice for sustainable-brand user")
    text = " ".join(str(v) for item in recs + strengths for v in item.values()).lower() + result["message"].lower()
    if any(phrase in text for phrase in FORBIDDEN_PHRASES): problems.append("over-claiming language found")
    if "not a carbon calculation" not in result["disclaimer"]: problems.append("disclaimer missing")
    return problems


def ids(result, key="recommendations"):
    return [item["rule_id"] for item in result[key]]

def full(profile):
    """All triggered suggestions and strengths (not cut to the top 5 / top 3)."""
    return generate_recommendations(profile, max_recommendations=50, max_strengths=50)

def prof(**changes):
    return {**base_profile, **changes}


tests = []
def test(function):
    tests.append(function)
    return function


# ======================== Recommendation engine (the 14 notebook tests) ========================
@test
def rec_categories_match_dataset():
    for column, allowed in VALID_CATEGORIES.items():
        assert set(df[column].astype(str).unique()) == set(allowed), column
    X, _, _ = prepare_features_and_targets(df)
    assert len(REQUIRED_FIELDS) == 17 and set(REQUIRED_FIELDS) == set(X.columns)

@test
def rec_twelve_rules_exist():
    assert len(rec.RULES) == 12

@test
def rec_thresholds_match_csv():
    assert abs(DATASET_THRESHOLDS["electricity_median"] - df["MonthlyElectricityConsumption"].median()) < 1e-9
    assert abs(DATASET_THRESHOLDS["electricity_p75"] - df["MonthlyElectricityConsumption"].quantile(.75)) < 1e-9
    assert abs(DATASET_THRESHOLDS["water_median"] - df["MonthlyWaterConsumption"].median()) < 1e-9
    assert abs(DATASET_THRESHOLDS["water_p75"] - df["MonthlyWaterConsumption"].quantile(.75)) < 1e-9
    computed = rec.compute_thresholds(df["MonthlyElectricityConsumption"].tolist(), df["MonthlyWaterConsumption"].tolist())
    assert computed == DATASET_THRESHOLDS

@test
def rec_invalid_input_is_rejected():
    bad_profiles = [prof(TransportationMode="Rocket"), {k: v for k, v in base_profile.items() if k != "DietType"},
                    prof(EnvironmentalAwareness=7), prof(MonthlyElectricityConsumption=-5), prof(SustainableBrands="maybe")]
    for bad in bad_profiles:
        try:
            generate_recommendations(bad)
        except ValueError:
            continue
        raise AssertionError("invalid profile was accepted")

@test
def rec_input_not_mutated_and_deterministic():
    profile = prof(TransportationMode="Car"); before = copy.deepcopy(profile)
    first, second = generate_recommendations(profile), generate_recommendations(profile)
    assert profile == before and first == second

@test
def rec_transport_relevance_and_priority():
    for mode in ["Public Transit", "Bike", "Walk"]:
        result = full(prof(TransportationMode=mode))
        assert "transport" not in ids(result) and "transport" in ids(result, "strengths")
    urban = full(prof(TransportationMode="Car", Location="Urban"))
    rural = full(prof(TransportationMode="Car", Location="Rural"))
    urban_item = [x for x in urban["recommendations"] if x["rule_id"] == "transport"][0]
    rural_item = [x for x in rural["recommendations"] if x["rule_id"] == "transport"][0]
    assert urban_item["priority"] == "High" and rural_item["priority"] == "Medium" and urban_item["title"] != rural_item["title"]

@test
def rec_plastic_relevance_and_priority():
    for use in ["Never", "Rarely"]:
        assert "plastic" not in ids(generate_recommendations(prof(UsingPlasticProducts=use)))
    often = [x["priority"] for x in full(prof(UsingPlasticProducts="Often"))["recommendations"] if x["rule_id"] == "plastic"]
    sometimes = [x["priority"] for x in full(prof(UsingPlasticProducts="Sometimes"))["recommendations"] if x["rule_id"] == "plastic"]
    assert often == ["High"] and sometimes == ["Medium"]

@test
def rec_energy_and_waste_rules():
    assert "energy" not in ids(generate_recommendations(prof(EnergySource="Renewable")))
    non_renewable = [x for x in full(prof(EnergySource="Non-Renewable"))["recommendations"] if x["rule_id"] == "energy"][0]
    assert non_renewable["priority"] == "High"
    assert "waste" not in ids(generate_recommendations(prof(DisposalMethods="Combination")))
    landfill = [x for x in full(prof(DisposalMethods="Landfill"))["recommendations"] if x["rule_id"] == "waste"][0]
    assert landfill["priority"] == "High"
    recycling_text = [x for x in full(prof(DisposalMethods="Recycling"))["recommendations"] if x["rule_id"] == "waste"][0]["description"]
    assert "compost" in recycling_text.lower()     # a recycler is pointed to composting, not told to start recycling

@test
def rec_consumption_uses_dataset_thresholds():
    t = DATASET_THRESHOLDS
    low = full(prof(MonthlyElectricityConsumption=t["electricity_median"], MonthlyWaterConsumption=t["water_median"]))
    assert "electricity" not in ids(low) and "water" not in ids(low)
    assert {"electricity", "water"} <= set(ids(low, "strengths"))
    high = full(prof(MonthlyElectricityConsumption=t["electricity_p75"] + 1, MonthlyWaterConsumption=t["water_p75"] + 1))
    assert {"electricity", "water"} <= set(ids(high))
    assert all("dataset" in x["triggered_by"] for x in high["recommendations"] if x["rule_id"] in ("electricity", "water"))
    middle = full(prof(MonthlyElectricityConsumption=(t["electricity_median"] + t["electricity_p75"]) / 2))
    assert "electricity" not in ids(middle) and "electricity" not in ids(middle, "strengths")

@test
def rec_shopping_rules_do_not_clash():
    assert "brands" not in ids(full(prof(SustainableBrands=True)))
    assert "brands" not in ids(full(prof(SustainableBrands=False, ClothingFrequency="Rarely")))
    assert "brands" in ids(full(prof(SustainableBrands=False, ClothingFrequency="Always")))

@test
def rec_limit_and_priority_order():
    worst = example_profiles["A. Car-dependent, high consumption"]
    everything, top3 = generate_recommendations(worst, max_recommendations=50), generate_recommendations(worst, max_recommendations=3)
    assert len(top3["recommendations"]) == 3 and len(generate_recommendations(worst)["recommendations"]) == 5
    assert top3["recommendations"] == everything["recommendations"][:3]        # the most important ones are kept
    assert top3["recommendations"][0]["priority"] == "High"
    assert top3["summary"]["suggestions_not_shown"] == everything["summary"]["suggestions_triggered"] - 3

@test
def rec_fallback_and_positive_reinforcement():
    result = example_results["D. Already very sustainable"]
    assert ids(result) == ["fallback_maintain"] and result["recommendations"][0]["priority"] == "Low"
    assert len(result["strengths"]) >= 1
    assert "no specific improvement suggestions were triggered" in result["message"].lower()

@test
def rec_different_users_get_different_output():
    assert len({tuple(ids(r)) for r in example_results.values()}) == len(example_results)

@test
def rec_all_dataset_rows_pass_invariants():
    bad = []
    for index, row in df.iterrows():
        profile = {key: row[key] for key in REQUIRED_FIELDS}
        profile["SustainableBrands"] = bool(profile["SustainableBrands"])
        problems = check_invariants(profile, generate_recommendations(profile))
        if problems: bad.append((index, problems))
    assert not bad, bad[:3]

@test
def rec_random_profiles_pass_invariants():
    rng = random.Random(42)
    bad = []
    for _ in range(2000):
        profile = {column: rng.choice(values) for column, values in VALID_CATEGORIES.items()}
        profile.update({"Age": rng.randint(18, 90), "HomeSize": rng.randint(300, 3000), "EnvironmentalAwareness": rng.randint(1, 5),
                        "MonthlyElectricityConsumption": rng.randint(50, 500), "MonthlyWaterConsumption": rng.randint(500, 5500),
                        "SustainableBrands": rng.choice([True, False])})
        problems = check_invariants(profile, generate_recommendations(profile))
        if problems: bad.append((profile, problems))
    assert not bad, bad[:2]

@test
def rec_engine_does_not_import_classifier():
    source = (PROJECT_ROOT / "backend" / "recommendations.py").read_text(encoding="utf-8")
    imported = [node for node in ast.walk(ast.parse(source)) if isinstance(node, (ast.Import, ast.ImportFrom))]
    names = " ".join(ast.dump(node) for node in imported)
    assert "sklearn" not in names and "joblib" not in names and "pandas" not in names and "backend" not in names


# ======================== Request schema consistency (read from the source, no Pydantic needed) ========================
@test
def schema_fields_match_engine_and_dataset():
    tree = ast.parse((PROJECT_ROOT / "backend" / "schemas.py").read_text(encoding="utf-8"))
    profile_class = [n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "LifestyleProfile"][0]
    schema_fields = {}
    for node in profile_class.body:
        if isinstance(node, ast.AnnAssign):
            schema_fields[node.target.id] = node
    assert set(schema_fields) == set(REQUIRED_FIELDS), set(schema_fields) ^ set(REQUIRED_FIELDS)

    for name, node in schema_fields.items():
        annotation = node.annotation
        if name in VALID_CATEGORIES:                      # Literal["...", ...] must equal the dataset categories
            assert isinstance(annotation, ast.Subscript) and annotation.value.id == "Literal", name
            literal_values = [element.value for element in annotation.slice.elts]
            assert literal_values == VALID_CATEGORIES[name], (name, literal_values)
        elif name in NUMERIC_RANGES:                      # Field(ge=..., le=...) must equal the engine ranges
            keywords = {kw.arg: kw.value.value for kw in node.value.keywords if kw.arg in ("ge", "le")}
            low, high = NUMERIC_RANGES[name]
            assert keywords.get("ge") == low and keywords.get("le") == high, (name, keywords)
        else:
            assert name == "SustainableBrands" and annotation.id == "bool"

@test
def schema_example_profile_is_valid_for_engine():
    tree = ast.parse((PROJECT_ROOT / "backend" / "schemas.py").read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and node.targets[0].id == "EXAMPLE_PROFILE":
            example = ast.literal_eval(node.value)
            rec.validate_profile(example)
            return
    raise AssertionError("EXAMPLE_PROFILE not found")

@test
def schema_response_fields_match_real_outputs():
    """Pydantic is not needed: read the response classes from the source and compare their field names with the
    real dictionaries produced by the backend functions."""
    tree = ast.parse((PROJECT_ROOT / "backend" / "schemas.py").read_text(encoding="utf-8"))
    schema_fields = {}
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            schema_fields[node.name] = {n.target.id for n in node.body if isinstance(n, ast.AnnAssign)}

    assert set(build_analytics()) == schema_fields["AnalyticsResponse"]
    assert set(get_model_insights()) == schema_fields["ModelInsightsResponse"]
    assert set(predict_profile(example_profiles["A. Car-dependent, high consumption"])) == schema_fields["PredictionResult"]
    result = generate_recommendations(example_profiles["A. Car-dependent, high consumption"])
    assert set(result) == schema_fields["RecommendationResult"]
    assert set(result["recommendations"][0]) == schema_fields["RecommendationItem"]
    result_with_strengths = generate_recommendations(example_profiles["B. Rural car owner with renewable energy"])
    assert set(result_with_strengths["strengths"][0]) == schema_fields["StrengthItem"]
    assert set(result["summary"]) == schema_fields["RecommendationSummary"]
    health_keys = set(get_model_status()) | {"status", "dataset_found", "message"}
    assert health_keys == schema_fields["HealthResponse"]


@test
def schema_pydantic_validation_if_installed():
    try:
        from backend.schemas import EXAMPLE_PROFILE, LifestyleProfile
    except ImportError:
        print("      (pydantic is not installed here - skipped; tests/test_api.py covers it when FastAPI is installed)")
        return
    LifestyleProfile(**EXAMPLE_PROFILE)
    for bad in [{**EXAMPLE_PROFILE, "Location": "Mars"}, {**EXAMPLE_PROFILE, "EnvironmentalAwareness": 6}, {**EXAMPLE_PROFILE, "Gender": "x"}]:
        try:
            LifestyleProfile(**bad)
        except ValueError:      # pydantic's ValidationError is a ValueError
            continue
        raise AssertionError("invalid profile accepted by schema")


# ======================== Model loading and prediction ========================
@test
def model_files_exist_and_load():
    assert MODEL_PATH.exists() and METRICS_PATH.exists(), "Run first:  python -m backend.train_model"
    pipeline = load_model()
    assert list(pipeline.named_steps) == ["preprocess", "model"]
    assert list(pipeline.feature_names_in_) == FEATURE_COLUMNS and pipeline.n_features_in_ == 17
    assert set(pipeline.classes_) == set(CLASS_ORDER)

@test
def predict_returns_valid_output_for_all_examples():
    for name, profile in example_profiles.items():
        out = predict_profile(profile)
        assert out["predicted_class"] in CLASS_ORDER, name
        assert list(out["probabilities"]) == CLASS_ORDER
        assert abs(sum(out["probabilities"].values()) - 1) < 0.001, name
        assert out["max_probability"] == max(out["probabilities"].values())
        assert out["probabilities_calibrated"] is False and "UNCALIBRATED" in out["probability_note"]
        assert out["predicted_class"] == max(out["probabilities"], key=out["probabilities"].get)

@test
def predict_matches_direct_pipeline_call():
    row = df.iloc[0]
    profile = {key: row[key] for key in REQUIRED_FIELDS}
    profile["SustainableBrands"] = bool(profile["SustainableBrands"])
    X, _, _ = prepare_features_and_targets(df)
    direct = load_model().predict(X.iloc[[0]])[0]           # same row straight from the training-style DataFrame
    assert predict_profile(profile)["predicted_class"] == direct

@test
def predict_accepts_string_boolean_and_ignores_extra_keys():
    profile = {**example_profiles["B. Rural car owner with renewable energy"], "SustainableBrands": "True", "Gender": "Female"}
    assert predict_profile(profile)["predicted_class"] in CLASS_ORDER

@test
def predict_rejects_invalid_input():
    good = example_profiles["A. Car-dependent, high consumption"]
    for bad in [{**good, "EnergySource": "Solar"}, {k: v for k, v in good.items() if k != "Age"},
                {**good, "EnvironmentalAwareness": 9}, {**good, "MonthlyWaterConsumption": -1}, {**good, "HomeSize": "big"}]:
        try:
            predict_profile(bad)
        except ValueError:
            continue
        raise AssertionError("invalid input accepted")

@test
def predict_handles_missing_and_broken_model_files():
    profile = example_profiles["A. Car-dependent, high consumption"]
    try:
        predict_profile(profile, model_path=PROJECT_ROOT / "models" / "does_not_exist.joblib")
        raise AssertionError("missing model did not raise")
    except FileNotFoundError as error:
        assert "train_model" in str(error)
    with tempfile.TemporaryDirectory() as folder:
        broken_file = Path(folder) / "broken.joblib"
        broken_file.write_text("this is not a model")
        try:
            predict_profile(profile, model_path=broken_file)
            raise AssertionError("broken model did not raise")
        except RuntimeError as error:
            assert "train_model" in str(error)

@test
def status_reports_files():
    status = get_model_status()
    assert status["model_file_found"] and status["metrics_file_found"]
    missing = get_model_status(model_path=PROJECT_ROOT / "nope.joblib", metrics_path=PROJECT_ROOT / "nope.json")
    assert not missing["model_file_found"] and not missing["metrics_file_found"]


# ======================== Saved evaluation results vs the notebook ========================
@test
def saved_metrics_match_notebook():
    saved = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    evaluation = saved["evaluation_model"]
    assert saved["selected_model"]["name"] == "Random Forest"
    assert saved["selected_model"]["best_params"] == {"model__max_depth": None, "model__min_samples_leaf": 1,
                                                       "model__min_samples_split": 2, "model__n_estimators": 300}
    assert abs(saved["selected_model"]["best_cv_macro_f1"] - 0.8064) < 0.0005
    assert evaluation["test_metrics"]["accuracy"] == 0.82
    assert abs(evaluation["test_metrics"]["macro_f1"] - 0.8011) < 0.0005
    assert abs(evaluation["test_metrics"]["macro_precision"] - 0.8845) < 0.0005
    assert abs(evaluation["test_metrics"]["macro_recall"] - 0.7594) < 0.0005
    assert evaluation["confusion_matrix"]["labels"] == ["Low", "Medium", "High"]
    assert evaluation["confusion_matrix"]["matrix"] == [[16, 0, 10], [0, 14, 6], [2, 0, 52]]
    cv_rf = saved["cross_validation"]["results"]["Random Forest"]
    assert abs(cv_rf["accuracy"]["mean"] - 0.8319) < 0.0005 and abs(cv_rf["f1_macro"]["mean"] - 0.7910) < 0.0005
    regression = saved["supplementary_regression"]["linear_regression_test"]
    assert abs(regression["rmse"] - 0.961) < 0.001 and abs(regression["mae"] - 0.725) < 0.001 and abs(regression["r2"] - 0.536) < 0.001

@test
def saved_metrics_are_consistent_and_clearly_labelled():
    saved = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    assert saved["split"]["train_rows"] == 399 and saved["split"]["test_rows"] == 100
    assert sum(sum(row) for row in saved["evaluation_model"]["confusion_matrix"]["matrix"]) == 100
    assert saved["deployment_model"]["trained_on_rows"] == 499 == saved["data"]["rows"]
    assert "NO held-out" in saved["deployment_model"]["description"]
    assert saved["deployment_model"]["probabilities_calibrated"] is False
    assert saved["data"]["feature_count"] == 17 and not {"Gender", "ParticipantID", "Rating"} & set(saved["data"]["feature_names"])
    importance = saved["evaluation_model"]["feature_importance"]
    assert len(importance["model_based_per_feature"]) == 17 and len(importance["permutation_on_test"]) == 17
    assert abs(sum(item["importance_share"] for item in importance["model_based_per_feature"]) - 1) < 1e-6

@test
def model_insights_has_expected_sections():
    insights = get_model_insights()
    for key in ["model", "data", "split", "evaluation", "cross_validation", "confusion_matrix",
                "feature_importance", "supplementary_regression", "notes"]:
        assert key in insights, key
    try:
        get_model_insights(metrics_path=PROJECT_ROOT / "models" / "missing.json")
        raise AssertionError("missing metrics file did not raise")
    except FileNotFoundError:
        pass


# ======================== Analytics ========================
@test
def analytics_matches_dataset_and_notebook_audit():
    result = build_analytics()
    assert result["overview"]["rows"] == len(df) == 499 and result["overview"]["model_features"] == 17
    assert [item["count"] for item in result["rating_distribution"]] == [int(df["Rating"].eq(r).sum()) for r in range(1, 6)]
    assert sum(item["count"] for item in result["class_distribution"]) == 499
    assert {item["class"]: item["count"] for item in result["class_distribution"]} == {"Low": 131, "Medium": 101, "High": 267}
    quality = result["data_quality"]
    assert (quality["exact_duplicate_rows"], quality["duplicate_rows_excluding_participant_id"], quality["repeated_profile_groups"],
            quality["rows_in_repeated_profiles"], quality["extra_repeated_rows"],
            quality["repeated_profiles_with_conflicting_ratings"], quality["missing_cells"]) == (0, 39, 40, 81, 41, 0, 0)
    for feature, rows in result["categorical_distributions"].items():
        assert sum(item["count"] for item in rows) == 499, feature
    for feature, rows in result["class_share_by_category"].items():
        assert all(abs(row["Low"] + row["Medium"] + row["High"] - 100) < 0.5 for row in rows), feature

@test
def analytics_correlations_are_valid():
    result = build_analytics()["correlations"]
    matrix = np.array(result["matrix"])
    assert matrix.shape == (6, 6) and result["labels"][-1] == "Rating"
    assert np.allclose(np.diag(matrix), 1) and np.allclose(matrix, matrix.T, atol=1e-4)
    assert abs(matrix[-1, 3] - df["MonthlyElectricityConsumption"].corr(df["Rating"])) < 1e-4

@test
def analytics_is_json_serialisable():
    json.dumps(build_analytics())


# ======================== Runner ========================
if __name__ == "__main__":
    passed = 0
    failed = []
    for function in tests:
        try:
            function()
            passed += 1
            print(f"PASS  {function.__name__}")
        except Exception as error:
            failed.append(function.__name__)
            print(f"FAIL  {function.__name__}: {type(error).__name__}: {str(error)[:300]}")
    print(f"\n{passed}/{len(tests)} tests passed")
    sys.exit(0 if not failed else 1)
