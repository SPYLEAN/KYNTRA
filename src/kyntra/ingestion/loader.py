"""Race session loader module using FastF1."""

import logging
from pathlib import Path
from typing import Optional, Union
import fastf1
from fastf1.core import Session
from kyntra.ingestion.cache import configure_cache

logger = logging.getLogger(__name__)


class SessionLoadError(Exception):
    """Raised when an F1 session fails to load or validate."""


def load_session(
    year: int,
    grand_prix: str,
    session_type: str = "R",
    cache_dir: Optional[Union[str, Path]] = None,
    load_telemetry: bool = False,
    load_weather: bool = False,
) -> Session:
    """Load a Formula 1 session via FastF1 with disk caching.

    Args:
        year: Championship season year (e.g., 2024).
        grand_prix: Name of Grand Prix or round number (e.g., 'Bahrain' or 1).
        session_type: Session identifier ('R' for Race, 'Q' for Qualifying, etc.).
        cache_dir: Optional custom path to FastF1 cache directory.
        load_telemetry: Whether to load full car telemetry (default False for Phase 1).
        load_weather: Whether to load weather data (default False for Phase 1).

    Returns:
        fastf1.core.Session: The fully loaded FastF1 Session object.

    Raises:
        ValueError: If arguments are invalid.
        SessionLoadError: If the session cannot be retrieved or contains no lap data.
    """
    if not isinstance(year, int) or year < 1950:
        raise ValueError(f"Invalid championship year: {year}")
    if not grand_prix:
        raise ValueError("grand_prix parameter cannot be empty")
    if not session_type:
        raise ValueError("session_type parameter cannot be empty")

    # Ensure cache is activated before requesting session
    configure_cache(cache_dir=cache_dir)

    logger.info(
        "Requesting FastF1 session: Year=%d, GrandPrix='%s', Session='%s'",
        year,
        grand_prix,
        session_type,
    )

    try:
        session: Session = fastf1.get_session(year, grand_prix, session_type)
    except Exception as exc:
        raise SessionLoadError(
            f"Failed to identify session for Year={year}, GrandPrix='{grand_prix}', "
            f"Session='{session_type}': {exc}"
        ) from exc

    try:
        session.load(
            laps=True,
            telemetry=load_telemetry,
            weather=load_weather,
            messages=False,
        )
    except Exception as exc:
        raise SessionLoadError(
            f"Failed to download or load session data for {year} {grand_prix} ({session_type}): {exc}"
        ) from exc

    try:
        if session.laps is None or len(session.laps) == 0:
            raise SessionLoadError(
                f"Loaded session {year} {grand_prix} ({session_type}) contains no lap records."
            )
    except fastf1.exceptions.DataNotLoadedError as exc:
        raise SessionLoadError(
            f"Data for {year} {grand_prix} ({session_type}) is not available in FastF1 "
            f"(e.g. session has not occurred yet or official timing data is unavailable): {exc}"
        ) from exc

    logger.info(
        "Successfully loaded %d laps across %d drivers for %s (%s %d)",
        len(session.laps),
        len(session.laps["Driver"].unique()),
        session.event["EventName"],
        session.name,
        session.event.year,
    )

    return session
