import duckdb
import pandas as pd

conn = duckdb.connect()
path = "data/processed/2026_australia_energy_trace.parquet"

print("=== PARQUET SCHEMA ===")
schema_df = conn.execute(f'DESCRIBE SELECT * FROM "{path}"').df()
print(schema_df[["column_name", "column_type"]].to_string(index=False))

print("\n=== AGGREGATE SUMMARY ===")
summary_df = conn.execute(f"""
    SELECT 
        COUNT(*) AS total_rows,
        MIN(simulated_energy_available_mj) AS min_energy_mj,
        MAX(simulated_energy_available_mj) AS max_energy_mj,
        MIN(simulated_energy_fraction) AS min_energy_pct,
        MAX(simulated_energy_fraction) AS max_energy_pct,
        SUM(simulated_harvest_mj) AS total_harvest_mj,
        SUM(simulated_deployment_mj) AS total_deploy_mj
    FROM "{path}"
""").df()
print(summary_df.to_string(index=False))

print("\n=== COMPLIANCE BREAKDOWN ===")
comp_df = conn.execute(f"""
    SELECT compliance_result, COUNT(*) AS count
    FROM "{path}"
    GROUP BY compliance_result
""").df()
print(comp_df.to_string(index=False))


print("\n=== FIRST 20 ROWS ===")
first20_df = conn.execute(f"""
    SELECT 
        lap, 
        ROUND(speed, 1) AS speed_kmh, 
        ROUND(throttle, 1) AS throttle_pct, 
        brake, 
        action, 
        ROUND(simulated_energy_available_mj, 4) AS soc_mj, 
        ROUND(simulated_energy_fraction * 100, 1) AS soc_pct, 
        ROUND(simulated_harvest_mj, 4) AS harvest_mj, 
        ROUND(simulated_deployment_mj, 4) AS deploy_mj, 
        compliance_result,
        energy_source
    FROM "{path}" 
    LIMIT 20
""").df()
print(first20_df.to_string(index=False))
