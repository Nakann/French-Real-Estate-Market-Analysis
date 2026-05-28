import dagster
import polars as pl
import psycopg
import os
import sys

# Append parent path so we can import ingest.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ingest import DataIngestor, DB_URL

YEARS = ["2021", "2022", "2023", "2024", "2025"]
DEPARTMENTS = ["44", "29", "22", "56", "35"]
BASE_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv"

dvf_partitions = dagster.MultiPartitionsDefinition({
    "year": dagster.StaticPartitionsDefinition(YEARS),
    "department": dagster.StaticPartitionsDefinition(DEPARTMENTS),
})

@dagster.asset(
    partitions_def=dvf_partitions,
    group_name="ingestion",
    kinds=["python", "polars", "postgresql"],
    description="Transactions immobilières brutes (DVF) géocodées. Source: Etalab.",
)
def raw_dvf(context: dagster.AssetExecutionContext) -> dagster.MaterializeResult:
    keys = context.partition_key.keys_by_dimension
    year = keys["year"]
    dept = keys["department"]
    url = f"{BASE_URL}/{year}/departements/{dept}.csv.gz"

    context.log.info(f"Téléchargement DVF dept {dept} année {year} depuis {url}")
    
    # 1. Extraction avec Polars
    # On force tout en String/Text
    df = pl.read_csv(url, separator=",", infer_schema_length=0)
    
    # 2. Idempotence : suppression des données existantes pour cette partition
    ingestor = DataIngestor(DB_URL)
    with psycopg.connect(ingestor.db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
            try:
                # La date_mutation est lue en String, elle commence par YYYY-MM-DD
                cur.execute(
                    "DELETE FROM bronze.raw_dvf WHERE code_departement = %s AND date_mutation LIKE %s",
                    (dept, f"{year}%")
                )
            except psycopg.errors.UndefinedTable:
                conn.rollback() # La table n'existe pas encore, c'est normal
            else:
                conn.commit()
                
    # 3. Chargement dans PostgreSQL
    ingestor.insert_dataframe(df, table_name="raw_dvf", schema="bronze")
    
    return dagster.MaterializeResult(
        metadata={
            "row_count": dagster.MetadataValue.int(len(df)),
            "department": dagster.MetadataValue.text(dept),
            "year": dagster.MetadataValue.text(year)
        }
    )
