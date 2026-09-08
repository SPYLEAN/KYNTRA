# KYNTRA Frontend ↔ Backend Decision Snapshot Contract

The frontend must render one coherent race-state snapshot. It must not independently invent or recompute tactical values.

## Endpoint concept

`GET /api/replay/{event_id}/lap/{lap}/battle/{attacker}/{defender}`

or streamed equivalent.

## DecisionSnapshot

```json
{
  "race": {
    "event_id": null,
    "event_name": null,
    "lap": null,
    "replay_time": null,
    "attacker": null,
    "defender": null,
    "attacker_position": null,
    "defender_position": null
  },
  "provenance": {
    "telemetry_source": "REAL_PUBLIC_TELEMETRY",
    "energy_source": "SIMULATED",
    "regulation_config_version": null,
    "event_config_version": null,
    "overtake_model_version": null,
    "retention_model_version": null
  },
  "battle": {
    "gap_seconds": null,
    "distance_gap_m": null,
    "closing_rate": null,
    "speed_delta": null,
    "tyre_age_delta": null,
    "laps_following": null,
    "rear_threat": null
  },
  "overtake": {
    "p_1_lap": null,
    "p_2_laps": null,
    "p_3_laps": null,
    "calibrated": false,
    "available": false
  },
  "retention": {
    "p_1_lap_given_pass": null,
    "p_2_laps_given_pass": null,
    "p_3_laps_given_pass": null,
    "calibrated": false,
    "available": false
  },
  "energy": {
    "available_energy_mj": null,
    "fraction": null,
    "scenario": null,
    "simulated": true,
    "projected_action_cost_mj": null,
    "projected_post_action_reserve_mj": null,
    "sensitivity": null
  },
  "compliance": {
    "status": "UNKNOWN",
    "allowed_actions": [],
    "blocked_actions": [],
    "reason_codes": []
  },
  "counterfactuals": [
    {
      "action": "CONSERVE",
      "feasible": null,
      "pass_outcome": null,
      "retention_outcome": null,
      "ending_energy_mj": null,
      "future_opportunity": null,
      "rank": null
    },
    {
      "action": "BUILD",
      "feasible": null,
      "pass_outcome": null,
      "retention_outcome": null,
      "ending_energy_mj": null,
      "future_opportunity": null,
      "rank": null
    },
    {
      "action": "DEPLOY",
      "feasible": null,
      "pass_outcome": null,
      "retention_outcome": null,
      "ending_energy_mj": null,
      "future_opportunity": null,
      "rank": null
    },
    {
      "action": "OVERTAKE",
      "feasible": null,
      "pass_outcome": null,
      "retention_outcome": null,
      "ending_energy_mj": null,
      "future_opportunity": null,
      "rank": null
    }
  ],
  "recommendation": {
    "canonical_action": null,
    "ui_label": null,
    "robust": null,
    "energy_sensitive": null,
    "why": []
  }
}
```

## UI rules

1. `null` renders as `—` or `Unavailable`, never `0`.
2. If `overtake.available == false`, render `MODEL NOT LOADED`.
3. If `retention.available == false`, render `MODEL NOT LOADED`.
4. If `energy.simulated == true`, always display:
   `SIMULATED — 2026 REGULATION CONSTRAINED`.
5. If `OVERTAKE` is blocked by compliance, the UI cannot recommend `OVERTAKE NOW`.
6. The explanation list in `recommendation.why` must be generated from structured engine facts only.
7. Replay controls update the entire snapshot atomically so panels never show mismatched laps.
8. Driver/team IDs are display provenance, not necessarily ML features.
9. UI must never fabricate values while waiting for backend computation.
