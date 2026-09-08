"""Track status parsing utility for KYNTRA.

Per FIA timing specification:
- '1': Track Clear
- '2': Yellow Flag
- '4': Safety Car Deployed
- '5': Red Flag
- '6': Virtual Safety Car Deployed
- '7': Virtual Safety Car Ending

IMPORTANT:
Composite strings (e.g. '12', '21') reflect raw multi-flag / transition events
in official telemetry feeds. They must NEVER be semantically guessed as 'DRS enabled'
or 'Double Yellow'. DRS and 2026 Overtake eligibility must never be inferred
from TrackStatus.
"""

from typing import Dict, List, Optional, Set

FIA_TRACK_STATUS_CODES: Dict[str, str] = {
    "1": "Track Clear",
    "2": "Yellow Flag",
    "4": "Safety Car",
    "5": "Red Flag",
    "6": "Virtual Safety Car",
    "7": "Virtual Safety Car Ending",
}


def parse_track_status_codes(raw_status: Optional[str]) -> List[str]:
    """Extract individual FIA track status flag digits from raw status string.

    Preserves raw status provenance and decomposes into recognized FIA flag codes
    without inventing composite meanings.

    Args:
        raw_status: Raw string from telemetry (e.g. '1', '12', '21', '4').

    Returns:
        List[str]: Distinct recognized status digits found, in order of appearance.
    """
    if raw_status is None:
        return []

    status_str = str(raw_status).strip()
    if not status_str or status_str == "nan":
        return []

    seen: Set[str] = set()
    found: List[str] = []
    for char in status_str:
        if char in FIA_TRACK_STATUS_CODES and char not in seen:
            seen.add(char)
            found.append(char)

    return found


def is_safety_car_active(raw_status: Optional[str]) -> bool:
    """Determine whether Full Safety Car or Virtual Safety Car is active.

    Returns True if code '4' (SC) or '6' (VSC) is present.
    """
    codes = parse_track_status_codes(raw_status)
    return any(c in ("4", "6") for c in codes)


def is_yellow_flag_active(raw_status: Optional[str]) -> bool:
    """Determine whether a Yellow Flag condition ('2') is active."""
    return "2" in parse_track_status_codes(raw_status)


def is_red_flag_active(raw_status: Optional[str]) -> bool:
    """Determine whether a Red Flag condition ('5') is active."""
    return "5" in parse_track_status_codes(raw_status)


def is_track_clear(raw_status: Optional[str]) -> bool:
    """Determine whether the track is strictly Clear ('1') with no caution flags."""
    codes = parse_track_status_codes(raw_status)
    if not codes:
        return False
    # If yellow, red, or safety car is present, track is not clear
    has_caution = any(c in ("2", "4", "5", "6") for c in codes)
    return ("1" in codes) and (not has_caution)


class TrackStatusParser:
    """Convenience helper for FIA track status evaluations."""

    @staticmethod
    def is_neutralized(raw_status: Optional[str]) -> bool:
        """Determine whether race is neutralized (SC, VSC, or Red Flag)."""
        return is_safety_car_active(raw_status) or is_red_flag_active(raw_status)

    @staticmethod
    def parse(raw_status: Optional[str]) -> List[str]:
        return parse_track_status_codes(raw_status)

