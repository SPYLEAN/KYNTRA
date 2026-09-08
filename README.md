# KYNTRA — Predictive Racecraft Intelligence

> **TrackShift Theme:** AI Motorsport Intelligence  
> **Problem Statement:** Energy & Overtake Intelligence  
> *"Should the driver attack the car ahead now, prepare for a better opportunity, hold position, or save resources?"*

KYNTRA is an engineering-first decision intelligence platform for Formula 1 racing. This repository establishes the foundational data, telemetry audit, and regulatory compliance infrastructure for **2026 Energy & Overtake Intelligence**, with zero telemetry fabrication, deterministic rule enforcement, and strict schema validation.

---

## 📁 Repository Structure

```
KYNTRA/
├── configs/
│   └── fia_2026_energy.yaml        # FIA 2026 PU & energy regulations (Issue 20, Articles C5.2.7, C5.2.8(i)/(ii), C5.2.9, C5.2.10)
├── data/
│   ├── cache/                      # FastF1 disk cache directory (offline reliability)
│   ├── processed/
│   │   ├── 2024_bahrain_race_laps.parquet # Validated historical race dataset
│   │   └── 2026_australia_energy_trace.parquet # Simulated 2026 energy trace on real telemetry
│   └── raw/                        # Raw session extracts
├── notebooks/                      # Exploratory and analytical notebooks
├── reports/
│   └── 2026_public_telemetry_audit.md # Complete audit of public vs private telemetry channels
├── scripts/
│   ├── build_race.py               # Main CLI pipeline to load, normalize, validate, and export
│   ├── simulate_australia_2026.py  # Phase 1.2A Energy Simulator over real 2026 telemetry
│   └── inspect_trace.py            # Trace verification & DuckDB analysis
├── src/
│   └── kyntra/
│       ├── __init__.py
│       ├── schemas.py              # Pydantic data & validation schemas
│       ├── energy/
│       │   ├── __init__.py
│       │   ├── actions.py          # TacticalAction policies (CONSERVE, BUILD, DEPLOY, OVERTAKE)
│       │   ├── harvest.py          # MGU-K kinetic & coast recovery model (350kW cap, 8.5MJ ceiling)
│       │   ├── simulator.py        # EnergySimulator V1 (state transitions, clamping, compliance)
│       │   └── state.py            # EnergyState interface & TelemetrySource enum
│       ├── ingestion/
│       │   ├── __init__.py
│       │   ├── cache.py            # FastF1 cache initialization
│       │   ├── loader.py           # Session loader with error handling
│       │   └── telemetry.py        # Raw high-frequency telemetry extraction & dt_s calculation
│       ├── processing/
│       │   ├── __init__.py
│       │   ├── normalizer.py       # Field normalization, timedelta handling, provenance
│       │   ├── track_status.py     # FIA track status flag parser (no semantic guesswork)
│       │   └── validation.py       # Integrity checks & missingness reports
│       ├── regulations/
│       │   ├── __init__.py
│       │   ├── compliance.py       # Deterministic compliance engine scaffold
│       │   ├── loader.py           # Typed YAML regulation loader with provenance
│       │   └── models.py           # Pydantic models for piecewise power curves & limits
│       ├── features/               # (Scaffolded for future phases)
│       └── labels/                 # (Scaffolded for future phases)
├── tests/
│   ├── conftest.py                 # FastF1 mock fixtures
│   ├── test_australia_telemetry.py # 2026 telemetry extraction & dt_s tests
│   ├── test_cache.py               # Cache setup tests
│   ├── test_compliance.py          # Deterministic compliance engine tests (350kW, SC, etc.)
│   ├── test_energy_state.py        # EnergyState model & source provenance tests
│   ├── test_loader.py              # Session loader unit tests
│   ├── test_normalizer.py          # Normalization & schema tests
│   ├── test_power_curve_math.py    # Piecewise FIA power curve mathematical verification
│   ├── test_regulations.py         # FIA 2026 YAML configuration & power curve tests
│   ├── test_simulator.py           # EnergySimulator state transition & clamping tests
│   ├── test_track_status.py        # Track status flag parsing tests
│   └── test_validation.py          # Data quality reporting tests
├── .gitignore                      # Ignore cache, parquet, and bytecode
├── pyproject.toml                  # Packaging and dependencies
└── README.md                       # Documentation
```

