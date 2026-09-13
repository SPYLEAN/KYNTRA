import sqlite3

conn = sqlite3.connect('data/race_memory.db')
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", tables)
for (t,) in tables:
    count = conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
    print(f"Table {t}: {count} rows")
    cur = conn.execute(f"SELECT * FROM {t} LIMIT 1")
    cols = [d[0] for d in cur.description]
    print(f"  Cols: {cols}")
