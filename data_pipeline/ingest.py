"""
Squelette d'ingestion ultra-rapide avec Polars et PostgreSQL COPY.
"""
import os
import polars as pl
import psycopg
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/real_estate_db")

class DataIngestor:
    def __init__(self, db_url: str):
        self.db_url = db_url

    def ingest_csv_to_postgres(self, file_path: str, table_name: str, schema: str = "bronze", sep: str = ";"):
        """
        Lit un fichier CSV via Polars et l'insère massivement dans PostgreSQL via COPY.
        """
        print(f"[{table_name}] Lecture du fichier {file_path} avec Polars...")
        
        # 1. Lecture rapide avec Polars
        # On infère les colonnes comme du texte brut (String) pour le Staging
        df = pl.read_csv(file_path, separator=sep, infer_schema_length=0)
        
        print(f"[{table_name}] {len(df)} lignes chargées en mémoire. Préparation de l'insertion...")
        
        # 2. Connexion et insertion massive via psycopg (COPY)
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                # Création automatique de la table dans le schéma cible
                columns = [f'"{col}" TEXT' for col in df.columns]
                cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema};")
                cur.execute(f"DROP TABLE IF EXISTS {schema}.{table_name};")
                cur.execute(f"CREATE TABLE {schema}.{table_name} ({', '.join(columns)});")
                
                # Bulk COPY en mode tuples pour un maximum de perfs
                cols_str = ', '.join([f'"{c}"' for c in df.columns])
                copy_query = f"COPY {schema}.{table_name} ({cols_str}) FROM STDIN"
                
                print(f"[{table_name}] Début de l'insertion COPY vers PostgreSQL...")
                with cur.copy(copy_query) as copy:
                    for row in df.iter_rows():
                        copy.write_row(row)
                        
            conn.commit()
        print(f"[{table_name}] Ingestion terminée avec succès dans {schema}.{table_name} !\n")

    def insert_dataframe(self, df: pl.DataFrame, table_name: str, schema: str = "bronze"):
        """
        Insère un DataFrame Polars dans PostgreSQL via COPY sans faire de DROP TABLE.
        S'assure que la table et le schéma existent avec toutes les colonnes en TEXT.
        """
        print(f"[{table_name}] Préparation de l'insertion de {len(df)} lignes...")
        
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                # Création automatique de la table si elle n'existe pas
                columns = [f'"{col}" TEXT' for col in df.columns]
                cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema};")
                cur.execute(f"CREATE TABLE IF NOT EXISTS {schema}.{table_name} ({', '.join(columns)});")
                
                # Bulk COPY
                cols_str = ', '.join([f'"{c}"' for c in df.columns])
                copy_query = f"COPY {schema}.{table_name} ({cols_str}) FROM STDIN"
                
                with cur.copy(copy_query) as copy:
                    for row in df.iter_rows():
                        copy.write_row(row)
                        
            conn.commit()
        print(f"[{table_name}] Insertion terminée avec succès !\n")

if __name__ == "__main__":
    # Test d'exemple
    print("Squelette d'ingestion prêt. Instanciez DataIngestor pour l'utiliser.")
