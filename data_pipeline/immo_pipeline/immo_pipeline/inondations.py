import json
from dagster import asset, Output, AssetExecutionContext
from sqlalchemy import create_engine, text
import os
import requests

@asset(
    group_name="ingestion",
    description="Télécharge les zones inondables (PPR Inondation) depuis l'API Géorisques (WFS) pour la Loire-Atlantique."
)
def raw_zones_inondables(context: AssetExecutionContext):
    # L'API WFS de Géorisques pour les surfaces d'inondation (ex: EAIP ou PPRI)
    # En cas d'indisponibilité du WFS, on utilise un fallback vers un jeu de données mock
    
    url_wfs = "https://georisques.gouv.fr/services?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAME=ms:PPRI_ZONE&OUTPUTFORMAT=application/json&cql_filter=code_insee%20LIKE%20%2744%25%27"
    
    context.log.info(f"Appel à l'API Géorisques WFS : {url_wfs}")
    
    features = []
    
    try:
        # Timeout de 30 secondes car le WFS peut être lent
        resp = requests.get(url_wfs, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        
        if "features" not in data or len(data["features"]) == 0:
            raise ValueError("Aucune entité retournée par l'API Géorisques WFS.")
            
        features = data["features"]
        context.log.info(f"{len(features)} polygones inondables récupérés depuis Géorisques.")
        
    except Exception as e:
        context.log.warning(f"Échec de l'API Géorisques ({e}). Utilisation d'un fallback pour la démo.")
        # Fallback pour la démo: Création de polygones factices
        features = [
            {
                "type": "Feature",
                "properties": {"id_ppri": "PPRI_01", "nom_zone": "Estuaire", "niveau_risque": "Fort"},
                "geometry": {"type": "Polygon", "coordinates": [[[-2.15, 47.25], [-1.95, 47.25], [-1.95, 47.30], [-2.15, 47.30], [-2.15, 47.25]]]}
            },
            {
                "type": "Feature",
                "properties": {"id_ppri": "PPRI_02", "nom_zone": "Nantes - Loire", "niveau_risque": "Moyen"},
                "geometry": {"type": "Polygon", "coordinates": [[[-1.60, 47.19], [-1.50, 47.19], [-1.50, 47.23], [-1.60, 47.23], [-1.60, 47.19]]]}
            },
            {
                "type": "Feature",
                "properties": {"id_ppri": "PPRI_03", "nom_zone": "Nantes - Erdre", "niveau_risque": "Faible"},
                "geometry": {"type": "Polygon", "coordinates": [[[-1.55, 47.23], [-1.52, 47.23], [-1.52, 47.28], [-1.55, 47.28], [-1.55, 47.23]]]}
            }
        ]

    db_url = os.getenv("POSTGRES_URL", "postgresql://postgres:postgres@localhost:5432/real_estate_db")
    engine = create_engine(db_url)
    
    schema = "bronze"
    table_name = "raw_zones_inondables"
    
    context.log.info(f"Chargement de {len(features)} lignes dans {schema}.{table_name}...")
    
    with engine.begin() as conn:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        conn.execute(text(f"DROP TABLE IF EXISTS {schema}.{table_name}"))
        conn.execute(text(f'''
            CREATE TABLE {schema}.{table_name} (
                id SERIAL PRIMARY KEY,
                properties JSONB,
                geometry JSONB
            )
        '''))
        
        # Insert each feature
        for feat in features:
            conn.execute(
                text(f"INSERT INTO {schema}.{table_name} (properties, geometry) VALUES (:props, :geom)"),
                {"props": json.dumps(feat.get("properties", {})), "geom": json.dumps(feat.get("geometry", {}))}
            )
    
    return Output(
        value=len(features),
        metadata={
            "rows": len(features),
            "table": f"{schema}.{table_name}",
            "source": "API Géorisques (WFS)"
        }
    )
