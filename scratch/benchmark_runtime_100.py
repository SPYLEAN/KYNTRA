"""
Phase 10: 100-Update Performance Benchmark for KyntraRuntimeOrchestrator
Measures end-to-end cycle latency and per-stage breakdown across 100 ticks.
"""

import sys
import time
import numpy as np
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from kyntra.runtime.orchestrator import KyntraRuntimeOrchestrator
from kyntra.runtime.models import RuntimeMode

def run_benchmark():
    print("Initializing KyntraRuntimeOrchestrator for 100-update runtime cycle benchmark...")
    orchestrator = KyntraRuntimeOrchestrator(
        event_id="2026_01_AUS",
        mode=RuntimeMode.SYNTHETIC_TEST,
        allow_failure_injection=False
    )

    # Warmup 5 cycles
    for _ in range(5):
        orchestrator.step()

    latencies = {
        "ingestion_ms": [],
        "features_ms": [],
        "inference_ms": [],
        "matrix_ms": [],
        "ranking_ms": [],
        "publication_ms": [],
        "total_cycle_ms": []
    }

    print("Running 100 continuous runtime updates...")
    t0_benchmark = time.perf_counter()

    for i in range(100):
        t_cycle_start = time.perf_counter()
        snapshot = orchestrator.step()
        t_cycle_end = time.perf_counter()

        lm = snapshot.latencies
        latencies["ingestion_ms"].append(lm.ingestion_ms)
        latencies["features_ms"].append(lm.features_ms)
        latencies["inference_ms"].append(lm.inference_ms)
        latencies["matrix_ms"].append(lm.matrix_evaluation_ms if hasattr(lm, "matrix_evaluation_ms") else lm.matrix_ms)
        latencies["ranking_ms"].append(lm.ranking_ms)
        latencies["publication_ms"].append(lm.gate_ms)
        latencies["total_cycle_ms"].append((t_cycle_end - t_cycle_start) * 1000.0)

    total_bench_time = time.perf_counter() - t0_benchmark

    print(f"\n--- Benchmark Complete: 100 Updates in {total_bench_time:.3f}s (Avg {(total_bench_time/100)*1000:.2f} ms/update) ---")
    print(f"{'Metric':<25} | {'Median (p50)':<12} | {'95th %ile':<12} | {'99th %ile':<12} | {'Max':<12}")
    print("-" * 80)

    for metric_name, values in latencies.items():
        p50 = np.percentile(values, 50)
        p95 = np.percentile(values, 95)
        p99 = np.percentile(values, 99)
        mx = np.max(values)
        print(f"{metric_name:<25} | {p50:>8.2f} ms  | {p95:>8.2f} ms  | {p99:>8.2f} ms  | {mx:>8.2f} ms")

    # Verify decision snapshot consistency
    hist = orchestrator.decision_store.get_history()
    print(f"\nTotal decisions in DecisionStore: {len(hist)}")
    print(f"System Health Status: {snapshot.health.system_health.value}")
    print(f"Active Battle ID: {snapshot.selected_battle_id}")
    orchestrator.stop()

if __name__ == "__main__":
    run_benchmark()