---

## 🐍 Python Runtime Recommendation

- **Recommended Development Runtime:** **Python 3.12** is strongly recommended for upcoming ML model training and numerical simulation packages (such as PyTorch / JAX / ONNX).
- **Environment Compatibility:** Currently fully compatible and verified across Python 3.10 through 3.14.

To set up a recommended Python 3.12 environment without disturbing existing systems:

```bash
# Using uv:
uv venv --python 3.12
source .venv/bin/activate  # (or .venv\Scripts\activate on Windows)
uv pip install -e .

# Or using conda:
conda create -n kyntra-py312 python=3.12
conda activate kyntra-py312
pip install -e .
```

---

## ⚡ FIA 2026 Energy Regulation & Compliance

The 2026 regulations fundamentally overhaul the hybrid Formula 1 powertrain (Section C — Technical, Issue 20):
1. **MGU-K Maximum Electrical Power:** Increased from 120 kW to **350 kW** (Article C5.2.7).
2. **Energy Store Usable Window:** Regulated to **4.0 MJ** max-minus-min operational buffer (Article C5.2.9).
3. **Power Tapering Curves:**
   - **Normal Mode:** 350 kW up to 290 km/h, tapering linearly to 0 kW at 345 km/h (Article C5.2.8(i)).
   - **Manual Override Mode (Overtake):** Extends full 350 kW boost up to 337.5 km/h, tapering down to 0 kW at 355 km/h (Article C5.2.8(ii)).
4. **Energy Store Recharge Limit:** Maximum per-lap recovery ceiling of **8.5 MJ** baseline (Article C5.2.10).
5. **Deterministic Compliance Engine (`kyntra.regulations.compliance`):**
   Evaluates proposed deployment/harvesting decisions and returns explicit reason codes:
   - `ALLOWED`
   - `OVERTAKE_NOT_ENABLED`
   - `NOT_ELIGIBLE_AT_DETECTION`
   - `POWER_LIMIT_EXCEEDED`
   - `RECHARGE_LIMIT_EXCEEDED`
   - `ENERGY_STATE_UNKNOWN`
   - `REGULATION_CONFIG_INCOMPLETE`
   - `SAFETY_CAR_RESTRICTION`
   - `INSUFFICIENT_ENERGY`

---

## 🏁 TrackStatus Provenance & Non-Semantic Parsing

Raw FIA track status flags are treated strictly as provenance data:
- `1`: Track Clear
- `2`: Yellow Flag
- `4`: Safety Car Deployed
- `5`: Red Flag
- `6`: Virtual Safety Car Deployed
- `7`: Virtual Safety Car Ending

**Critical Rule:** Composite strings (e.g. `'12'`, `'21'`) are decomposed into individual flag events without semantic guessing. Under no circumstances is `'12'` assumed to indicate DRS, nor is `'21'` assumed to indicate a double yellow.

---

## 🏎️ Running the Pipeline

To ingest and validate a race session:

```bash
# 2024 Bahrain Grand Prix (Historical verified data):
python scripts/build_race.py --year 2024 --grand-prix Bahrain --session R
```

*(Note: The 2026 Bahrain Grand Prix is scheduled for October 4, 2026 as Round 16; when queried prior to race date, FastF1 cleanly signals unheld data without corrupting historical datasets).*

---

## 🧪 Running Tests

Execute the full automated test suite with pytest:

```bash
pytest tests -v
```

All 35 unit tests run completely offline with sub-second execution speed.

---

## 📜 Engineering Principles

- **Zero Telemetry Fabrication:** Private team data (Battery SOC, MGU-K electrical power, Energy Store MJ) is never fabricated.
- **Explicit Provenance Labeling:** `EnergyState` records are tagged as `REAL_TEAM_TELEMETRY`, `SIMULATED`, or `UNKNOWN`.
- **Separation of Architecture:**
  - Race Data Engine (`kyntra.ingestion`, `kyntra.processing`)
  - Overtake Intelligence (`kyntra.features`, `kyntra.labels`)
  - Energy Model (`kyntra.energy`)
  - Regulation / Compliance Engine (`kyntra.regulations`)
