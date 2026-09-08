"""Tests for cache configuration."""

from pathlib import Path
from unittest.mock import patch
from kyntra.ingestion.cache import configure_cache, get_default_cache_dir


def test_get_default_cache_dir():
    """Verify default cache directory points to data/cache."""
    cache_dir = get_default_cache_dir()
    assert isinstance(cache_dir, Path)
    assert cache_dir.parts[-2:] == ("data", "cache")


def test_configure_cache_custom_dir(tmp_path):
    """Verify configure_cache creates directory and calls fastf1.Cache.enable_cache."""
    custom_cache = tmp_path / "custom_cache"
    with patch("fastf1.Cache.enable_cache") as mock_enable:
        resolved = configure_cache(custom_cache)
        assert resolved == custom_cache.resolve()
        assert custom_cache.exists()
        mock_enable.assert_called_once_with(str(custom_cache.resolve()))
