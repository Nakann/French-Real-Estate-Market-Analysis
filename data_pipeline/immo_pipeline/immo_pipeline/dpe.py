import time
import requests
import dagster
import polars as pl
import psycopg
import os
import sys

# Append parent path so we can import ingest.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ingest import DataIngestor, DB_URL

DATASET_ID = "meg-83tjwtg8dyz4vv7h1dqe"
BASE_URL = f"https://data.ademe.fr/data-fair/api/v1/datasets/{DATASET_ID}/lines"
PAGE_SIZE = 10_000

DEPARTMENTS = ["44", "29", "22", "56", "35"]

COLUMNS = [
    "numero_dpe",
    "date_etablissement_dpe",
    "date_fin_validite_dpe",
    "type_batiment",
    "periode_construction",
    "adresse_ban",
    "adresse_brut",
    "code_postal_ban",
    "code_insee_ban",
    "code_departement_ban",
    "nom_commune_ban",
    "identifiant_ban",
    "coordonnee_cartographique_x_ban",
    "coordonnee_cartographique_y_ban",
    "etiquette_dpe",
    "etiquette_ges",
    "conso_5_usages_par_m2_ep",
    "surface_habitable_immeuble",
    "type_energie_principale_chauffage",
    "type_energie_principale_ecs",
]

SELECT_PARAM = ",".join(COLUMNS)

dpe_partitions = dagster.StaticPartitionsDefinition(DEPARTMENTS)

@dagster.asset(
    partitions_def=dpe_partitions,
    group_name="ingestion",
    kinds=["python", "postgresql", "api"],
    description="DPE existants depuis juillet 2021. Source: ADEME.",
)
def raw_dpe(context: dagster.AssetExecutionContext) -> dagster.MaterializeResult:
    dept = context.partition_key
    ingestor = DataIngestor(DB_URL)
    
    # 1. Idempotence : supprimer les anciennes données de ce département
    with psycopg.connect(ingestor.db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
            try:
                cur.execute(
                    "DELETE FROM bronze.raw_dpe WHERE code_departement_ban = %s",
                    (dept,)
                )
            except psycopg.errors.UndefinedTable:
                conn.rollback()
            else:
                conn.commit()

    # 2. Extraction paginée depuis l'API ADEME
    url = f"{BASE_URL}?size={PAGE_SIZE}&qs=code_departement_ban%3A{dept}&select={SELECT_PARAM}"
    total_inserted = 0
    page = 0
    
    while url:
        MAX_RETRIES = 5
        data = None
        for attempt in range(MAX_RETRIES):
            try:
                response = requests.get(url, timeout=120)
                response.raise_for_status()
                data = response.json()
                break
            except (requests.exceptions.RequestException, Exception) as e:
                if attempt == MAX_RETRIES - 1:
                    print(f"Echec définitif après {MAX_RETRIES} tentatives sur l'URL: {url}", file=sys.stderr)
                    raise
                print(f"Erreur de connexion (IncompleteRead / ChunkedEncoding). Tentative {attempt + 1}/{MAX_RETRIES} dans quelques secondes... Erreur: {str(e)}", file=sys.stderr)
                time.sleep(2 ** attempt)
                
        if not data:
            break
            
        results = data.get("results", [])
        if not results:
            break
            
        # Conversion des résultats en DataFrame Polars (avec cast explicite en chaînes)
        dict_data = {col: [] for col in COLUMNS}
        for r in results:
            for col in COLUMNS:
                val = r.get(col)
                dict_data[col].append(str(val) if val is not None else "")
                
        df = pl.DataFrame(dict_data)
        
        # 3. Chargement du lot
        ingestor.insert_dataframe(df, table_name="raw_dpe", schema="bronze")
        
        total_inserted += len(df)
        context.log.info(f"Dept {dept} - page {page} : {len(df)} lignes insérées (Total: {total_inserted})")
        
        url = data.get("next")
        page += 1

    return dagster.MaterializeResult(
        metadata={
            "row_count": dagster.MetadataValue.int(total_inserted),
            "department": dagster.MetadataValue.text(dept)
        }
    )
