# French Real Estate Market Analysis (SAE 2026)

**Auteurs : Nathan AVENEL et Adrien PINEAU**

Ce projet de Business Intelligence (BI) immobilier permet de répondre à la problématique :
**"Étant donné un prix, une localisation et des caractéristiques, est-ce une bonne affaire immobilière ?"**

## 🏗️ Architecture ELT

```mermaid
graph TD
    subgraph sources [Sources de Données]
        DVF(Fichiers DVF)
        DPE(Fichiers DPE)
        INSEE(Fichiers INSEE/FILOSOFI)
    end

    subgraph pipeline [Data Pipeline Python, Dagster et dbt]
        Dagster(Orchestrateur Dagster)
        Polars(Polars / psycopg)
        DBT(dbt Core)
    end

    subgraph bdd [Base de données]
        PG[(PostgreSQL + PostGIS)]
        SchemaBronze[Staging / Raw]
        SchemaGold[Marts / Clean]
    end

    subgraph dash [Dashboard Next.js]
        SC[Server Components API]
        UI[Frontend UI Interactive]
    end

    DVF -->|Orchestré par Dagster| Polars
    DPE -->|Orchestré par Dagster| Polars
    INSEE -->|Orchestré par Dagster| Polars
    
    Polars -->|Bulk COPY ultra-rapide| SchemaBronze
    
    SchemaBronze -->|Transformations SQL| DBT
    DBT -->|Création table matérialisée| SchemaGold
    
    SchemaGold -->|Requêtes géospatiales| SC
    SC -->|Données enrichies (Polygones IGN)| UI
```

## ⚙️ Prérequis & Installation

Avant de pouvoir lancer le projet, vous devez installer les dépendances et configurer votre environnement de développement.

### 1. Variables d'environnement (`.env`)
À la racine du projet (et également dans le dossier `dashboard/` sous le nom `.env.local`), créez un fichier pour configurer l'accès à PostgreSQL et à Dagster.
Voici l'exemple de ce que le fichier doit contenir :
```ini
# Base de données PostgreSQL (Défaut : postgres/postgres)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/real_estate_db

# Dossier local pour Dagster
DAGSTER_HOME=D:\Votre\Chemin\Absolu\Vers\Le\Projet\.dagster
```

### 2. Environnement Python (Pipeline)
Le pipeline de données utilise Python. Il faut créer un environnement virtuel et installer les paquets requis (dbt, dagster, polars, etc.) :
```bash
python -m venv .venv
# Activer l'environnement (sous Windows) :
.venv\Scripts\activate
# (ou sous Linux/Mac : source .venv/bin/activate)

# Installer les dépendances
pip install -r data_pipeline/requirements.txt
```

### 3. Dépendances Node.js (Frontend)
Installez les dépendances du Dashboard Next.js :
```bash
cd dashboard
npm install
cd ..
```

## 🚀 Démarrage Rapide : de A à Z

Voici l'ordre exact des commandes à lancer pour initialiser le projet de zéro. Toutes ces commandes s'appuient sur le `Makefile` inclus (assurez-vous d'avoir votre environnement virtuel activé).

### 1. Démarrer la base de données
Lancez le conteneur Docker PostgreSQL (avec PostGIS) en arrière-plan :
```bash
make up
```
*(Pour couper la base de données plus tard, vous pourrez utiliser `make down`)*

### 2. Ingestion des données brutes via Dagster (Couche Bronze)
Démarrez l'interface d'orchestration Dagster :
```bash
make dagster-ui
```
* Ouvrez votre navigateur sur **http://localhost:3001**
* Dans l'onglet "Assets", cliquez sur **Materialize all**
* Dagster va télécharger, traiter via Polars, et insérer toutes les données dans la base PostgreSQL de manière optimisée.

### 3. Transformation des données (Couche Gold via dbt)
Une fois l'ingestion Dagster terminée avec succès, exécutez la transformation dbt. Cette commande va créer des index et matérialiser la table finale prête à l'emploi :
```bash
make dbt-run
```
*(Patientez quelques instants, cette commande effectue des jointures sur des millions de lignes).*

### 4. Lancer le Dashboard interactif
Démarrez le serveur Next.js pour le frontend :
```bash
make dev-front
```
* Ouvrez votre navigateur sur **http://localhost:3000**
* Vous pouvez maintenant explorer la carte, filtrer par DPE, rechercher des communes et voir les géométries dynamiques se charger en temps réel !

---

## 📂 Sources de données

1. **DVF (Demandes de Valeurs Foncières)** : Historique des transactions immobilières en France (static.data.gouv.fr).
2. **DPE (Diagnostic de Performance Énergétique)** : Données énergétiques de l'ADEME (data.ademe.fr).
3. **FILOSOFI (INSEE)** : Données socio-économiques locales (Population, Revenu médian, etc.).
4. **API Cadastre (IGN)** : Interrogation dynamique côté frontend pour récupérer les emprises au sol (polygones) des bâtiments.
