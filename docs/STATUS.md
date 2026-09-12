# KYNTRA Project Status

> **Status Updated:** 2026-09-12 10:35:00 UTC  
> **Phase 00 Baseline:** LOCKED & VERIFIED  

## Quick Reference Summary

| Subsystem | Status | Details |
| :--- | :---: | :--- |
| **Git Baseline** | `0d86248` | `main` branch, matches `origin/main` commit HEAD; uncommitted local working tree has 10 modified & 19 untracked items |
| **Frozen LightGBM Bundle** | **VERIFIED** | `models/kyntra_overtake_bundle_v1.joblib`<br>SHA-256: `a368b02089c65e6043c04a2f4d132ccaacfd644c545e4d7958e49420e50b3ad5` |
| **Dataset (8,357 rows)** | **VERIFIED** | `data/processed/kyntra_overtake_dataset.parquet`<br>78 columns, 1,656 battles, 0 duplicates, isolated demo holdouts |
| **Backend Tests** | **103 / 103 PASS** | `pytest tests -v` in Python 3.12 (43.86s, 100% pass rate) |
| **Frontend Production Build** | **PASS (0 ERRORS)** | `npm run build` in `web/` (Vite v8.2.2 + TypeScript, 1.34s) |
| **FIA 2026 Engine Rules** | **VERIFIED** | Articles C5.2.7 (350kW), C5.2.8(i)/(ii) (curves), C5.2.9 (4MJ), C5.2.10 (8.5MJ) |
| **OpenF1 Live Ingestion** | **VERIFIED** | `OpenF1LiveProvider` behind `BaseDataProvider` with multi-channel normalization |
| **Session Capture & Replay** | **VERIFIED** | `SessionCaptureWriter` & `SessionCaptureReader` (.jsonl) with deterministic seek |
| **Workstation UI** | **VERIFIED** | React 19 + Vite, 6 workspaces, 3 presets, 0px page scroll |

## Next Phase
- **KYNTRA 3.0 / God-Mode Workstation** (dedicated workspace toggle preserving all existing layers).
