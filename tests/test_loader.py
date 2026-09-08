"""Tests for race session loader."""

from unittest.mock import MagicMock, patch
import pandas as pd
import pytest
from kyntra.ingestion.loader import SessionLoadError, load_session


def test_load_session_argument_validation():
    """Verify load_session rejects invalid arguments."""
    with pytest.raises(ValueError, match="Invalid championship year"):
        load_session(year=1940, grand_prix="Bahrain")

    with pytest.raises(ValueError, match="grand_prix parameter cannot be empty"):
        load_session(year=2024, grand_prix="")

    with pytest.raises(ValueError, match="session_type parameter cannot be empty"):
        load_session(year=2024, grand_prix="Bahrain", session_type="")


@patch("fastf1.get_session")
@patch("kyntra.ingestion.loader.configure_cache")
def test_load_session_success(mock_cache, mock_get_session, mock_fastf1_session):
    """Verify load_session calls fastf1.get_session and loads laps."""
    mock_get_session.return_value = mock_fastf1_session

    session = load_session(year=2024, grand_prix="Bahrain", session_type="R")
    assert session == mock_fastf1_session
    mock_get_session.assert_called_once_with(2024, "Bahrain", "R")
    mock_fastf1_session.load.assert_called_once_with(
        laps=True, telemetry=False, weather=False, messages=False
    )


@patch("fastf1.get_session")
@patch("kyntra.ingestion.loader.configure_cache")
def test_load_session_failure_propagation(mock_cache, mock_get_session):
    """Verify load_session raises SessionLoadError when FastF1 fails."""
    mock_get_session.side_effect = RuntimeError("FastF1 backend unavailable")

    with pytest.raises(SessionLoadError, match="Failed to identify session"):
        load_session(year=2024, grand_prix="NonExistentGP", session_type="R")


@patch("fastf1.get_session")
@patch("kyntra.ingestion.loader.configure_cache")
def test_load_session_empty_laps(mock_cache, mock_get_session):
    """Verify load_session raises SessionLoadError if no laps returned."""
    mock_session = MagicMock()
    mock_session.laps = pd.DataFrame()
    mock_get_session.return_value = mock_session

    with pytest.raises(SessionLoadError, match="contains no lap records"):
        load_session(year=2024, grand_prix="Bahrain", session_type="R")
