# 2026 Public Telemetry & Hybrid Energy Channel Audit
**KYNTRA — Predictive Racecraft Intelligence**  
*TrackShift Problem: Energy & Overtake Intelligence*  
*Audit Scope: Official FIA / FastF1 Public Timing & Telemetry Feeds for the 2026 Formula 1 Season*

---

## Executive Summary

To achieve **Energy & Overtake Intelligence** under the 2026 Formula 1 technical regulations without fabricating non-existent data, KYNTRA conducts this empirical audit of all channels broadcast over the official public Formula 1 timing and telemetry feeds via FastF1.

### Critical Finding
> **Under no circumstances does Formula 1 or the FIA broadcast real-time Battery State of Charge (SOC), Energy Store MJ balances, or live MGU-K electrical power over public feeds.**  
> These channels are strictly encrypted, proprietary team/FIA telemetry. Any system claiming to possess live team battery telemetry without private team data loggers is fabricating data. KYNTRA maintains strict provenance: real public telemetry is kept intact, and downstream energy models will be explicitly tagged as `SIMULATED` or `UNKNOWN`.

---

## Telemetry Channel Classification

### 1. DIRECTLY AVAILABLE (Public Live Stream)

These channels are broadcast in real-time at varying sampling frequencies (~5–10 Hz for car telemetry, 100 Hz for timing loops) and are directly loaded via FastF1:

| Channel Name | Source Stream | Unit / Type | Description / Sampling |
|---|---|---|---|
| `Speed` | Car Data | `km/h` (float) | Wheel speed sensor telemetry (~10 Hz) |
| `Throttle` | Car Data | `0–100%` (float) | Driver throttle pedal application |
| `Brake` | Car Data | `0–100%` or boolean | Driver brake pedal application |
| `RPM` | Car Data | `rpm` (int) | Internal Combustion Engine (ICE) rotational speed |
| `nGear` | Car Data | `1–8, 0 (N), -1 (R)` | Engaged transmission gear ratio |
| `X`, `Y`, `Z` | Position Data | `0.1 m` (int/float) | 3D track coordinate position (~3 Hz) |
| `Distance` | Car Data | `meters` (float) | Cumulative lap/session distance driven |
| `RelativeDistance`| Car Data | `0.0–1.0` (float) | Normalized position along the circuit lap |
| `SessionTime` / `Time` | Car Data | `timedelta64[ns]` | High-resolution elapsed session duration |
| `LapTime` | Lap Timing | `timedelta64[ns]` | Official transponder lap completion duration |
| `Sector1/2/3Time` | Lap Timing | `timedelta64[ns]` | Official timing loop sector splits |
| `SpeedI1`, `SpeedI2`, `SpeedFL`, `SpeedST` | Lap Timing | `km/h` | Speed trap readings at sector splits & finish |
| `Compound` | Timing App | string (`SOFT`, `HARD`)| Pirelli tyre compound fitted to car |
| `TyreLife` | Timing App | `laps` (float) | Cumulative laps completed on current tyre set |
| `Stint` | Timing App | `int` | Stint sequence index for driver |
| `PitInTime`, `PitOutTime` | Timing App | `timedelta64[ns]` | Pit entry and exit line crossing timestamps |
| `TrackStatus` | Timing Stream | string digits (`1`, `2`, `4`) | FIA track flags (Clear, Yellow, Safety Car, Red) |
| `Weather` | Weather Stream | Temp (`°C`), Wind, Rain | Track/air temperature, humidity, rainfall flag |
| `RaceControlMessages`| RCM Stream | string log | Official FIA race director announcements |

---

### 2. DERIVABLE (Deterministically Calculable from Available Public Data)

These metrics do not exist as raw telemetry channels, but can be mathematically and physically derived from directly available public channels without inventing synthetic ground truth:

