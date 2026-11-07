"""
train_model.py - trains the Eco Lifestyle classifier exactly as in the final notebook, then saves it.

Steps (same order and settings as the notebook):
  1. Load the CSV and build the target:  Rating 1-2 = Low, 3 = Medium, 4-5 = High.
  2. Use the 17 lifestyle features (ParticipantID, Gender and Rating are NOT features).
  3. One stratified 80:20 train/test split (random_state = 42), made BEFORE any preprocessing is fitted.
  4. Compare Dummy, Logistic Regression, Decision Tree and Random Forest with stratified 5-fold CV (training data only).
  5. Tune the strongest model with GridSearchCV (training data only).
  6. Evaluate the tuned model ONCE on the untouched test set.
  7. Supplementary (separate from classification): Linear Regression on the numeric Rating.
  8. Refit the selected pipeline on ALL labelled rows for deployment and save it.

Outputs:
  models/eco_model.joblib      the deployment pipeline (preprocessing + classifier), trained on all 499 rows
  models/model_metrics.json    evaluation results of the model trained on the 80% training split

Run from the project root:   python -m backend.train_model
"""

import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix, f1_score,
                             make_scorer, mean_absolute_error, mean_squared_error, precision_score,
                             r2_score, recall_score)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

# ----------------------------------------------------------------------------------------------
# Project paths (relative to this file, so the project works from any folder)
# ----------------------------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "lifestyle_sustainability_data.csv"
MODEL_PATH = PROJECT_ROOT / "models" / "eco_model.joblib"
METRICS_PATH = PROJECT_ROOT / "models" / "model_metrics.json"

# ----------------------------------------------------------------------------------------------
# Settings taken from the notebook
# ----------------------------------------------------------------------------------------------
RANDOM_STATE = 42
CLASS_ORDER = ["Low", "Medium", "High"]
RATING_TO_CLASS = {1: "Low", 2: "Low", 3: "Medium", 4: "High", 5: "High"}

# EnvironmentalAwareness is an ordered 1-5 scale, so it is treated as a number.
NUMERIC_FEATURES = ["Age", "HomeSize", "EnvironmentalAwareness",
                    "MonthlyElectricityConsumption", "MonthlyWaterConsumption"]
CATEGORICAL_FEATURES = ["Location", "DietType", "LocalFoodFrequency", "TransportationMode", "EnergySource",
                        "HomeType", "ClothingFrequency", "SustainableBrands", "CommunityInvolvement",
                        "UsingPlasticProducts", "DisposalMethods", "PhysicalActivities"]
FEATURE_COLUMNS = ["Age", "Location", "DietType", "LocalFoodFrequency", "TransportationMode", "EnergySource",
                   "HomeType", "HomeSize", "ClothingFrequency", "SustainableBrands", "EnvironmentalAwareness",
                   "CommunityInvolvement", "MonthlyElectricityConsumption", "MonthlyWaterConsumption",
                   "UsingPlasticProducts", "DisposalMethods", "PhysicalActivities"]   # same order as the CSV
EXCLUDED_COLUMNS = ["ParticipantID", "Gender", "Rating"]

PROBABILITY_NOTE = ("Probabilities are the Random Forest's vote shares. They are UNCALIBRATED: "
                    "a value of 0.8 does not mean an 80% chance of being right.")


def load_dataset(csv_path=DATA_PATH):
    """Read the CSV. keep_default_na=False because the text 'None' is a real category in
    CommunityInvolvement and PhysicalActivities (pandas would otherwise turn it into NaN)."""
    if not Path(csv_path).exists():
        raise FileNotFoundError(f"Dataset not found at {csv_path}. Put lifestyle_sustainability_data.csv in the data/ folder.")
    return pd.read_csv(csv_path, keep_default_na=False, na_values=[""])


def prepare_features_and_targets(df):
    """Return X (17 features), y_class (Low/Medium/High) and y_rating (numeric 1-5)."""
    y_rating = df["Rating"]
    y_class = y_rating.map(RATING_TO_CLASS)
    if y_class.isna().any():
        raise ValueError("Found a Rating outside 1-5 in the dataset.")
    X = df.drop(columns=EXCLUDED_COLUMNS).copy()
    X["SustainableBrands"] = X["SustainableBrands"].astype(str)    # True/False -> text category
    X = X[FEATURE_COLUMNS]
    assert X.shape[1] == 17, "Expected exactly 17 lifestyle features"
    return X, y_class, y_rating


