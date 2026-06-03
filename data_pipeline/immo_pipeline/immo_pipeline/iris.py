import time
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

DEPARTMENTS = ["44", "29", "22", "56", "35"]
iris_partitions = dagster.StaticPartitionsDefinition(DEPARTMENTS)

@dagster.asset(
    partitions_def=iris_partitions,
    group_name="ingestion",
    kinds=["python", "postgresql", "api"],
    description="Contours IRIS de l'INSEE. Source: OpenDataSoft (millesime 2024)."
)
def raw_iris(context: dagster.AssetExecutionContext) -> dagster.MaterializeResult:
    dept = context.partition_key
    ingestor = DataIngestor(DB_URL)
    
    # 1. Idempotence : supprimer les anciennes données de ce département
    with psycopg.connect(ingestor.db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
            try:
                cur.execute(
                    "DELETE FROM bronze.raw_iris WHERE dep_code = %s",
                    (dept,)
                )
            except psycopg.errors.UndefinedTable:
                conn.rollback()
            else:
                conn.commit()

    # 2. Appel API OpenDataSoft pour le département et l'année 2024
    url = (
        "https://public.opendatasoft.com/api/explore/v2.1/catalog/"
        "datasets/georef-france-iris-millesime/exports/geojson"
        f"?where=dep_code%3D%27{dept}%27%20and%20year%3Ddate%272024%27"
    )
    
    context.log.info(f"Téléchargement des IRIS dept {dept} depuis {url}")
    
    MAX_RETRIES = 5
    geojson_data = None
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=120)
            response.raise_for_status()
            geojson_data = response.json()
            break
        except (requests.exceptions.RequestException, Exception) as e:
            if attempt == MAX_RETRIES - 1:
                context.log.error(f"Echec définitif après {MAX_RETRIES} tentatives sur l'URL: {url}")
                raise
            context.log.warning(f"Erreur de connexion. Tentative {attempt + 1}/{MAX_RETRIES} dans quelques secondes... Erreur: {str(e)}")
            time.sleep(2 ** attempt)

    features = geojson_data.get("features", []) if geojson_data else []
    context.log.info(f"{len(features)} IRIS récupérés pour le département {dept}.")
    
    def clean_value(val):
        if isinstance(val, list):
            return str(val[0]) if len(val) > 0 else ""
        return str(val) if val is not None else ""

    # Extraction des données en dictionnaire pour Polars
    dict_data = {
        "iris_code": [],
        "iris_name": [],
        "com_code": [],
        "com_name": [],
        "dep_code": [],
        "geometry_json": []
    }
    
    for feature in features:
        props = feature.get("properties", {})
        dict_data["iris_code"].append(clean_value(props.get("iris_code")))
        dict_data["iris_name"].append(clean_value(props.get("iris_name")))
        dict_data["com_code"].append(clean_value(props.get("com_code")))
        dict_data["com_name"].append(clean_value(props.get("com_name")))
        dict_data["dep_code"].append(clean_value(props.get("dep_code")))
        dict_data["geometry_json"].append(json.dumps(feature.get("geometry")))
        
    df = pl.DataFrame(dict_data)
    
    # 3. Chargement dans PostgreSQL
    ingestor.insert_dataframe(df, table_name="raw_iris", schema="bronze")
    
    return dagster.MaterializeResult(
        metadata={
            "row_count": dagster.MetadataValue.int(len(df)),
            "department": dagster.MetadataValue.text(dept)
        }
    )
