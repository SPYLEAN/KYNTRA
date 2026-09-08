"""Tests for mathematical power curves and regulation provenance."""

import pytest
from kyntra.regulations.loader import RegulationConfigError, load_fia_2026_config
from kyntra.regulations.models import FIARegulationConfig, PowerCurveConfig


def test_provenance_verification():
    """Verify regulation config includes verified official documentation metadata (Issue 20 / Issue 08)."""
    config = load_fia_2026_config()
    assert config.verify_provenance() is True
    prov = config.provenance
    assert prov is not None
    assert "FIA 2026 F1 Regulations Section C — Technical" in prov.document
    assert "Issue 20" in prov.issue
    assert "2026-08-05" in prov.publication_date
    assert "FIA 2026 F1 Regulations Section B — Sporting" in (prov.sporting_document or "")
    assert "Issue 08" in (prov.sporting_issue or "")
    assert "https://www.fia.com/regulation/category/110" in prov.source_url
    assert any("C5.2.7" in art for art in prov.articles)
    assert any("C5.2.9" in art for art in prov.articles)
    assert any("C5.2.8(i)" in art for art in prov.articles)
    assert any("C5.2.8(ii)" in art for art in prov.articles)
    assert any("C5.2.10" in art for art in prov.articles)


def test_unverified_provenance_fails_explicitly():
    """Verify loader fails explicitly when provenance cannot be verified."""
    bad_cfg = FIARegulationConfig(
        name="Test",
        version="1.0",
        normal_power_curve=PowerCurveConfig(
            curve_type="two_stage_piecewise",
            base_power_kw=350.0,
        ),
        overtake_power_curve=PowerCurveConfig(
            curve_type="overtake_piecewise",
            base_power_kw=350.0,
        ),
        provenance=None,  # Missing provenance
    )
    assert bad_cfg.verify_provenance() is False


def test_normal_curve_two_stage_piecewise_formula():
    """Verify two-stage mathematical equation for Normal Power Curve (Article C5.2.8(i)).

    For v < 340 km/h:
        P(kW) = 1800 - 5*v (subject to 0 <= P <= 350 kW)
    For 340 <= v < 345 km/h:
        P(kW) = 6900 - 20*v (subject to 0 <= P <= 350 kW)
    For v >= 345 km/h:
        P = 0
    """
    config = load_fia_2026_config()
    curve = config.normal_power_curve

    # Plateau up to 290 km/h: 1800 - 5(290) = 350 kW
    assert curve.get_max_power_at_speed(0.0) == 350.0
    assert curve.get_max_power_at_speed(200.0) == 350.0
    assert curve.get_max_power_at_speed(290.0) == 350.0

    # Required boundary tests:
    # 300 km/h: 1800 - 5*(300) = 300.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(300.0), rel=1e-4) == 300.0

    # 315 km/h: 1800 - 5*(315) = 225.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(315.0), rel=1e-4) == 225.0

    # 339.9 km/h: 1800 - 5*(339.9) = 100.5 kW
    assert pytest.approx(curve.get_max_power_at_speed(339.9), rel=1e-4) == 100.5

    # 340 km/h: 6900 - 20*(340) = 100.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(340.0), rel=1e-4) == 100.0

    # 342 km/h: 6900 - 20*(342) = 60.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(342.0), rel=1e-4) == 60.0

    # 344.9 km/h: 6900 - 20*(344.9) = 2.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(344.9), rel=1e-4) == 2.0

    # 345 km/h: exactly 0.0 kW
    assert curve.get_max_power_at_speed(345.0) == 0.0

    # Speeds above 345 km/h: exactly 0.0 kW
    assert curve.get_max_power_at_speed(350.0) == 0.0


def test_overtake_curve_piecewise_formula():
    """Verify mathematical equation for Overtake Power Curve (Article C5.2.8(ii)).

    For v < 355 km/h:
        P(kW) = 7100 - 20*v (subject to 0 <= P <= 350 kW)
    For v >= 355 km/h:
        P = 0
    """
    config = load_fia_2026_config()
    curve = config.overtake_power_curve

    # Plateau up to 337.5 km/h: 7100 - 20*(337.5) = 350 kW
    assert curve.get_max_power_at_speed(320.0) == 350.0
    assert curve.get_max_power_at_speed(337.0) == 350.0
    assert curve.get_max_power_at_speed(337.5) == 350.0

    # Required boundary tests:
    # 340 km/h: 7100 - 20*(340) = 300.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(340.0), rel=1e-4) == 300.0

    # 350 km/h: 7100 - 20*(350) = 100.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(350.0), rel=1e-4) == 100.0

    # 354.9 km/h: 7100 - 20*(354.9) = 2.0 kW
    assert pytest.approx(curve.get_max_power_at_speed(354.9), rel=1e-4) == 2.0

    # 355 km/h: exactly 0.0 kW
    assert curve.get_max_power_at_speed(355.0) == 0.0

    # Above 355 km/h: exactly 0.0 kW
    assert curve.get_max_power_at_speed(360.0) == 0.0

