"""Tests for official event configuration and regulatory hierarchy."""

import pytest
from kyntra.regulations.compliance import ComplianceReason, check_recharge_limit
from kyntra.regulations.loader import load_event_config, load_fia_2026_config
from kyntra.regulations.models import EventRegulationConfig


def test_load_australia_event_config():
    """Verify loading configs/events/2026_australia.yaml and verifying parameters."""
    event_cfg = load_event_config("2026_australia")
    assert isinstance(event_cfg, EventRegulationConfig)
    assert event_cfg.name == "Australian Grand Prix"
    assert event_cfg.year == 2026
    assert event_cfg.round == 1

    # Document 6 Provenance
    assert event_cfg.provenance is not None
    assert "Document 6" in event_cfg.provenance.document
    assert event_cfg.provenance.publication_date == "2026-03-05"

    # Detection Gap = 1.0s
    assert event_cfg.detection_gap_seconds == 1.0

    # Detection Line with TBC Preservation
    assert event_cfg.detection_line.distance_m == 4650.0
    assert event_cfg.detection_line.loop == "L21"
    assert event_cfg.detection_line.source_status == "TBC_IN_FIA_DOCUMENT"  # MUST NOT be converted to VERIFIED

    # Activation Line
    assert event_cfg.activation_line.distance_m == 4713.0
    assert event_cfg.activation_line.loop == "L22_SC1"
    assert event_cfg.activation_line.source_status == "VERIFIED"

    # Event Recharge Limits
    assert event_cfg.race_recharge_limit_mj.overtake_inactive == 8.0
    assert event_cfg.race_recharge_limit_mj.overtake_active == 8.5
    assert event_cfg.qualifying_recharge_limit_mj == 7.0

    # Power reduction rate limit
    assert event_cfg.power_reduction_rate_limit_kw_per_s == 50.0


def test_regulatory_hierarchy_recharge_limit():
    """Verify regulatory override hierarchy: Global -> Event -> Current Race State."""
    global_cfg = load_fia_2026_config()
    event_cfg = load_event_config("2026_australia")

    # 1. Global FIA regulation baseline (no event overrides applied)
    assert global_cfg.get_effective_recharge_limit_mj(is_overtake_active=False) == 8.5
    assert global_cfg.get_effective_recharge_limit_mj(is_overtake_active=True) == 8.5

    # 2. Apply Event-Specific Configuration
    global_cfg.apply_event_config(event_cfg)

    # 3. Australia Event: Overtake Inactive -> 8.0 MJ
    assert global_cfg.get_effective_recharge_limit_mj(is_overtake_active=False) == 8.0

    # 4. Australia Event: Overtake Active -> 8.5 MJ
    assert global_cfg.get_effective_recharge_limit_mj(is_overtake_active=True) == 8.5

    # Detection gap is overridden from event config
    assert global_cfg.detection_gap == 1.0
    assert "L21" in (global_cfg.detection_line or "")


def test_event_aware_compliance_recharge_checks():
    """Verify check_recharge_limit behaves differently depending on event config and overtake state."""
    global_cfg = load_fia_2026_config()
    event_cfg = load_event_config("2026_australia")
    global_cfg.apply_event_config(event_cfg)

    # Proposed 8.2 MJ total harvest:
    # Under Australia with Overtake INACTIVE (8.0 MJ limit) -> should be BLOCKED
    res_inactive = check_recharge_limit(
        config=global_cfg,
        proposed_harvest_mj=3.2,
        current_lap_harvested_mj=5.0,  # total 8.2 MJ
        is_overtake_active=False,
    )
    assert not res_inactive.is_compliant
    assert res_inactive.reason == ComplianceReason.RECHARGE_LIMIT_EXCEEDED
    assert res_inactive.max_permitted_value == 8.0

    # Under Australia with Overtake ACTIVE (8.5 MJ limit) -> should be ALLOWED
    res_active = check_recharge_limit(
        config=global_cfg,
        proposed_harvest_mj=3.2,
        current_lap_harvested_mj=5.0,  # total 8.2 MJ
        is_overtake_active=True,
    )
    assert res_active.is_compliant
    assert res_active.reason == ComplianceReason.ALLOWED
    assert res_active.max_permitted_value == 8.5
