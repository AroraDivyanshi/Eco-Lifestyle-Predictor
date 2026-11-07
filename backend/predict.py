"""
predict.py - loads the saved model, makes predictions and exposes the stored model information.

The classifier here is completely separate from the recommendation engine (recommendations.py).
Only the input validation function is shared, so both parts accept exactly the same 17 lifestyle inputs.
"""

import json
from pathlib import Path

import joblib
import pandas as pd
import sklearn

from backend.recommendations import validate_profile
from backend.train_model import (CLASS_ORDER, FEATURE_COLUMNS, METRICS_PATH, MODEL_PATH,
                                 PROBABILITY_NOTE)

# Loaded models are kept here so the file is read from disk only once per path
_model_cache = {}


def load_model(model_path=MODEL_PATH):
    """Load the saved pipeline (preprocessing + classifier). It is cached after the first call.

    Security note: joblib files are Python pickles, so only load files you created yourself.
    This function only reads the project's own models/ file, never a path supplied by an API user.
    """
    model_path = Path(model_path)
    if model_path in _model_cache:
        return _model_cache[model_path]

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}. "
                                "Create it first by running:  python -m backend.train_model")
    try:
        pipeline = joblib.load(model_path)
    except Exception as error:   # e.g. file saved with a different scikit-learn version
        raise RuntimeError(f"The model file could not be loaded ({error}). "
                           "Re-create it with:  python -m backend.train_model") from error

    if not hasattr(pipeline, "predict_proba"):
        raise RuntimeError("The model file does not contain a classifier pipeline. "
                           "Re-create it with:  python -m backend.train_model")
    _model_cache[model_path] = pipeline
    return pipeline


def profile_to_dataframe(profile):
    """Validate a profile dict and turn it into a one-row DataFrame with the training column order."""
    cleaned = validate_profile(profile)                  # raises ValueError for any invalid input
    cleaned["SustainableBrands"] = str(cleaned["SustainableBrands"])   # training used the text 'True'/'False'
    return pd.DataFrame([cleaned])[FEATURE_COLUMNS]


def predict_profile(profile, model_path=MODEL_PATH):
    """Predict Low / Medium / High for one lifestyle profile (a dict with the 17 inputs).

    Returns the predicted class and the class probabilities. The probabilities are the Random Forest's
    vote shares and are UNCALIBRATED (no calibration was implemented or verified).
    """
    features = profile_to_dataframe(profile)             # validate first, so bad input never reaches the model
    pipeline = load_model(model_path)

    predicted_class = str(pipeline.predict(features)[0])
    probability_values = pipeline.predict_proba(features)[0]
    probability_by_class = {str(name): float(value) for name, value in zip(pipeline.classes_, probability_values)}
    ordered_probabilities = {name: round(probability_by_class[name], 4) for name in CLASS_ORDER}

    return {"predicted_class": predicted_class,
            "probabilities": ordered_probabilities,
            "max_probability": round(max(probability_by_class.values()), 4),
            "probabilities_calibrated": False,
            "probability_note": PROBABILITY_NOTE}


def get_model_status(model_path=MODEL_PATH, metrics_path=METRICS_PATH):
    """Small status report used by GET /health (does not load the model)."""
    status = {"model_file_found": Path(model_path).exists(),
              "metrics_file_found": Path(metrics_path).exists(),
              "installed_scikit_learn": sklearn.__version__,
              "trained_with_scikit_learn": None}
    if status["metrics_file_found"]:
        try:
            saved = json.loads(Path(metrics_path).read_text(encoding="utf-8"))
            status["trained_with_scikit_learn"] = saved["library_versions"]["scikit_learn"]
        except (ValueError, KeyError):
            pass
    return status


def get_model_insights(metrics_path=METRICS_PATH):
    """Return the stored evaluation results (written by train_model.py) in a tidy structure for the API."""
    metrics_path = Path(metrics_path)
    if not metrics_path.exists():
        raise FileNotFoundError(f"Model metrics file not found: {metrics_path}. "
                                "Create it first by running:  python -m backend.train_model")
    saved = json.loads(metrics_path.read_text(encoding="utf-8"))

    evaluation = saved["evaluation_model"]
    return {
        "model": {"name": saved["selected_model"]["name"],
                  "best_params": saved["selected_model"]["best_params"],
                  "best_cv_macro_f1": saved["selected_model"]["best_cv_macro_f1"],
                  "deployment_trained_on_rows": saved["deployment_model"]["trained_on_rows"],
                  "created_at_utc": saved["created_at_utc"],
                  "library_versions": saved["library_versions"],
                  "probabilities_calibrated": saved["deployment_model"]["probabilities_calibrated"]},
        "data": saved["data"],
        "split": saved["split"],
        "evaluation": {"description": evaluation["description"],
                       "test_metrics": evaluation["test_metrics"],
                       "dummy_baseline_test": evaluation["dummy_baseline_test"],
                       "classification_report": evaluation["classification_report"]},
        "cross_validation": saved["cross_validation"],
        "confusion_matrix": evaluation["confusion_matrix"],
        "feature_importance": evaluation["feature_importance"],
        "supplementary_regression": saved["supplementary_regression"],
        "notes": [saved["deployment_model"]["description"],
                  saved["deployment_model"]["probability_note"],
                  "The data is small (499 rows, 100 test rows) and partly repeated, so scores are rough estimates.",
                  "Feature importance shows what the model relies on, not what causes a rating."],
    }
