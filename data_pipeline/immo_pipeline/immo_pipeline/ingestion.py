from dagster import asset
import os
import sys

# Ajout du dossier parent (data_pipeline) au path pour importer notre script d'ingestion
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ingest import DataIngestor, DB_URL

@asset(
    group_name="ingestion_bronze", 
    description="Ingestion ultra-rapide des données FILOSOFI avec Polars vers la table stg_filosofi (Bronze)."
)
def stg_filosofi():
    """
    Asset Dagster qui exécute l'ingestion Polars -> PostgreSQL.
    """
    ingestor = DataIngestor(DB_URL)
    # Résolution absolue du chemin vers le fichier CSV
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))
    csv_path = os.path.join(data_dir, "FILOSOFI_CC_csv", "DS_FILOSOFI_CC_2023_data.csv")
    
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Fichier introuvable. Veuillez placer les données INSEE ici : {csv_path}")
        
    ingestor.ingest_csv_to_postgres(csv_path, "stg_filosofi", schema="bronze", sep=";")
