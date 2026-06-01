import sys
from dagster import materialize
from immo_pipeline import ban

if __name__ == "__main__":
    partitions = ['44', '29', '22', '56', '35']
    for p in partitions:
        print(f"Materializing raw_ban partition {p}...")
        res = materialize([ban.raw_ban], partition_key=p)
        if not res.success:
            print(f"Materialization failed for partition {p}")
            sys.exit(1)
    
    print("Materialization succeeded")