def build_preprocessor():
    """Numbers: median imputation + StandardScaler. Categories: most-frequent imputation + OneHotEncoder.
    (This dataset has no empty cells; the imputers are a safeguard for incomplete data.)"""
    numeric_steps = Pipeline([("imputer", SimpleImputer(strategy="median")),
                              ("scaler", StandardScaler())])
    categorical_steps = Pipeline([("imputer", SimpleImputer(strategy="most_frequent")),
                                  ("onehot", OneHotEncoder(handle_unknown="ignore"))])
    return ColumnTransformer([("num", numeric_steps, NUMERIC_FEATURES),
                              ("cat", categorical_steps, CATEGORICAL_FEATURES)])


def make_pipeline(estimator):
    """Preprocessing + model in one Pipeline, so preprocessing is always fitted on training data only."""
    return Pipeline([("preprocess", build_preprocessor()), ("model", estimator)])


def get_candidate_models():
    return {
        "Dummy (most frequent)": DummyClassifier(strategy="most_frequent"),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
        "Decision Tree": DecisionTreeClassifier(random_state=RANDOM_STATE),
        "Random Forest": RandomForestClassifier(random_state=RANDOM_STATE),
    }


PARAM_GRIDS = {
    "Logistic Regression": {"model__C": [0.01, 0.1, 1, 10, 100]},
    "Decision Tree": {"model__max_depth": [3, 5, 8, 12, None],
                      "model__min_samples_split": [2, 5, 10],
                      "model__min_samples_leaf": [1, 2, 4],
                      "model__criterion": ["gini", "entropy"]},
    "Random Forest": {"model__n_estimators": [100, 200, 300],
                      "model__max_depth": [None, 5, 10, 15],
                      "model__min_samples_split": [2, 5, 10],
                      "model__min_samples_leaf": [1, 2, 4]},
}

# zero_division=0 stops the Dummy baseline (which never predicts Low/Medium) from raising warnings
SCORING = {"accuracy": "accuracy",
           "precision_macro": make_scorer(precision_score, average="macro", zero_division=0),
           "recall_macro": make_scorer(recall_score, average="macro", zero_division=0),
           "f1_macro": make_scorer(f1_score, average="macro", zero_division=0)}


def compare_models_with_cv(X_train, y_train, cv):
    """Stratified 5-fold CV on the TRAINING data. Returns {model name: {metric: {mean, std}}}."""
    results = {}
    for name, estimator in get_candidate_models().items():
        scores = cross_validate(make_pipeline(estimator), X_train, y_train, cv=cv, scoring=SCORING)
        results[name] = {metric: {"mean": float(scores["test_" + metric].mean()),
                                  "std": float(scores["test_" + metric].std())} for metric in SCORING}
        print(f"  {name:22s} accuracy {results[name]['accuracy']['mean']:.4f} | macro F1 {results[name]['f1_macro']['mean']:.4f}")
    return results


def tune_strongest_model(cv_results, X_train, y_train, cv):
    """Pick the best REAL model by CV macro F1 (the dummy is only a baseline), then run GridSearchCV on it."""
    real_models = {name: scores for name, scores in cv_results.items() if not name.startswith("Dummy")}
    best_name = max(real_models, key=lambda name: real_models[name]["f1_macro"]["mean"])
    print(f"Strongest candidate by CV macro F1: {best_name}")

    search = GridSearchCV(make_pipeline(get_candidate_models()[best_name]), PARAM_GRIDS[best_name],
                          cv=cv, scoring=SCORING["f1_macro"], n_jobs=-1, refit=True)
    search.fit(X_train, y_train)
    print("Best parameters:", search.best_params_)
    print(f"Best CV macro F1: {search.best_score_:.4f}")
    return best_name, search


