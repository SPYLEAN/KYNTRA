"""KYNTRA Digital Track Twin Geometry Generator.

Extracts normalized 2D vector coordinate track geometry from real telemetry X/Y
channels across verified demo circuits (Monza, Albert Park, Miami, Suzuka).
Provides path data and progress interpolation for real-time car positioning.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from kyntra.processing.replay_loader import DEMO_DIR, EVENT_INFO

_TRACK_CACHE: Dict[str, Dict[str, Any]] = {}


def get_circuit_geometry(event_id: str) -> Dict[str, Any]:
    """Retrieve normalized SVG vector path and track interpolation points for an event."""
    if event_id in _TRACK_CACHE:
        return _TRACK_CACHE[event_id]

    if event_id not in EVENT_INFO:
        event_id = "2026_13_ITA"

    file_path = DEMO_DIR / EVENT_INFO[event_id]["file"]
    if not file_path.exists():
        return _build_fallback_geometry(event_id)

    try:
        df = pd.read_parquet(file_path)
        # Select representative clean lap (e.g. lap 2 or 3)
        lap_candidates = [2, 3, 4, 1]
        sample_df = pd.DataFrame()
        for lap_num in lap_candidates:
            subset = df[(df["lap"] == lap_num) & pd.notna(df["X"]) & pd.notna(df["Y"])]
            if not subset.empty and len(subset) >= 40:
                # Group by first available driver
                drv = subset["driver"].iloc[0]
                sample_df = subset[subset["driver"] == drv].copy()
                break

        if sample_df.empty:
            return _build_fallback_geometry(event_id)

        sample_df = sample_df.sort_values(by="Distance" if "Distance" in sample_df.columns else "Time")
        xs = sample_df["X"].values
        ys = sample_df["Y"].values

        # Normalize to 1000 x 600 canvas preserving aspect ratio
        min_x, max_x = float(np.min(xs)), float(np.max(xs))
        min_y, max_y = float(np.min(ys)), float(np.max(ys))

        span_x = max(1.0, max_x - min_x)
        span_y = max(1.0, max_y - min_y)

        # Target box: padding of 50px inside 1000 x 600
        box_w, box_h = 900.0, 500.0
        scale = min(box_w / span_x, box_h / span_y)

        # Center in canvas
        offset_x = 50.0 + (box_w - span_x * scale) / 2.0
        offset_y = 50.0 + (box_h - span_y * scale) / 2.0

        norm_points: List[Dict[str, float]] = []
        n_pts = len(xs)
        for i in range(n_pts):
            # Invert Y for standard SVG coordinate space
            nx = round(offset_x + (xs[i] - min_x) * scale, 1)
            ny = round(offset_y + (max_y - ys[i]) * scale, 1)
            progress = round(i / max(1, n_pts - 1), 4)
            norm_points.append({"x": nx, "y": ny, "progress": progress})

        # Build SVG path string
        if norm_points:
            path_parts = [f"M {norm_points[0]['x']} {norm_points[0]['y']}"]
            for pt in norm_points[1:]:
                path_parts.append(f"L {pt['x']} {pt['y']}")
            path_parts.append("Z")
            svg_path = " ".join(path_parts)
        else:
            svg_path = "M 200 300 L 800 300 Z"

        geo = {
            "available": True,
            "is_fallback": False,
            "event_id": event_id,
            "circuit_name": EVENT_INFO[event_id]["circuit"],
            "view_box": "0 0 1000 600",
            "path_d": svg_path,
            "points": norm_points,
            "sector_markers": [
                {"sector": 1, "progress": 0.33},
                {"sector": 2, "progress": 0.66},
                {"sector": 3, "progress": 1.00},
            ],
            "activation_line_progress": 0.82,
            "detection_line_progress": 0.79,
        }
        _TRACK_CACHE[event_id] = geo
        return geo

    except Exception:
        return _build_fallback_geometry(event_id)


def _build_fallback_geometry(event_id: str) -> Dict[str, Any]:
    """Fallback geometry marked as unavailable when parquet parsing fails."""
    # Retain parametric points for coordinate interpolation safety if called, but flag unavailable
    svg_path = "M 200 150 L 800 150 A 150 150 0 0 1 800 450 L 200 450 A 150 150 0 0 1 200 150 Z"
    points = []
    for i in range(100):
        frac = i / 100.0
        if frac < 0.35:
            x = 200.0 + (frac / 0.35) * 600.0
            y = 150.0
        elif frac < 0.50:
            theta = (frac - 0.35) / 0.15 * np.pi
            x = 800.0 + 150.0 * np.sin(theta)
            y = 300.0 - 150.0 * np.cos(theta)
        elif frac < 0.85:
            x = 800.0 - ((frac - 0.50) / 0.35) * 600.0
            y = 450.0
        else:
            theta = (frac - 0.85) / 0.15 * np.pi
            x = 200.0 - 150.0 * np.sin(theta)
            y = 300.0 + 150.0 * np.cos(theta)
        points.append({"x": round(x, 1), "y": round(y, 1), "progress": round(frac, 4)})

    return {
        "available": False,
        "is_fallback": True,
        "message": "CIRCUIT GEOMETRY UNAVAILABLE — Telemetry positional channels missing.",
        "event_id": event_id,
        "circuit_name": EVENT_INFO.get(event_id, {}).get("circuit", "Circuit"),
        "view_box": "0 0 1000 600",
        "path_d": svg_path,
        "points": points,
        "sector_markers": [
            {"sector": 1, "progress": 0.33},
            {"sector": 2, "progress": 0.66},
            {"sector": 3, "progress": 1.00},
        ],
        "activation_line_progress": 0.82,
        "detection_line_progress": 0.79,
    }


def interpolate_car_position(progress: float, event_id: str) -> Tuple[float, float]:
    """Given lap progress in [0.0, 1.0], return normalized (x, y) coordinates."""
    geo = get_circuit_geometry(event_id)
    pts = geo["points"]
    if not pts:
        return (500.0, 300.0)

    p = max(0.0, min(1.0, progress))
    # Binary search or index lookup
    idx = int(p * (len(pts) - 1))
    pt = pts[min(idx, len(pts) - 1)]
    return (pt["x"], pt["y"])
