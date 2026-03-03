import psycopg2
import sys

try:
    conn = psycopg2.connect(
        host="31.97.119.125",
        port="5432",
        database="cerebro_data",
        user="maciej",
        password="Redislandtree2!"
    )
    
    cur = conn.cursor()
    cur.execute("CREATE SCHEMA IF NOT EXISTS cerebro;")
    conn.commit()
    print("Schema created successfully!")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)
