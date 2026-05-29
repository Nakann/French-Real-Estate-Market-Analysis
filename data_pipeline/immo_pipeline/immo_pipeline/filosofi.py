import dagster
import polars as pl
import requests
import zipfile
import io
import os
import sys

# Append parent path so we can import ingest.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ingest import DataIngestor, DB_URL

@dagster.asset(
    group_name="ingestion",
    description="Ingestion brute des données socio-économiques FILOSOFI (tous niveaux géographiques)",
)
def raw_filosofi(context: dagster.AssetExecutionContext) -> dagster.MaterializeResult:
    url = "https://www.insee.fr/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip"
    
    context.log.info(f"Téléchargement de l'archive ZIP depuis {url}")
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    
    # Lecture de l'archive ZIP en mémoire
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        # Trouver les deux fichiers
        data_filename = next((name for name in z.namelist() if name.endswith("_data.csv")), None)
        meta_filename = next((name for name in z.namelist() if name.endswith("_metadata.csv")), None)
        
        if not data_filename or not meta_filename:
            raise Exception("Impossible de trouver le fichier CSV de données ou de métadonnées dans l'archive ZIP.")
            
        context.log.info(f"Extraction et lecture du fichier de données: {data_filename}")
        with z.open(data_filename) as f:
            df_data = pl.read_csv(f.read(), separator=";", infer_schema_length=10000, ignore_errors=True)
            
        context.log.info(f"Extraction et lecture du fichier de métadonnées: {meta_filename}")
        with z.open(meta_filename) as f:
            df_meta = pl.read_csv(f.read(), separator=";", infer_schema_length=10000, ignore_errors=True)
            
    # Nettoyage basique des noms de colonnes pour Postgres (minuscules)
    df_data = df_data.rename({col: col.lower() for col in df_data.columns})
    df_meta = df_meta.rename({col: col.lower() for col in df_meta.columns})
    
    context.log.info("Connexion à PostgreSQL et insertion...")
    ingestor = DataIngestor(DB_URL)
    
    import psycopg
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            try:
                cur.execute("DROP TABLE IF EXISTS bronze.raw_filosofi;")
                cur.execute("DROP TABLE IF EXISTS bronze.raw_filosofi_metadata;")
            except psycopg.errors.UndefinedTable:
                conn.rollback()
            else:
                conn.commit()
                
    ingestor.insert_dataframe(df_data, table_name="raw_filosofi", schema="bronze")
    ingestor.insert_dataframe(df_meta, table_name="raw_filosofi_metadata", schema="bronze")
    
    return dagster.MaterializeResult(
        metadata={
            "row_count_data": dagster.MetadataValue.int(len(df_data)),
            "row_count_metadata": dagster.MetadataValue.int(len(df_meta)),
            "source_url": dagster.MetadataValue.url(url)
        }
    )
