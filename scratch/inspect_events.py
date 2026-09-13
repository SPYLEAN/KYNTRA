import sqlite3, json

conn = sqlite3.connect('data/race_memory.db')
types = conn.execute("SELECT event_type, count(*) FROM race_events GROUP BY event_type").fetchall()
print("Event types:", types)

overtakes = conn.execute("SELECT * FROM race_events WHERE event_type LIKE '%OVERTAKE%' LIMIT 5").fetchall()
print("Overtake samples count:", len(overtakes))
for row in overtakes:
    print(row[0], row[1], row[3], row[5], row[6], row[7])
