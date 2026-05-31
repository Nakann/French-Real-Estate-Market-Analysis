import sys
import os
import dagster

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "data_pipeline", "immo_pipeline", "immo_pipeline")))
from ban import raw_ban

if __name__ == "__main__":
    print("Testing BAN ingestion for partition '44'...")
    # Materialize specifically the '44' partition
    result = dagster.materialize(
        [raw_ban],
        partition_key="44"
    )
    if result.success:
        print("Materialization successful!")
    else:
        print("Materialization failed.")
