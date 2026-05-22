# importers/dvf.py
import os
import requests
import pandas as pd
from sqlalchemy import create_engine

DVF_LINKS = {
    "2021": "https://static.data.gouv.fr/resources/demandes-de-valeurs-foncieres/20260405-002223/valeursfoncieres-2021.txt.zip",
    "2022": "https://static.data.gouv.fr/resources/demandes-de-valeurs-foncieres/20260405-002236/valeursfoncieres-2022.txt.zip",
    "2023": "https://static.data.gouv.fr/resources/demandes-de-valeurs-foncieres/20260405-002251/valeursfoncieres-2023.txt.zip",
    "2024": "https://static.data.gouv.fr/resources/demandes-de-valeurs-foncieres/20260405-002306/valeursfoncieres-2024.txt.zip",
    "2025": "https://static.data.gouv.fr/resources/demandes-de-valeurs-foncieres/20260405-002321/valeursfoncieres-2025.txt.zip"
}

COLONNES_A_GARDER = [
    "Identifiant de document", "Reference document", "1 Articles CGI", "2 Articles CGI",
    "3 Articles CGI", "4 Articles CGI", "5 Articles CGI", "No disposition", "Date mutation",
    "Nature mutation", "Valeur fonciere", "No voie", "B/T/Q", "Type de voie", "Code voie",
    "Voie", "Code postal", "Commune", "Code departement", "Code commune", "Prefixe de section",
    "Section", "No plan", "No Volume", "1er lot", "Surface Carrez du 1er lot", "Nombre de lots",
    "Code type local", "Type local", "Identifiant local", "Surface reelle bati",
    "Nombre pieces principales", "Nature culture", "Nature culture speciale", "Surface terrain"
]

def download_dvf_file(year, url):
    """Télécharge le fichier ZIP s'il n'est pas déjà là."""
    os.makedirs("data", exist_ok=True)
    local_path = os.path.join("data", f"valeursfoncieres-{year}.txt.zip")
    
    if os.path.exists(local_path):
        print(f"[DVF {year}] Le fichier est déjà sur le disque dur. Parfait !")
        return local_path

    print(f"[DVF {year}] Téléchargement en cours depuis static.data.gouv.fr...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(local_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"[DVF {year}] Téléchargement terminé.")
    return local_path

def import_all_dvf_to_postgres(db_connection_string):
    """Injecte l'historique en affichant la progression en temps réel."""
    engine = create_engine(db_connection_string)
    is_very_first_chunk = True
    total_global_rows = 0
    
    for year, url in DVF_LINKS.items():
        print(f"\n--- DEBUT DU TRAITEMENT DE L'ANNEE {year} ---")
        file_path = download_dvf_file(year, url)
        
        chunk_size = 50000
        chunks = pd.read_csv(
            file_path, sep='|', compression='zip', chunksize=chunk_size,
            low_memory=False, dtype=str, encoding='utf-8'
        )
        
        year_rows = 0
        for chunk in chunks:
            colonnes_presentes = [col for col in COLONNES_A_GARDER if col in chunk.columns]
            chunk_propre = chunk[colonnes_presentes]
            
            if_exists_strategy = 'replace' if is_very_first_chunk else 'append'
            
            chunk_propre.to_sql(
                name='stg_dvf', con=engine, if_exists=if_exists_strategy, index=False
            )
            
            is_very_first_chunk = False
            year_rows += len(chunk_propre)
            total_global_rows += len(chunk_propre)
            
            # CE PRINT EST NOUVEAU : Il te montre que ça avance en direct !
            print(f"   -> [{year}] {year_rows} lignes traitées et envoyées en base...")
            
        print(f"[DVF {year}] Étape validée. Total pour l'année : {year_rows} lignes.")

    print(f"\n[DVF HISTORIQUE] Pipeline terminé avec succès ! Total général : {total_global_rows} lignes.")