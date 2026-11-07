"""
analytics.py - computes real dataset statistics and chart-ready data for GET /analytics.

Everything here is calculated from data/lifestyle_sustainability_data.csv when the function is called.
No numbers are typed in by hand. (This file is not in the original folder plan: it keeps the calculation
separate from app.py so it can be tested without starting the web server.)
"""

import numpy as np
import pandas as pd

from backend.recommendations import DATASET_THRESHOLDS
from backend.train_model import (CATEGORICAL_FEATURES, CLASS_ORDER, FEATURE_COLUMNS, NUMERIC_FEATURES,
                                 load_dataset, prepare_features_and_targets)


def count_table(series, order=None):
    """Turn a pandas Series into a list of {value, count, percent} (easy to plot as a bar chart)."""
    counts = series.value_counts()
    if order is not None:
        counts = counts.reindex(order).fillna(0).astype(int)
    total = int(counts.sum())
    return [{"value": str(value), "count": int(count), "percent": round(100 * int(count) / total, 1)}
            for value, count in counts.items()]


def build_data_quality(df, feature_df):
    """Duplicate checks (same three definitions as the notebook audit)."""
    columns_without_id = [column for column in df.columns if column != "ParticipantID"]

    exact_duplicates = int(df.duplicated().sum())
    duplicates_excluding_id = int(df.duplicated(subset=columns_without_id).sum())

    # Repeated PROFILES: identical on the 17 lifestyle features only
    profile_table = df.assign(**{"_profile": feature_df.astype(str).apply("|".join, axis=1)}) \
                      .groupby("_profile")["Rating"].agg(rows="size", distinct_ratings="nunique")
    repeated = profile_table[profile_table["rows"] > 1]

    return {"exact_duplicate_rows": exact_duplicates,
            "duplicate_rows_excluding_participant_id": duplicates_excluding_id,
            "repeated_profile_groups": int(len(repeated)),
            "rows_in_repeated_profiles": int(repeated["rows"].sum()),
            "extra_repeated_rows": int((repeated["rows"] - 1).sum()),
            "repeated_profiles_with_conflicting_ratings": int((repeated["distinct_ratings"] > 1).sum()),
            "missing_cells": int(df.isna().sum().sum()),
            "note": "The text 'None' in CommunityInvolvement and PhysicalActivities is a real category, not a missing value."}


def build_analytics(df=None):
    """Return a JSON-ready dictionary of dataset statistics."""
    if df is None:
        df = load_dataset()
    features, y_class, _ = prepare_features_and_targets(df)

    # 1. Rating distributions (original 1-5 scale and the Low/Medium/High target)
    rating_distribution = count_table(df["Rating"], order=[1, 2, 3, 4, 5])
    rating_distribution = [{"rating": int(item["value"]), "count": item["count"], "percent": item["percent"]}
                           for item in rating_distribution]
    class_distribution = [{"class": item["value"], "count": item["count"], "percent": item["percent"]}
                          for item in count_table(y_class, order=CLASS_ORDER)]

    # 2. Lifestyle (categorical) distributions, and how the classes split inside each category
    categorical_distributions = {}
    class_share_by_category = {}
    for feature in CATEGORICAL_FEATURES:
        categorical_distributions[feature] = count_table(features[feature])
        share_table = pd.crosstab(features[feature], y_class).reindex(columns=CLASS_ORDER, fill_value=0)
        rows = []
        for category_value, row in share_table.iterrows():
            group_size = int(row.sum())
            entry = {"value": str(category_value), "rows": group_size}
            for class_name in CLASS_ORDER:
                entry[class_name] = round(100 * int(row[class_name]) / group_size, 1)
            rows.append(entry)
        class_share_by_category[feature] = rows

    # 3. Numerical features: summary statistics, histograms (20 bins like the original charts)
    numeric_summaries = {}
    for feature in NUMERIC_FEATURES:
        values = features[feature]
        numeric_summaries[feature] = {"min": float(values.min()), "p25": float(values.quantile(0.25)),
                                      "median": float(values.median()), "mean": round(float(values.mean()), 2),
                                      "p75": float(values.quantile(0.75)), "max": float(values.max()),
                                      "std": round(float(values.std()), 2)}
    numeric_histograms = {}
    for feature in ["Age", "HomeSize", "MonthlyElectricityConsumption", "MonthlyWaterConsumption"]:
        counts, bin_edges = np.histogram(features[feature], bins=20)
        numeric_histograms[feature] = {"bin_edges": [round(float(edge), 2) for edge in bin_edges],
                                       "counts": [int(count) for count in counts]}
    awareness_distribution = [{"value": int(item["value"]), "count": item["count"], "percent": item["percent"]}
                              for item in count_table(features["EnvironmentalAwareness"], order=[1, 2, 3, 4, 5])]

    # 4. Pearson correlations between the numerical features and the numeric Rating
    correlation_columns = NUMERIC_FEATURES + ["Rating"]
    correlation_matrix = df[correlation_columns].corr()
    correlations = {"method": "pearson", "labels": correlation_columns,
                    "matrix": [[round(float(value), 4) for value in row] for row in correlation_matrix.values],
                    "note": "Correlation shows how numbers move together in this sample. It does not show cause and effect, "
                            "and it ignores the categorical features."}

    return {"overview": {"rows": int(len(df)), "columns_in_file": int(df.shape[1]),
                         "model_features": len(FEATURE_COLUMNS), "numerical_features": NUMERIC_FEATURES,
                         "categorical_features": CATEGORICAL_FEATURES,
                         "target_mapping": "Rating 1-2 = Low, 3 = Medium, 4-5 = High"},
            "rating_distribution": rating_distribution,
            "class_distribution": class_distribution,
            "categorical_distributions": categorical_distributions,
            "class_share_by_category": class_share_by_category,
            "numeric_summaries": numeric_summaries,
            "numeric_histograms": numeric_histograms,
            "environmental_awareness_distribution": awareness_distribution,
            "correlations": correlations,
            "recommendation_thresholds": {**DATASET_THRESHOLDS,
                                          "note": "Median and 75th percentile of this dataset, not universal standards."},
            "data_quality": build_data_quality(df, features),
            "notes": ["All numbers are calculated from the dataset file when this endpoint is called.",
                      "Gender and ParticipantID are not part of the 17 model features and are not reported here."]}
