"""Comprehensive tests for KYNTRA V1 overtake inference engine.

Validates:
1. Model loading from bundle
2. Missing required field validation
3. NaN feature handling (LightGBM native missing support)
4. Probability bounds [0, 1]
5. Raw inference shape
6. Monotonic projection:
   - Already-monotonic predictions unchanged
   - P1 > P2 corrected
   - P2 > P3 corrected
   - All-descending vector corrected
   - Final P1 <= P2 <= P3 for every inference
   - Deterministic repeatability
"""

import numpy as np
import pandas as pd
import pytest

from kyntra.models import (
    KyntraOvertakeModelV1,
    REQUIRED_FEATURES,
    get_overtake_model,
    project_monotonic_3,
)


@pytest.fixture(scope="module")
def model():
    """Load model singleton for test suite."""
    return get_overtake_model()


def test_model_loading(model):
    """Test that model bundle loads cleanly with all 3 horizon models and metadata."""
    assert model is not None
    assert 1 in model.models
    assert 2 in model.models
    assert 3 in model.models
    assert model.features == REQUIRED_FEATURES
    assert model.MODEL_NAME == "KYNTRA Overtake Intelligence V1"
    assert model.MODEL_VERSION == "1.0.0"


def test_missing_required_field(model):
    """Test ValueError raised when any of the 5 required features is missing."""
    # Omit speed_trap_delta
    incomplete_input = {
        "gap_seconds": 0.85,
        "closing_rate": 0.42,
        "recent_pace_delta_1lap": -0.35,
        "recent_pace_delta_3laps": -0.28,
    }
    with pytest.raises(ValueError, match="Missing required features"):
        model.predict_one(incomplete_input)

    incomplete_df = pd.DataFrame([incomplete_input])
    with pytest.raises(ValueError, match="Missing required features"):
        model.predict_batch(incomplete_df)


def test_nan_feature_handling(model):
    """Test LightGBM handles NaN features natively without failing."""
    # Input with NaN in closing_rate and speed_trap_delta
    sample_with_nans = {
        "gap_seconds": 1.15,
        "closing_rate": np.nan,
        "recent_pace_delta_1lap": -0.20,
        "recent_pace_delta_3laps": -0.15,
        "speed_trap_delta": np.nan,
    }
    pred = model.predict_one(sample_with_nans)

    assert "closing_rate" in pred.feature_missingness
    assert "speed_trap_delta" in pred.feature_missingness
    assert 0.0 <= pred.p_pass_1_lap <= 1.0
    assert 0.0 <= pred.p_pass_2_laps <= 1.0
    assert 0.0 <= pred.p_pass_3_laps <= 1.0
    assert pred.p_pass_1_lap <= pred.p_pass_2_laps <= pred.p_pass_3_laps


def test_probability_bounds(model):
    """Test all predicted probabilities are strictly bounded in [0, 1]."""
    test_cases = [
        {"gap_seconds": 0.2, "closing_rate": 2.5, "recent_pace_delta_1lap": -1.5, "recent_pace_delta_3laps": -1.2, "speed_trap_delta": 15.0},
        {"gap_seconds": 4.5, "closing_rate": -1.2, "recent_pace_delta_1lap": 1.2, "recent_pace_delta_3laps": 1.5, "speed_trap_delta": -12.0},
        {"gap_seconds": 0.05, "closing_rate": 5.0, "recent_pace_delta_1lap": -3.0, "recent_pace_delta_3laps": -2.8, "speed_trap_delta": 30.0},
    ]
    for obs in test_cases:
        pred = model.predict_one(obs)
        assert 0.0 <= pred.p_pass_1_lap_raw <= 1.0
        assert 0.0 <= pred.p_pass_2_laps_raw <= 1.0
        assert 0.0 <= pred.p_pass_3_laps_raw <= 1.0
        assert 0.0 <= pred.p_pass_1_lap <= 1.0
        assert 0.0 <= pred.p_pass_2_laps <= 1.0
        assert 0.0 <= pred.p_pass_3_laps <= 1.0
        assert pred.p_pass_1_lap <= pred.p_pass_2_laps <= pred.p_pass_3_laps


