# main.py
import os
from dotenv import load_dotenv
from importers.dvf import import_all_dvf_to_postgres
from importers.dpe import import_dpe_to_postgres

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if __name__ == "__main__":
    print("[PROJET MAISON] Lancement du pipeline...")
    
    # Sécurité : On vérifie si la variable a bien été trouvée
    if not DATABASE_URL:
        raise ValueError(
            "[ERREUR] Impossible de trouver 'DATABASE_URL' dans le fichier .env. "
            "Vérifie que le fichier s'appelle exactement '.env' et qu'il contient la bonne clé."
        )
    
    
    # print("[DVF] Historisation globale sur 5 ans...")
    # import_all_dvf_to_postgres(DATABASE_URL)
    

    print("[DPE] Début de l'importation des données ADEME (.geojson)...")
    import_dpe_to_postgres(DATABASE_URL)