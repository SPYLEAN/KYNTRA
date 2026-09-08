# KYNTRA Phase 2A — Overtake Intelligence Dataset Quality Report

> **Dataset Identifier:** `kyntra_overtake_dataset.parquet`  
> **Generation Timestamp:** 2026-09-08 10:35:36 UTC  
> **Label Engine Version:** `2.0.0`  
> **Label Provenance Source:** `KYNTRA_VERIFIED_ON_TRACK_ENGINE`  
> **Regulation Era:** `2026_ENERGY_OVERTAKE`

---

## 1. Calendar Discovery & Split Partitioning

| Split | Event Count | Events Included |
|---|---|---|
| **TRAIN** | 7 | Chinese Grand Prix, Canadian Grand Prix, Monaco Grand Prix, Barcelona Grand Prix, Austrian Grand Prix, British Grand Prix, Belgian Grand Prix |
| **VALIDATION** | 2 | Hungarian Grand Prix, Dutch Grand Prix |
| **DEMO_HOLDOUT** | 4 | Australian Grand Prix, Japanese Grand Prix, Miami Grand Prix, Italian Grand Prix *(Completely Isolated)* |

### Split Contamination Test
- **Demo Holdout Rows in Training/Validation:** `0` *(Strictly 0: verified zero leakage)*
- **Duplicate Observations:** `0` *(Unique observation_id integrity verified: 0 duplicates)*
- **Battle Sequences Crossing Splits:** `0` *(Strictly 0: battle sequences bound within events)*

---

## 2. Dataset Population & Battle Sequences

- **Total Candidate Pair Observations:** `8,357`
  - `TRAIN`: `6,197` observations
  - `VALIDATION`: `2,160` observations
- **Number of Battle Sequences:** `1,656`
- **Average Sequence Length:** `5.05` laps
- **Dataset Dimensions:** `8357 rows x 78 columns`

### Battle Sequence Termination Rules
1. **Pair Adjacency Break**: Attacker and Defender track positions are no longer consecutive (pos_attacker != pos_defender + 1).
2. **Pit Stop**: Either driver enters or exits the pit lane.
3. **Race Neutralization**: Track status transitions to Safety Car (SC), Virtual Safety Car (VSC), or Red Flag.
4. **Retirement / DNF**: Either car stops or retires from the session.
5. **Lap Mismatch**: Cars are on different race laps (e.g. lapped car).
6. **Pass / Re-pass Sequence End**: Attacker successfully overtakes defender, ending the chase relationship.

---

## 3. Label Distribution & Positive Overtakes Per Split

### Overall Overtake Label Distribution
| Horizon | Positive Overtakes | Positive Rate | Censored Observations | Censoring Rate |
|---|---|---|---|---|
| **Next 1 Lap** | `270` | `3.23%` | `775` | `9.27%` |
| **Next 2 Laps** | `425` | `5.09%` | `1,471` | `17.60%` |
| **Next 3 Laps** | `530` | `6.34%` | `2,086` | `24.96%` |

### Positive Overtakes Per Split
| Split | Total Observations | Positive (1 Lap) | Positive (2 Laps) | Positive (3 Laps) |
|---|---|---|---|---|
| **TRAIN** | `6,197` | `182` (2.94%) | `303` (4.89%) | `386` (6.23%) |
| **VALIDATION** | `2,160` | `88` (4.07%) | `122` (5.65%) | `144` (6.67%) |

*Note: Subsequent re-passes do NOT erase original successful overtakes under event-based labeling.*

---

## 4. Position Retention & Re-pass Durability (Target Family 2)

Retention is conditional on a verified successful pass: P(retained | pass)

### Overall Retention Metrics
| Horizon | Retained Position | Re-passed by Defender | Retention Censored |
|---|---|---|---|
| **1 Lap Post-Pass** | `245` | `25` | `0` |
| **2 Laps Post-Pass** | `372` | `29` | `24` |
| **3 Laps Post-Pass** | `433` | `32` | `65` |

### Positive Retention Examples Per Split
| Split | Retained (1 Lap) | Retained (2 Laps) | Retained (3 Laps) |
|---|---|---|---|
| **TRAIN** | `177` | `277` | `326` |
| **VALIDATION** | `68` | `95` | `107` |

---

## 5. Same-Lap Pass / Re-pass Tracking

| Metric | Count | Description |
|---|---|---|
| **Same-Lap Pass Candidates Discovered** | `8,694` | Close chase pairs evaluated on consecutive laps where lap-end order was unchanged |
| **Same-Lap Pass Candidates Verified** | `27` | Verified passes supported by sector timing and/or telemetry order transitions |
| **Same-Lap Candidates Rejected** | `8,667` | Insufficient public evidence / no timing inversion confirmed |

---

## 6. False Overtake Inversion Rejections

Total Non-Racing Position Inversions Rejected: `9,602`

| Rejection Reason | Count | Explanation |
|---|---|---|
| `NO_SAME_LAP_INVERSION_EVIDENCE` | `8,007` | Filtered non-racing position gain |
| `DEFENDER_PITTED` | `814` | Filtered non-racing position gain |
| `PIT_DURING_SAME_LAP_CANDIDATE` | `660` | Filtered non-racing position gain |
| `NEUTRALIZED_RACE_SC_VSC` | `109` | Filtered non-racing position gain |
| `ATTACKER_PITTED` | `11` | Filtered non-racing position gain |
| `DEFENDER_RETIRED` | `1` | Filtered non-racing position gain |

---

## 7. Feature Missingness Summary (Core Observable Columns)

| Column | Non-Null Count | Missingness % |
|---|---|---|
| `distance_gap_m` | `8,299` | `0.69%` |
| `gap_seconds` | `8,299` | `0.69%` |
| `closing_rate` | `8,172` | `2.21%` |
| `recent_pace_delta_1lap` | `8,357` | `0.00%` |
| `recent_pace_delta_3laps` | `8,357` | `0.00%` |
| `tyre_age_delta` | `8,307` | `0.60%` |
| `consecutive_laps_following` | `8,357` | `0.00%` |

---

## 8. Demo Holdout Replay Datasets (`data/demo/`)

1. `2026_australia_replay.parquet`: Russell (`#63`) / Leclerc (`#16`) repeated pass-repass battle sequence.
2. `2026_japan_replay.parquet`: Antonelli (`#12`) / Norris (`#4`) sequence.
3. `2026_miami_replay.parquet`: Antonelli (`#12`) / Verstappen (`#1`) & Leclerc (`#16`) sequences.
4. `2026_italy_replay.parquet`: Verstappen (`#1`) vs Mercedes (#12 Antonelli, #63 Russell) sequence.

*All demo replay datasets are strictly isolated from training/validation files.*
