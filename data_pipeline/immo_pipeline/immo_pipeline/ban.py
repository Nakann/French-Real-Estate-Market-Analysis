import os
import sys
import requests
import tempfile
import dagster
import polars as pl
import psycopg

# Append parent path so we can import ingest.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ingest import DataIngestor, DB_URL

DEPARTMENTS = ["44", "29", "22", "56", "35"]
ban_partitions = dagster.StaticPartitionsDefinition(DEPARTMENTS)

@dagster.asset(
    partitions_def=ban_partitions,
    group_name="ingestion",
    kinds=["python", "postgresql"],
    description="Base Adresse Nationale (BAN) par département pour vérification spatiale."
)
def raw_ban(context: dagster.AssetExecutionContext) -> dagster.MaterializeResult:
    dept = context.partition_key
    url = f"https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/adresses-{dept}.csv.gz"
    
    context.log.info(f"Téléchargement du fichier BAN pour le département {dept} depuis {url}")
    
    with tempfile.NamedTemporaryFile(suffix=".csv.gz", delete=False) as tmp:
        response = requests.get(url, stream=True, timeout=300)
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        context.log.info("Lecture du fichier CSV avec Polars...")
        # Les fichiers CSV de la BAN sont délimités par ';'
        df = pl.read_csv(tmp_path, separator=";", infer_schema_length=0)
        context.log.info(f"{len(df)} adresses trouvées pour le département {dept}.")
        
        with psycopg.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
                columns = [f'"{col}" TEXT' for col in df.columns]
                cur.execute(f"CREATE TABLE IF NOT EXISTS bronze.raw_ban ({', '.join(columns)});")
                # Suppression des anciennes données de la partition pour l'idempotence
                cur.execute("DELETE FROM bronze.raw_ban WHERE code_insee LIKE %s;", (f"{dept}%",))
                conn.commit()
                
        context.log.info("Insertion des données dans PostgreSQL...")
        ingestor = DataIngestor(DB_URL)
        ingestor.insert_dataframe(df, table_name="raw_ban", schema="bronze")
        
        return dagster.MaterializeResult(
            metadata={
                "row_count": dagster.MetadataValue.int(len(df)),
                "department": dagster.MetadataValue.text(dept)
            }
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
