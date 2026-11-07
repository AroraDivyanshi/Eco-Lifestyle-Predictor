"""
app.py - the FastAPI web application.

Endpoints
  GET  /health          backend status
  POST /predict         ML prediction + probabilities + personalised recommendations
  GET  /analytics       real dataset statistics and chart-ready data
  GET  /model-insights  stored evaluation metrics, confusion matrix and feature importance

Run from the project root:   uvicorn backend.app:app --reload
Interactive docs:            http://127.0.0.1:8000/docs
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.analytics import build_analytics
from backend.predict import get_model_insights, get_model_status, predict_profile
from backend.recommendations import generate_recommendations
from backend.schemas import (AnalyticsResponse, HealthResponse, LifestyleProfile, ModelInsightsResponse,
                             PredictResponse)
from backend.train_model import DATA_PATH

app = FastAPI(title="Eco Lifestyle Predictor API",
              description="Predicts a Low/Medium/High sustainability rating category from 17 lifestyle answers "
                          "and returns rule-based, personalised suggestions. The classifier and the "
                          "recommendation engine are separate parts.",
              version="1.0.0")

# Minimal CORS: only local development origins may call the API from a browser, and only with GET and POST.
# (Add your frontend's address here if it runs on a different port.)
app.add_middleware(CORSMiddleware,
                   allow_origins=["http://localhost:5500", "http://127.0.0.1:5500",     # VS Code Live Server
                                  "http://localhost:3000", "http://127.0.0.1:3000",
                                  "http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"])


@app.get("/health", response_model=HealthResponse)
def health():
    """Report whether the model, metrics and dataset files exist. Does not load the model."""
    status = get_model_status()
    dataset_found = DATA_PATH.exists()
    everything_ready = status["model_file_found"] and status["metrics_file_found"] and dataset_found
    return HealthResponse(status="ok" if everything_ready else "degraded",
                          dataset_found=dataset_found,
                          message="Backend is running." if everything_ready else
                                  "Backend is running, but some files are missing. Run: python -m backend.train_model",
                          **status)


@app.post("/predict", response_model=PredictResponse)
def predict(profile: LifestyleProfile):
    """Validate the 17 inputs, predict the rating category, and generate recommendations."""
    profile_dict = profile.model_dump()       # plain dictionary with the 17 inputs

    try:
        prediction = predict_profile(profile_dict)                  # machine-learning part
        recommendations = generate_recommendations(profile_dict)    # rule-based part (independent of the classifier)
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error))    # model file missing
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))    # invalid profile
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))    # model file could not be loaded

    return PredictResponse(prediction=prediction, recommendations=recommendations,
                           notes=["The prediction comes from the machine-learning classifier; the suggestions come from "
                                  "separate hand-written rules that use your actual answers.",
                                  "Probabilities are uncalibrated.",
                                  "Suggestions are general ideas. They do not guarantee a higher rating or any measured "
                                  "environmental improvement."])


@app.get("/analytics", response_model=AnalyticsResponse)
def analytics():
    """Statistics calculated from the dataset file."""
    try:
        return build_analytics()
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error))


@app.get("/model-insights", response_model=ModelInsightsResponse)
def model_insights():
    """Stored evaluation results of the trained model."""
    try:
        return get_model_insights()
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error))
