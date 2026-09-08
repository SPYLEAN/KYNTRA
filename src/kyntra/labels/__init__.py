"""Tactical label generation modules for KYNTRA."""

from kyntra.labels.overtakes import (
    LABEL_SOURCE,
    LABEL_VERSION,
    OvertakeEvent,
    compute_multi_horizon_labels_and_censoring,
    compute_position_retention_labels,
    detect_race_overtakes,
)

__all__ = [
    "OvertakeEvent",
    "detect_race_overtakes",
    "compute_multi_horizon_labels_and_censoring",
    "compute_position_retention_labels",
    "LABEL_SOURCE",
    "LABEL_VERSION",
]
