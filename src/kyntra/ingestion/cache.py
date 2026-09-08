"""Cache management for FastF1 data ingestion."""

from pathlib import Path
from typing import Optional, Union
import logging
import fastf1

logger = logging.getLogger(__name__)


def get_default_cache_dir() -> Path:
    """Resolve the default cache path at data/cache relative to project root."""
    # This file is at src/kyntra/ingestion/cache.py -> project root is 3 levels up
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    cache_dir = project_root / "data" / "cache"
    return cache_dir


def configure_cache(cache_dir: Optional[Union[str, Path]] = None) -> Path:
    """Configure and enable the FastF1 disk cache.

    Args:
        cache_dir: Directory path for caching downloaded FastF1 data.
                   Defaults to project's data/cache/ directory.

    Returns:
        Path: Resolved Path object of the enabled cache directory.

    Raises:
        RuntimeError: If cache directory cannot be created or accessed.
    """
    if cache_dir is None:
        resolved_dir = get_default_cache_dir()
    else:
        resolved_dir = Path(cache_dir).resolve()

    try:
        resolved_dir.mkdir(parents=True, exist_ok=True)
        # FastF1 enable_cache accepts string or path-like
        fastf1.Cache.enable_cache(str(resolved_dir))
        logger.info("FastF1 cache enabled at: %s", resolved_dir)
    except Exception as exc:
        raise RuntimeError(
            f"Failed to configure FastF1 cache at '{resolved_dir}': {exc}"
        ) from exc

    return resolved_dir
