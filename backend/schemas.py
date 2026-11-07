"""
schemas.py - Pydantic models that validate incoming lifestyle profiles and describe the API responses (Pydantic v2).

The category names and numeric ranges are the same as in recommendations.py and the dataset
(tests/test_backend.py checks that they match).
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# ------------------------------------------------------------------------------------------
# Request: the exact 17 lifestyle inputs
# ------------------------------------------------------------------------------------------
EXAMPLE_PROFILE = {
    "Age": 35, "Location": "Suburban", "DietType": "Balanced", "LocalFoodFrequency": "Sometimes",
    "TransportationMode": "Car", "EnergySource": "Mixed", "HomeType": "Apartment", "HomeSize": 1000,
    "ClothingFrequency": "Sometimes", "SustainableBrands": True, "EnvironmentalAwareness": 3,
    "CommunityInvolvement": "Moderate", "MonthlyElectricityConsumption": 300, "MonthlyWaterConsumption": 3300,
    "UsingPlasticProducts": "Sometimes", "DisposalMethods": "Recycling", "PhysicalActivities": "Moderate"}


class LifestyleProfile(BaseModel):
    """One person's 17 lifestyle answers. Extra fields (for example Gender) are rejected."""
    model_config = ConfigDict(extra="forbid", json_schema_extra={"example": EXAMPLE_PROFILE})

    Age: int = Field(ge=0, le=120, description="Age in years")
    Location: Literal["Urban", "Suburban", "Rural"]
    DietType: Literal["Mostly Plant-Based", "Balanced", "Mostly Animal-Based"]
    LocalFoodFrequency: Literal["Always", "Often", "Sometimes", "Rarely"]
    TransportationMode: Literal["Car", "Public Transit", "Bike", "Walk"]
    EnergySource: Literal["Renewable", "Mixed", "Non-Renewable"]
    HomeType: Literal["House", "Apartment", "Other"]
    HomeSize: float = Field(ge=1, description="Home size (same unit as the dataset, square feet)")
    ClothingFrequency: Literal["Rarely", "Sometimes", "Often", "Always"]
    SustainableBrands: bool
    EnvironmentalAwareness: int = Field(ge=1, le=5, description="Self-rated awareness, 1 (low) to 5 (high)")
    CommunityInvolvement: Literal["None", "Low", "Moderate", "High"]
    MonthlyElectricityConsumption: float = Field(ge=0, description="kWh per month")
    MonthlyWaterConsumption: float = Field(ge=0, description="Litres per month")
    UsingPlasticProducts: Literal["Never", "Rarely", "Sometimes", "Often"]
    DisposalMethods: Literal["Landfill", "Recycling", "Composting", "Combination"]
    PhysicalActivities: Literal["None", "Low", "Moderate", "High"]


# ------------------------------------------------------------------------------------------
# Responses
# ------------------------------------------------------------------------------------------
class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())   # allows field names that start with "model_"
    status: str
    model_file_found: bool
    metrics_file_found: bool
    dataset_found: bool
    installed_scikit_learn: str
    trained_with_scikit_learn: Optional[str] = None
    message: str


class PredictionResult(BaseModel):
    predicted_class: Literal["Low", "Medium", "High"]
    probabilities: Dict[str, float]
    max_probability: float
    probabilities_calibrated: bool
    probability_note: str


class RecommendationItem(BaseModel):
    rule_id: str
    feature: str
    category: str
    title: str
    description: str
    priority: Literal["High", "Medium", "Low"]
    triggered_by: str


class StrengthItem(BaseModel):
    rule_id: str
    feature: str
    title: str
    message: str
    triggered_by: str


class RecommendationSummary(BaseModel):
    suggestions_triggered: int
    suggestions_shown: int
    suggestions_not_shown: int
    strengths_found: int


class RecommendationResult(BaseModel):
    recommendations: List[RecommendationItem]
    strengths: List[StrengthItem]
    summary: RecommendationSummary
    message: str
    disclaimer: str


class PredictResponse(BaseModel):
    prediction: PredictionResult
    recommendations: RecommendationResult
    notes: List[str]


class AnalyticsResponse(BaseModel):
    """Dataset statistics. The sections are flexible dictionaries/lists because they are chart-ready data."""
    overview: Dict[str, Any]
    rating_distribution: List[Dict[str, Any]]
    class_distribution: List[Dict[str, Any]]
    categorical_distributions: Dict[str, List[Dict[str, Any]]]
    class_share_by_category: Dict[str, List[Dict[str, Any]]]
    numeric_summaries: Dict[str, Dict[str, float]]
    numeric_histograms: Dict[str, Dict[str, List[Any]]]     # bin_edges (decimals) and counts (whole numbers)
    environmental_awareness_distribution: List[Dict[str, Any]]
    correlations: Dict[str, Any]
    recommendation_thresholds: Dict[str, Any]
    data_quality: Dict[str, Any]
    notes: List[str]


class ModelInsightsResponse(BaseModel):
    """Stored evaluation results of the model (written by train_model.py)."""
    model: Dict[str, Any]
    data: Dict[str, Any]
    split: Dict[str, Any]
    evaluation: Dict[str, Any]
    cross_validation: Dict[str, Any]
    confusion_matrix: Dict[str, Any]
    feature_importance: Dict[str, Any]
    supplementary_regression: Dict[str, Any]
    notes: List[str]