def test_set_metrics(y_true, y_pred):
    """Accuracy and macro precision/recall/F1 (macro = the three classes count equally)."""
    return {"accuracy": float(accuracy_score(y_true, y_pred)),
            "macro_precision": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
            "macro_recall": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
            "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0))}


def original_feature_name(encoded_name):
    """'cat__DietType_Balanced' -> 'DietType', 'num__Age' -> 'Age' (so one-hot columns are grouped per feature)."""
    if encoded_name.startswith("num__"):
        return encoded_name[len("num__"):]
    body = encoded_name[len("cat__"):]
    for column in sorted(CATEGORICAL_FEATURES, key=len, reverse=True):
        if body.startswith(column + "_"):
            return column
    return body


def compute_feature_importance(pipeline, X_test, y_test):
    """Model-based importance (summed per original feature) and permutation importance on the test set."""
    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    encoded_names = list(preprocessor.get_feature_names_out())

    importance_info = {}
    if hasattr(model, "feature_importances_"):
        raw_importance = model.feature_importances_
    elif hasattr(model, "coef_"):
        raw_importance = np.abs(model.coef_).mean(axis=0)
    else:
        raw_importance = None

    if raw_importance is not None:
        per_feature = {}
        for encoded_name, value in zip(encoded_names, raw_importance):
            feature = original_feature_name(encoded_name)
            per_feature[feature] = per_feature.get(feature, 0.0) + float(value)
        total = sum(per_feature.values())
        per_feature_list = [{"feature": feature, "importance_share": value / total}
                            for feature, value in sorted(per_feature.items(), key=lambda item: -item[1])]
        top_encoded = sorted(zip(encoded_names, raw_importance), key=lambda item: -item[1])[:10]
        importance_info["model_based_per_feature"] = per_feature_list
        importance_info["model_based_top10_encoded"] = [
            {"feature": name.split("__", 1)[1], "importance": float(value)} for name, value in top_encoded]

    # Permutation importance: shuffle one ORIGINAL feature at a time in the test set, measure the drop in macro F1.
    perm = permutation_importance(pipeline, X_test, y_test, scoring=SCORING["f1_macro"],
                                  n_repeats=30, random_state=RANDOM_STATE, n_jobs=1)
    permutation_list = [{"feature": feature, "mean_f1_drop": float(mean), "std": float(std)}
                        for feature, mean, std in zip(X_test.columns, perm.importances_mean, perm.importances_std)]
    importance_info["permutation_on_test"] = sorted(permutation_list, key=lambda item: -item["mean_f1_drop"])
    importance_info["notes"] = ("Importance shows what the model relies on, not what causes a rating. "
                                "Several features carry overlapping information, so rankings in the middle are not stable.")
    return importance_info


def regression_supplement(X_train, X_test, rating_train, rating_test):
    """Supplementary experiment, kept separate from classification: Linear Regression on the numeric Rating."""
    def regression_metrics(y_true, y_hat):
        return {"rmse": float(np.sqrt(mean_squared_error(y_true, y_hat))),
                "mae": float(mean_absolute_error(y_true, y_hat)),
                "r2": float(r2_score(y_true, y_hat))}

    linear = Pipeline([("preprocess", build_preprocessor()), ("model", LinearRegression())]).fit(X_train, rating_train)
    baseline = Pipeline([("preprocess", build_preprocessor()), ("model", DummyRegressor(strategy="mean"))]).fit(X_train, rating_train)
    return {"linear_regression_test": regression_metrics(rating_test, linear.predict(X_test)),
            "mean_predictor_baseline_test": regression_metrics(rating_test, baseline.predict(X_test)),
            "note": "Supplementary experiment on the numeric Rating (1-5). Regression metrics are NOT comparable "
                    "with the classification accuracy/F1."}


def run_training(save_outputs=True):
    """Run the whole workflow. Returns the fitted pipelines and the metrics dictionary."""
    print("1. Loading data ...")
    df = load_dataset()
    X, y_class, y_rating = prepare_features_and_targets(df)
    print(f"   {len(df)} rows, {X.shape[1]} features. Classes:", y_class.value_counts().reindex(CLASS_ORDER).to_dict())

    print("2. Stratified 80:20 split (before any preprocessing is fitted) ...")
    X_train, X_test, y_train, y_test, rating_train, rating_test = train_test_split(
        X, y_class, y_rating, test_size=0.2, stratify=y_class, random_state=RANDOM_STATE)
    print(f"   train {len(X_train)} rows | test {len(X_test)} rows")

    print("3. Stratified 5-fold cross-validation on the training data ...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    cv_results = compare_models_with_cv(X_train, y_train, cv)

    print("4. Tuning the strongest model with GridSearchCV (training data only) ...")
    best_name, search = tune_strongest_model(cv_results, X_train, y_train, cv)
    evaluation_pipeline = search.best_estimator_            # trained on the 80% training split only

    print("5. Evaluating ONCE on the untouched test set ...")
    y_pred = evaluation_pipeline.predict(X_test)
    metrics_test = test_set_metrics(y_test, y_pred)
    report = classification_report(y_test, y_pred, labels=CLASS_ORDER, output_dict=True, zero_division=0)
    matrix = confusion_matrix(y_test, y_pred, labels=CLASS_ORDER)
    dummy_pred = make_pipeline(DummyClassifier(strategy="most_frequent")).fit(X_train, y_train).predict(X_test)
    print(f"   test accuracy {metrics_test['accuracy']:.3f} | macro F1 {metrics_test['macro_f1']:.3f}")

    print("6. Feature importance and the supplementary regression ...")
    importance = compute_feature_importance(evaluation_pipeline, X_test, y_test)
    regression = regression_supplement(X_train, X_test, rating_train, rating_test)

    print("7. Refitting the selected pipeline on ALL labelled rows for deployment ...")
    deployment_pipeline = clone(search.best_estimator_)     # same settings, unfitted copy
    deployment_pipeline.fit(X, y_class)

    metrics = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "library_versions": {"python": platform.python_version(), "scikit_learn": sklearn.__version__,
                             "pandas": pd.__version__, "numpy": np.__version__},
        "data": {"rows": int(len(df)), "feature_count": int(X.shape[1]), "feature_names": list(X.columns),
                 "class_counts": {name: int(count) for name, count in y_class.value_counts().reindex(CLASS_ORDER).items()},
                 "target_mapping": "Rating 1-2 = Low, 3 = Medium, 4-5 = High",
                 "excluded_columns": EXCLUDED_COLUMNS},
        "split": {"test_size": 0.2, "random_state": RANDOM_STATE, "stratified": True,
                  "train_rows": int(len(X_train)), "test_rows": int(len(X_test))},
        "cross_validation": {"folds": 5, "data": "training split only", "results": cv_results},
        "selected_model": {"name": best_name,
                           "best_params": {key: value for key, value in search.best_params_.items()},
                           "best_cv_macro_f1": float(search.best_score_)},
        "evaluation_model": {
            "description": "The selected pipeline trained on the 80% training split. ALL metrics, the confusion matrix "
                           "and the feature importance in this file describe THIS model, evaluated once on the 20% test set.",
            "test_metrics": metrics_test,
            "dummy_baseline_test": test_set_metrics(y_test, dummy_pred),
            "classification_report": report,
            "confusion_matrix": {"labels": CLASS_ORDER, "matrix": matrix.tolist(),
                                 "note": "Rows = actual class, columns = predicted class."},
            "feature_importance": importance},
        "supplementary_regression": regression,
        "deployment_model": {
            "file": "models/eco_model.joblib",
            "trained_on_rows": int(len(X)),
            "description": "Same pipeline and settings, refitted on all labelled rows. It has NO held-out test metrics "
                           "(every row was used for training); the test metrics above belong to the evaluation model.",
            "probabilities_calibrated": False, "probability_note": PROBABILITY_NOTE},
    }

    if save_outputs:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(deployment_pipeline, MODEL_PATH)
        METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        print(f"8. Saved {MODEL_PATH.relative_to(PROJECT_ROOT)} and {METRICS_PATH.relative_to(PROJECT_ROOT)}")

    return {"evaluation_pipeline": evaluation_pipeline, "deployment_pipeline": deployment_pipeline,
            "metrics": metrics, "X_test": X_test, "y_test": y_test}


if __name__ == "__main__":
    print("Python", sys.version.split()[0], "| scikit-learn", sklearn.__version__)
    run_training(save_outputs=True)
    print("Done.")
