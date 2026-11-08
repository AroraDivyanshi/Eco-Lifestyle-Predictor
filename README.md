# Eco Lifestyle Predictor 🌱

An AI/ML-powered web application that predicts an individual's sustainability rating category (Low, Medium or High) based on 17 lifestyle features. It also provides personalised, rule-based suggestions to encourage more sustainable lifestyle choices.

## Features

- **Data Analytics:** Interactive visualisations of lifestyle patterns, rating distributions, consumption and correlations.
- **Lifestyle Assessment:** An interactive form with 17 lifestyle inputs.
- **ML Predictions:** Classification into Low, Medium or High categories with uncalibrated predicted probabilities.
- **Personalised Recommendations:** 12 rule-based recommendation topics, priority levels and positive feedback.
- **ML Insights:** Model comparison, confusion matrix and feature importance.
- **Methodology:** Overview of the dataset, preprocessing and machine learning workflow.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| Machine Learning | Scikit-learn |
| Data Processing | Pandas, NumPy |
| Model Storage | Joblib |
| API Validation | Pydantic |

## Project Structure

```text
Eco-Lifestyle-Predictor/
├── backend/
├── data/
├── frontend/
│   ├── css/
│   └── js/
├── models/
├── notebooks/
├── tests/
├── requirements.txt
└── README.md
```

## Dataset

The project uses a dataset of **499 records and 20 columns**, including 17 lifestyle features.

The target variable, Rating, is mapped as follows:

| Rating | Category |
|---|---|
| 1–2 | Low |
| 3 | Medium |
| 4–5 | High |

ParticipantID and Gender are excluded from model inputs.

## Machine Learning Results

Four classification approaches were compared: Dummy Classifier, Logistic Regression, Decision Tree and Random Forest.

Random Forest was selected and tuned using GridSearchCV.

**Final evaluation on the held-out test set:**

| Metric | Result |
|---|---:|
| Accuracy | 82% |
| Macro Precision | 0.8845 |
| Macro Recall | 0.7594 |
| Macro F1-score | 0.8011 |

The dataset was divided using a stratified 80:20 train-test split. The evaluation model was trained on 399 records and tested on 100 records. A separate deployment model was subsequently trained on all 499 records.

## Recommendation Engine

An independent rule-based engine uses 12 topics, including transportation, energy, waste, plastic consumption, diet, water and electricity usage.

It generates up to five prioritised suggestions and three positive strengths based on the user's answers.

These suggestions are general guidance, not carbon calculations or measured environmental impacts.

## Running the Project Locally

**1. Clone the repository**

```bash
git clone https://github.com/AroraDivyanshi/Eco-Lifestyle-Predictor.git
cd Eco-Lifestyle-Predictor
```

**2. Create and activate a virtual environment**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

**4. Generate the model files if they are unavailable**

```bash
python -m backend.train_model
```

**5. Start the backend**

```bash
uvicorn backend.app:app --reload
```

API documentation: http://127.0.0.1:8000/docs

**6. Start the frontend in a second terminal**

```bash
python -m http.server 5500 --directory frontend
```

Open: http://127.0.0.1:5500

## Testing

Run the backend tests:

```bash
python tests/test_backend.py
```

Run the API tests:

```bash
python tests/test_api.py
```

The latest recorded test run completed successfully:

- Backend tests: 33/33 passed.
- API tests: 8/8 passed.
- **Total: 41/41 passed.**

## Limitations

- The dataset is relatively small and contains repeated lifestyle profiles.
- Model probabilities are uncalibrated.
- The dataset has not undergone external validation.
- Recommendations are hand-written heuristics and do not establish causal environmental improvements.
- Feature importance and correlations indicate associations, not causation.
