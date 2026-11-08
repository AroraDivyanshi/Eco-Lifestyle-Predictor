"""
tests/test_api.py - tests the four FastAPI endpoints without starting a server (uses FastAPI's TestClient).

Needs:  pip install -r requirements.txt     (includes httpx, which TestClient uses)
Needs the model files:  python -m backend.train_model
Run from the project root:   python tests/test_api.py
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

import backend.app as app_module
from backend.schemas import EXAMPLE_PROFILE

client = TestClient(app_module.app)
tests = []
def test(function):
    tests.append(function)
    return function


@test
def health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok" and body["model_file_found"] and body["metrics_file_found"] and body["dataset_found"]

@test
def predict_returns_prediction_and_recommendations():
    response = client.post("/predict", json=EXAMPLE_PROFILE)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["prediction"]["predicted_class"] in ["Low", "Medium", "High"]
    assert abs(sum(body["prediction"]["probabilities"].values()) - 1) < 0.001
    assert body["prediction"]["probabilities_calibrated"] is False
    assert 1 <= len(body["recommendations"]["recommendations"]) <= 5
    assert "not a carbon calculation" in body["recommendations"]["disclaimer"]

@test
def predict_rejects_bad_requests():
    bad_requests = [{**EXAMPLE_PROFILE, "Location": "Mars"},              # unknown category
                    {**EXAMPLE_PROFILE, "EnvironmentalAwareness": 6},     # out of range
                    {**EXAMPLE_PROFILE, "MonthlyWaterConsumption": -5},   # negative number
                    {**EXAMPLE_PROFILE, "Gender": "Female"},              # extra field not allowed
                    {key: value for key, value in EXAMPLE_PROFILE.items() if key != "Age"}]   # missing field
    for bad in bad_requests:
        assert client.post("/predict", json=bad).status_code == 422, bad
    assert client.post("/predict", content="not json", headers={"Content-Type": "application/json"}).status_code == 422

@test
def predict_returns_503_when_model_is_missing():
    original_function = app_module.predict_profile
    def pretend_model_is_missing(profile):
        raise FileNotFoundError("Model file not found. Run: python -m backend.train_model")
    app_module.predict_profile = pretend_model_is_missing
    try:
        response = client.post("/predict", json=EXAMPLE_PROFILE)
    finally:
        app_module.predict_profile = original_function      # always restore the real function
    assert response.status_code == 503 and "train_model" in response.json()["detail"]

@test
def analytics_returns_real_dataset_statistics():
    response = client.get("/analytics")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overview"]["rows"] == 499
    assert [item["count"] for item in body["rating_distribution"]] == [97, 34, 101, 91, 176]
    assert len(body["correlations"]["matrix"]) == 6

@test
def model_insights_returns_stored_evaluation():
    response = client.get("/model-insights")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["confusion_matrix"]["matrix"] == [[16, 0, 10], [0, 14, 6], [2, 0, 52]]
    assert body["evaluation"]["test_metrics"]["accuracy"] == 0.82
    assert len(body["feature_importance"]["permutation_on_test"]) == 17

@test
def cors_allows_only_local_frontend_origins():
    allowed = client.get("/health", headers={"Origin": "http://localhost:5500"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5500"
    blocked = client.get("/health", headers={"Origin": "http://evil.example.com"})
    assert "access-control-allow-origin" not in blocked.headers

@test
def unknown_route_returns_404():
    assert client.get("/does-not-exist").status_code == 404


if __name__ == "__main__":
    failed = []
    for function in tests:
        try:
            function()
            print(f"PASS  {function.__name__}")
        except Exception as error:
            failed.append(function.__name__)
            print(f"FAIL  {function.__name__}: {type(error).__name__}: {str(error)[:300]}")
    print(f"\n{len(tests) - len(failed)}/{len(tests)} API tests passed")
    sys.exit(0 if not failed else 1)