def test_raw_inference_shape(model):
    """Test batch prediction returns matching length list of predictions."""
    df = pd.DataFrame([
        {"gap_seconds": 0.5, "closing_rate": 0.8, "recent_pace_delta_1lap": -0.5, "recent_pace_delta_3laps": -0.4, "speed_trap_delta": 8.0},
        {"gap_seconds": 1.2, "closing_rate": 0.1, "recent_pace_delta_1lap": -0.1, "recent_pace_delta_3laps": -0.1, "speed_trap_delta": 2.0},
        {"gap_seconds": 2.5, "closing_rate": -0.3, "recent_pace_delta_1lap": 0.2, "recent_pace_delta_3laps": 0.3, "speed_trap_delta": -4.0},
    ])
    preds = model.predict_batch(df)
    assert len(preds) == 3
    for p in preds:
        assert p.p_pass_1_lap <= p.p_pass_2_laps <= p.p_pass_3_laps


def test_monotonic_projection_already_monotonic():
    """Already-monotonic predictions must be returned unchanged."""
    raw = [0.08, 0.15, 0.22]
    projected = project_monotonic_3(raw)
    np.testing.assert_allclose(projected, raw, atol=1e-12)


def test_monotonic_projection_p1_greater_p2():
    """Test correction when P1 > P2."""
    raw = [0.30, 0.20, 0.40]
    projected = project_monotonic_3(raw)
    expected = [0.25, 0.25, 0.40]
    np.testing.assert_allclose(projected, expected, atol=1e-12)
    assert projected[0] <= projected[1] <= projected[2]


def test_monotonic_projection_p2_greater_p3():
    """Test correction when P2 > P3."""
    raw = [0.10, 0.50, 0.30]
    projected = project_monotonic_3(raw)
    expected = [0.10, 0.40, 0.40]
    np.testing.assert_allclose(projected, expected, atol=1e-12)
    assert projected[0] <= projected[1] <= projected[2]


def test_monotonic_projection_all_descending():
    """Test correction when all 3 horizons are descending (P1 > P2 > P3)."""
    raw = [0.40, 0.30, 0.20]
    projected = project_monotonic_3(raw)
    expected = [0.30, 0.30, 0.30]
    np.testing.assert_allclose(projected, expected, atol=1e-12)
    assert projected[0] <= projected[1] <= projected[2]


def test_final_monotonicity_across_random_grid(model):
    """Verify P1 <= P2 <= P3 holds without exception across 500 synthetic battle scenarios."""
    np.random.seed(42)
    n_samples = 500
    df = pd.DataFrame({
        "gap_seconds": np.random.uniform(0.1, 5.0, n_samples),
        "closing_rate": np.random.uniform(-3.0, 4.0, n_samples),
        "recent_pace_delta_1lap": np.random.uniform(-2.0, 2.0, n_samples),
        "recent_pace_delta_3laps": np.random.uniform(-2.0, 2.0, n_samples),
        "speed_trap_delta": np.random.uniform(-20.0, 25.0, n_samples),
    })
    preds = model.predict_batch(df)
    for i, p in enumerate(preds):
        assert p.p_pass_1_lap <= p.p_pass_2_laps + 1e-9, f"Row {i}: P1 ({p.p_pass_1_lap}) > P2 ({p.p_pass_2_laps})"
        assert p.p_pass_2_laps <= p.p_pass_3_laps + 1e-9, f"Row {i}: P2 ({p.p_pass_2_laps}) > P3 ({p.p_pass_3_laps})"


def test_deterministic_repeatability(model):
    """Test model produces identical bitwise float predictions for identical inputs."""
    sample = {
        "gap_seconds": 0.72,
        "closing_rate": 0.55,
        "recent_pace_delta_1lap": -0.45,
        "recent_pace_delta_3laps": -0.38,
        "speed_trap_delta": 6.5,
    }
    pred_a = model.predict_one(sample)
    pred_b = model.predict_one(sample)

    assert pred_a.p_pass_1_lap == pred_b.p_pass_1_lap
    assert pred_a.p_pass_2_laps == pred_b.p_pass_2_laps
    assert pred_a.p_pass_3_laps == pred_b.p_pass_3_laps
    assert pred_a.p_pass_1_lap_raw == pred_b.p_pass_1_lap_raw
    assert pred_a.projection_applied == pred_b.projection_applied