| Metric | Derivation Method | Formula / Relationship |
|---|---|---|
| **Longitudinal Acceleration ($a_x$)** | Numerical differentiation | $a_x = \frac{\Delta \text{Speed}}{\Delta t}$ with Savitzky-Golay filtering |
| **Lateral Acceleration ($a_y$)** | Kinematic curvature | $a_y = \frac{v^2}{R} = v \cdot \dot{\theta}$ from $(X, Y)$ track spline |
| **Braking Energy Flux ($P_{\text{mech, brake}}$)** | Kinetic energy delta | $P = m \cdot v \cdot a_x - P_{\text{aero}} - P_{\text{rr}}$ |
| **Coast / Lift-and-Coast Phases** | Throttle/Brake coincidence | $\text{Throttle} < 5\%$ and $\text{Brake} == 0$ at $v > 150 \text{ km/h}$ |
| **Corner Apex Speed & Minimum Speed**| Local minima on Speed trace | Extrema detection within mapped circuit corners |
| **Relative Gap to Car Ahead** | Spatial delta & lap time delta | $\Delta s$ from $(X, Y)$ coordinates or timing split interpolation |
| **Shift Timing & Rev Delta** | RPM vs Speed gradient | $\frac{\text{RPM}}{\text{Speed}}$ discontinuities across gear changes |

---

### 3. NOT AVAILABLE (Strictly Confidential Team / FIA Telemetry)

These channels are **completely withheld from the public feed** by Formula 1 and the FIA for intellectual property, tactical secrecy, and competitive parity reasons.

| Withheld Channel | Description | Why It Is Private |
|---|---|---|
| **Battery State of Charge (SOC)** | Exact Energy Store charge level ($\%$) | Core tactical secret; reveals competitor battery reserve |
| **Energy Store Usable Balance (MJ)** | Usable Megajoules remaining in ES | Regulated under 4.0 MJ window; team proprietary |
| **MGU-K Electrical Deployment (kW)** | Live electrical power output to drivetrain | Up to 350 kW in 2026; proprietary engine mapping |
| **MGU-K Electrical Harvesting (kW)** | Live regenerative braking power from MGU-K | Up to 350 kW in 2026; reveals energy recovery tactics |
| **Cumulative Lap Energy Deployed (MJ)** | Energy deployed over current lap | Subject to regulatory limits; withheld from broadcast |
| **Cumulative Lap Energy Harvested (MJ)**| Energy recovered into ES over current lap | Subject to FIA recharge limit (e.g. 8.5–9 MJ); withheld |
| **Manual Override (Overtake) Live Activation**| Cockpit steering wheel button status | Not broadcast as an individual electrical state |
| **Active Aero Mode (X-Mode / Z-Mode)** | Low-drag straight vs high-downforce state | Not currently exposed as a discrete public telemetry flag |

---

### 4. UNKNOWN / NEEDS VALIDATION

| Channel / Condition | Current Status & Empirical Finding |
|---|---|
| **Legacy `DRS` Channel in 2026** | In 2026 FastF1 session data, the `DRS` column is present in the schema but contains **`0` throughout**. In the 2026 regulations, conventional DRS is replaced by Active Aerodynamics (X-Mode/Z-Mode) and Manual Override Mode. The public `DRS` column must **NOT** be assumed to represent the 2026 Overtake system. |
| **Circuit-Specific Recharge Limits** | While the baseline FIA 2026 Technical Regulations set MGU-K power limits (350 kW) and Energy Store usable window (4.0 MJ), circuit-specific recharge allowances (e.g., tailored limits for short or high-braking tracks) are published in FIA Event Notes and must be treated as `null` / unconfigured unless explicitly sourced. |
| **Manual Override Detection & Activation Lines** | The exact GPS coordinates of 2026 Overtake detection and activation zones must be parsed from FIA Event Notes rather than guessed from legacy DRS zones. |

---

## Architectural Implications for KYNTRA

1. **Strict Provenance Labeling**:
   - `REAL_TEAM_TELEMETRY`: Only used if genuine private team telemetry is provided.
   - `SIMULATED`: Applied to all physical/mathematical estimates of Battery SOC, MGU-K kW, and Energy Store MJ.
   - `UNKNOWN`: Default when neither real telemetry nor validated physics models have executed.
2. **Deterministic Regulation Compliance**:
   - The compliance engine must evaluate proposed power curves against official FIA bounds (350 kW, tapering above 290 km/h) rather than attempting to guess invisible internal battery states.
3. **No Synthetic Fabrication**:
   - KYNTRA will never output fake battery percentage bars or fabricated kilowatt traces. Every energy estimate must be backed by a clear thermodynamic/kinetic model.
