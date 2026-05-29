import json
import requests
import dagster
import polars as pl
import psycopg
import os
import sys

# Append parent path so we can import ingest.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ingest import DataIngestor, DB_URL

@dagster.asset(
    group_name="ingestion",
    kinds=["python", "postgresql", "api"],
    description="Géométries simplifiées des communes (GeoJSON) depuis Etalab/IGN.",
)
def raw_communes(context: dagster.AssetExecutionContext) -> dagster.MaterializeResult:
    url = "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes-version-simplifiee.geojson"
    
    context.log.info(f"Téléchargement des géométries depuis {url}")
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    
    geojson_data = response.json()
    features = geojson_data.get("features", [])
    context.log.info(f"{len(features)} communes trouvées dans le GeoJSON.")
    
    # Extraction des données en dictionnaire pour Polars
    # On stocke la géométrie entière sous forme de chaîne JSON brute
    dict_data = {
        "code_commune": [],
        "nom_commune": [],
        "geometry_json": []
    }
    
    for feature in features:
        props = feature.get("properties", {})
        dict_data["code_commune"].append(str(props.get("code", "")))
        dict_data["nom_commune"].append(str(props.get("nom", "")))
        dict_data["geometry_json"].append(json.dumps(feature.get("geometry")))
        
    df = pl.DataFrame(dict_data)
    
    context.log.info("Connexion à PostgreSQL et préparation de l'insertion...")
    ingestor = DataIngestor(DB_URL)
    
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            try:
                cur.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
                cur.execute("DROP TABLE IF EXISTS bronze.raw_communes CASCADE;")
            except psycopg.errors.UndefinedTable:
                conn.rollback()
            else:
                conn.commit()
                
    ingestor.insert_dataframe(df, table_name="raw_communes", schema="bronze")
    
    return dagster.MaterializeResult(
        metadata={
            "row_count": dagster.MetadataValue.int(len(df)),
            "source_url": dagster.MetadataValue.url(url)
        }
    )
