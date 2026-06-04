# 🏠 French Real Estate Market Analysis

> **Projet de Business Intelligence Immobilier — BUT SD3**  
> **Auteurs : Nathan AVENEL et Adrien PINEAU**

---

**Ce projet répond à la problématique :**  
*"Étant donné un prix, une localisation et des caractéristiques, est-ce une bonne affaire immobilière ?"*

Il s'agit d'un pipeline de données **ELT complet** (Extract → Load → Transform) couplé à un **dashboard interactif fullstack**, permettant d'analyser le marché immobilier des 5 départements de Bretagne et de la Loire-Atlantique :
- **44** — Loire-Atlantique
- **29** — Finistère
- **22** — Côtes-d'Armor
- **56** — Morbihan
- **35** — Ille-et-Vilaine

Note: Nous avons choisi de prédéfinir 5 départements mais il est possible de changer la liste des départements à analyser en modifiant le fichier `data_pipeline/immo_pipeline/assets/raw/dvf.py` et la variable `DEPARTEMENTS_LIST`.
---

## 📋 Table des matières

1. [Architecture](#architecture)
2. [Technologies utilisées et pourquoi](#technologies)
3. [Sources de données](#sources)
4. [Structure du projet](#structure)
5. [Démarrage clé en main avec Docker (Recommandé)](#docker)
6. [Installation locale classique (Développement)](#local)
7. [Initialisation des données (pipeline Dagster)](#dagster)
8. [Fonctionnalités du Dashboard](#fonctionnalites)
9. [API Routes](#api)

---

## 🏗️ Architecture <a name="architecture"></a>

Le projet suit une architecture **ELT en 3 couches** orchestrée par Dagster :

```
Sources Externes
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  DAGSTER (Orchestrateur)                            │
│  ┌────────────┐  Polars + psycopg COPY              │
│  │ Ingestion  │──────────────────────────────────►  │
│  │  Python    │  Bulk Insert ultra-rapide           │
│  └────────────┘                                     │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │  PostgreSQL + PostGIS │
              │   Schéma : bronze     │  ← Données brutes
              │   Schéma : gold       │  ← Tables analytiques
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │   dbt Core             │
              │ Transformations SQL    │
              │ Jointures spatiales    │
              │ Indexation GiST       │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Next.js Fullstack    │
              │  Dashboard Interactif │
              │  + Routes API Backend │
              └───────────────────────┘
```

---

## 🛠️ Technologies Utilisées <a name="technologies"></a>

### 🐘 Base de données — PostgreSQL + PostGIS
- **PostgreSQL 16** avec l'extension **PostGIS** active les requêtes et jointures géospatiales.
- PostGIS permet de stocker et d'indexer des géométries (polygones de communes, contours IRIS, zones inondables) et d'effectuer des opérations comme `ST_Within`, `ST_Contains`, `ST_GeomFromGeoJSON` directement en SQL.
- Le script `init.sql` configure automatiquement les extensions et schémas au démarrage du conteneur Docker.
- **Image Docker utilisée** : `postgis/postgis:16-3.4`

### ⚡ Orchestration — Dagster
- **Dagster** est l'orchestrateur du pipeline. Il gère l'enchaînement et le suivi des assets de données (téléchargement → ingestion → transformation dbt).
- Il offre une UI web (port `3001`) permettant de visualiser le graphe des dépendances entre assets, de les matérialiser manuellement ou automatiquement, et de surveiller les exécutions.
- Les assets sont **partitionnés par département** (44, 29, 22, 56, 35) pour permettre des ingestions parallèles.
- **Librairies** : `dagster`, `dagster-webserver`, `dagster-dbt`

### 🐻‍❄️ Ingestion — Polars + psycopg
- **Polars** est une librairie DataFrame ultra-performante (Rust) utilisée pour lire les fichiers CSV/GZ téléchargés et les parser avant insertion.
- **psycopg** (v3) est le driver PostgreSQL et permet l'ingestion par **`COPY`** (bulk insert) — beaucoup plus rapide qu'un `INSERT` ligne par ligne pour des millions de lignes.
- Ensemble, ils permettent d'insérer des centaines de milliers de lignes DVF ou BAN en quelques secondes.

### 🔧 Transformation — dbt Core
- **dbt (data build tool)** transforme les données brutes (couche `bronze`) en tables analytiques (couche `gold`) via des modèles SQL versionés.
- Chaque modèle `.sql` représente une table ou une vue, avec ses propres index, jointures et filtres.
- dbt construit automatiquement les dépendances entre modèles et génère de la documentation.
- Il est intégré à Dagster via `dagster-dbt` : les modèles dbt apparaissent comme des assets Dagster.

### 💻 Frontend & API Backend — Next.js
- **Next.js 16** est le framework React fullstack. Il sert à la fois de :
  - **Frontend** : Dashboard interactif avec carte et panneaux d'analyse (React, Recharts, Leaflet).
  - **Backend** : Routes API serverless (dans `app/api/`) qui interrogent directement PostgreSQL via `pg` (pool de connexions).
- Avantage : un seul processus Node.js gère à la fois le rendu des pages et les requêtes SQL.

### 🗺️ Cartographie — Leaflet + React-Leaflet
- **Leaflet** et **React-Leaflet** gèrent le rendu interactif de la carte (zoom, panoramique, clics sur les marqueurs).
- Les couches de données (communes, zones inondables, marqueurs de biens) sont rendues dynamiquement en fonction du zoom et de la commune sélectionnée.
- Les clusters de marqueurs utilisent **react-leaflet-cluster** pour optimiser l'affichage quand il y a des milliers de points.
- Les calculs géospatiaux côté client (recherche de points dans un polygone) utilisent **Turf.js**.

### 📊 Graphiques — Recharts
- **Recharts** est la librairie de visualisation utilisée pour tous les graphiques statistiques du tableau de bord (évolution des prix, distribution, camembert DPE, etc.).

### 🎞️ Animations — Framer Motion
- **Framer Motion** gère les transitions et animations d'interface pour une expérience utilisateur fluide.

---

## 📂 Sources de Données <a name="sources"></a>

Le pipeline ingère automatiquement **6 sources de données publiques françaises** :

| Source | Couverture | Utilisation dans le projet | Lien |
|--------|-----------|--------------------------|------|
| **DVF** — Demandes de Valeurs Foncières | 2021-2025, depts 44/29/22/56/35 | Prix réels des transactions immobilières (Maisons & Appartements) | [data.gouv.fr](https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/) |
| **DPE** — Diagnostic de Performance Énergétique | Depuis juillet 2021, depts 44/29/22/56/35 | Étiquettes énergétiques et GES des logements (A→G) via l'API ADEME | [data.ademe.fr](https://data.ademe.fr/datasets/dpe-v2-logements-existants) |
| **FILOSOFI** — INSEE | Carroyage national 200m | Données socio-économiques locales (revenus médians, taux de pauvreté) | [insee.fr](https://www.insee.fr/fr/statistiques/8984752) |
| **BAN** — Base Adresse Nationale | Depts 44/29/22/56/35 | Géolocalisation des adresses, correspondance DVF ↔ coordonnées GPS | [adresse.data.gouv.fr](https://adresse.data.gouv.fr/donnees-nationales) |
| **IRIS** — IGN via OpenDataSoft | Depts 44/29/22/56/35 | Contours géographiques des IRIS (quartiers INSEE) pour les jointures spatiales | [OpenDataSoft](https://public.opendatasoft.com/explore/dataset/georef-france-iris-millesime/) |
| **Communes** — Etalab/IGN | France entière (simplifiée) | Géométries des communes pour l'affichage cartographique et la recherche | [france-geojson](https://github.com/gregoiredavid/france-geojson) |
| **PPRN Inondation** — Géorisques | Loire-Atlantique (BBOX) | Périmètres des Plans de Prévention des Risques d'Inondation | [georisques.gouv.fr](https://www.georisques.gouv.fr) |

---

## 📁 Structure du Projet <a name="structure"></a>

```
SAE602/
├── .env.example              # Template des variables d'environnement à copier
├── .dagster/                 # Configuration Dagster (stockage SQLite local)
├── docker-compose.yml        # Orchestration Docker (3 services)
├── init.sql                  # Script SQL d'initialisation PostgreSQL (extensions)
├── Makefile                  # Raccourcis de commandes (up, down, dagster-ui, dbt-run, dev-front)
├── Consignes.md              # Consignes de la SAE
│
├── data_pipeline/            # Pipeline ELT complet
│   ├── Dockerfile            # Image Docker pour Dagster + dbt
│   ├── requirements.txt      # Dépendances Python
│   ├── ingest.py             # Classe utilitaire d'ingestion (COPY PostgreSQL)
│   │
│   ├── immo_pipeline/        # Package Python de la pipeline Dagster
│   │   └── immo_pipeline/
│   │       ├── definitions.py    # Point d'entrée Dagster (tous les assets)
│   │       ├── assets.py         # Asset dbt (build models)
│   │       ├── project.py        # Référence au projet dbt
│   │       ├── schedules.py      # Planification automatique (désactivée)
│   │       ├── dvf.py            # Asset : téléchargement DVF (partitionné par année×département)
│   │       ├── dpe.py            # Asset : téléchargement DPE ADEME (partitionné par département)
│   │       ├── filosofi.py       # Asset : téléchargement FILOSOFI INSEE
│   │       ├── ban.py            # Asset : téléchargement BAN (partitionné par département)
│   │       ├── communes.py       # Asset : téléchargement géométries communes
│   │       ├── iris.py           # Asset : téléchargement contours IRIS (partitionné par département)
│   │       └── inondations.py    # Asset : téléchargement PPRN inondation via WFS Géorisques
│   │
│   └── dbt_project/          # Projet dbt (transformations SQL)
│       ├── profiles.yml          # Connexion PostgreSQL (lit les variables d'environnement)
│       ├── dbt_project.yml       # Configuration du projet dbt
│       ├── models/
│       │   ├── staging/          # Couche intermédiaire (nettoyage et typage)
│       │   │   ├── stg_dvf.sql          # DVF : nettoyage, déduplication, calcul prix/m²
│       │   │   ├── stg_dpe.sql          # DPE : filtrage (étiquette non-nulle), typage
│       │   │   ├── stg_filosofi.sql     # FILOSOFI : extraction revenu médian
│       │   │   ├── stg_communes.sql     # Communes : géométrie PostGIS
│       │   │   ├── stg_iris.sql         # IRIS : géométrie PostGIS
│       │   │   ├── stg_ban.sql          # BAN : coordonnées géocodées
│       │   │   └── stg_zones_inondables.sql  # Zones PPRI : géométrie PostGIS
│       │   └── marts/            # Couche Gold (tables finales analytiques)
│       │       ├── fact_immobilier.sql  # Table principale : biens DVF enrichis (DPE, IRIS, FILOSOFI)
│       │       └── fact_communes.sql    # Table des communes avec stats agrégées
│       └── seeds/                # Données de référence statiques (vide actuellement)
│
└── dashboard/                # Dashboard Next.js (Frontend + API Backend)
    ├── Dockerfile             # Image Docker pour Next.js (production build)
    ├── package.json           # Dépendances Node.js
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx           # Page principale (Dashboard)
    │   │   ├── layout.tsx         # Layout global (métadonnées, polices)
    │   │   ├── globals.css        # Styles globaux
    │   │   └── api/               # Routes API Backend (serverless Next.js)
    │   │       ├── communes/          # Recherche autocomplete de communes
    │   │       ├── immobilier/        # Biens immobiliers avec filtres (prix, DPE, type, commune)
    │   │       │   └── detail/        # Détail d'un bien individuel
    │   │       ├── stats/             # Statistiques agrégées
    │   │       │   ├── route.ts       # KPIs globaux (volume, prix médian, DPE distribution)
    │   │       │   ├── communes/      # Stats par commune (prix médian, volumes)
    │   │       │   ├── iris/          # Stats par IRIS (revenus médians, prix)
    │   │       │   └── streets/       # Stats par rue/quartier
    │   │       ├── compare/           # Comparaison entre deux communes/IRIS
    │   │       ├── estimate/          # Estimation de prix d'un bien
    │   │       ├── pois/              # Points d'intérêt (API externe)
    │   │       └── zones-inondables/  # Polygones PPRI pour une commune
    │   ├── components/
    │   │   ├── Map.tsx            # Carte interactive (Leaflet, clusters, polygones)
    │   │   ├── Sidebar.tsx        # Panneau latéral (filtres, liste des biens, recherche)
    │   │   ├── StatsPage.tsx      # Page d'analyses statistiques (KPIs, graphiques)
    │   │   ├── EstimatorPanel.tsx # Estimateur de prix intelligent
    │   │   └── ComparatorPanel.tsx # Comparateur de territoires
    │   └── lib/
    │       └── db.ts              # Pool de connexions PostgreSQL (pg)
    └── public/                # Assets statiques
```

---

## 🐳 Démarrage clé en main avec Docker (Recommandé) <a name="docker"></a>

> **Cette méthode est recommandée.** Elle ne nécessite aucune installation de Python, Node.js ou PostgreSQL sur votre machine. Tout fonctionne dans des conteneurs isolés.

### Prérequis

1. **Docker Desktop** doit être installé et démarré sur votre machine.
   - 🔗 [Télécharger Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - Vérifiez l'installation avec : `docker --version` et `docker-compose --version`

2. **Cloner le dépôt** sur votre machine :
   ```bash
   git clone https://github.com/Nakann/French-Real-Estate-Market-Analysis.git
   cd French-Real-Estate-Market-Analysis
   ```

### Étape 1 — Configurer l'environnement

Copiez le fichier d'exemple d'environnement à la racine du projet :

```bash
# Sur Linux/Mac :
cp .env.example .env

# Sur Windows (PowerShell) :
Copy-Item .env.example .env
```

> Le fichier `.env` contient les variables de connexion à PostgreSQL. Les valeurs par défaut fonctionnent sans modification.

### Étape 2 — Construire et démarrer tous les services

```bash
docker-compose up --build
```

Cette commande va :
1. **Construire** les images Docker du pipeline Python et du dashboard Next.js (peut prendre 5-10 min la première fois).
2. **Démarrer** les 3 services en parallèle :
   - 🐘 **PostgreSQL + PostGIS** → port `5432` (base de données)
   - 📊 **Dagster (Orchestrateur)** → port `3001` (UI de gestion du pipeline)
   - 💻 **Dashboard Next.js** → port `3000` (interface utilisateur)

> **Note :** Les services `data_pipeline` et `dashboard` attendent que `postgres` soit prêt avant de démarrer (`depends_on`).

### Étape 3 — Accéder aux interfaces

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | [http://localhost:3000](http://localhost:3000) | Interface principale de l'application |
| Dagster UI | [http://localhost:3001](http://localhost:3001) | Gestion du pipeline de données |

### Arrêter les services

```bash
# Arrêter sans supprimer les données
docker-compose stop

# Arrêter et supprimer les conteneurs (les données PostgreSQL sont conservées dans le volume pgdata)
docker-compose down

# Tout supprimer, y compris les données PostgreSQL
docker-compose down -v
```

---

## 💻 Installation locale classique (Développement) <a name="local"></a>

> Utilisez cette méthode si vous souhaitez modifier le code source et développer localement.

### Prérequis

Assurez-vous d'avoir les éléments suivants installés :

| Outil | Version minimale | Vérification | Lien |
|-------|-----------------|-------------|------|
| **Python** | 3.11+ | `python --version` | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| **npm** | 9+ | `npm --version` | (inclus avec Node.js) |
| **Docker Desktop** | Dernière version | `docker --version` | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | 2+ | `git --version` | [git-scm.com](https://git-scm.com/) |
| **Make** | — | `make --version` | [gnuwin32](http://gnuwin32.sourceforge.net/packages/make.htm) (Windows) |

### Étape 1 — Cloner le dépôt

```bash
git clone https://github.com/Nakann/French-Real-Estate-Market-Analysis.git
cd French-Real-Estate-Market-Analysis
```

### Étape 2 — Configurer les variables d'environnement

**À la racine du projet**, créez un fichier `.env` (copiez depuis l'exemple) :

```bash
cp .env.example .env
```

Ouvrez `.env` et adaptez `DAGSTER_HOME` à votre chemin local :

```ini
# Base de données PostgreSQL (laisser tel quel si vous utilisez Docker pour PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=real_estate_db

# Chemin absolu vers le dossier .dagster (ADAPTER à votre machine)
# Windows :
DAGSTER_HOME=D:\Votre\Chemin\Vers\Le\Projet\.dagster
# Linux/Mac :
# DAGSTER_HOME=/home/user/votre-projet/.dagster
```

**Dans le dossier `dashboard/`**, créez un fichier `.env.local` avec les mêmes variables de connexion PostgreSQL (sans `DAGSTER_HOME`) :

```bash
cp .env.example dashboard/.env.local
```

Puis éditez `dashboard/.env.local` pour ne garder que :
```ini
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=real_estate_db
```

### Étape 3 — Démarrer la base de données PostgreSQL

Lancez uniquement le conteneur de base de données (PostgreSQL + PostGIS) :

```bash
make up
# ou équivalent : docker-compose up -d postgres
```

> Cette commande lance PostgreSQL en arrière-plan. Le script `init.sql` est automatiquement exécuté au premier démarrage pour créer les extensions PostGIS et les schémas `bronze` et `gold`.

Vérifiez que le conteneur fonctionne :
```bash
docker ps
# Vous devriez voir : real_estate_db   Up ...
```

### Étape 4 — Installer l'environnement Python

Créez un environnement virtuel et installez les dépendances Python :

```bash
# Créer l'environnement virtuel (à la racine du projet)
python -m venv .venv

# Activer l'environnement virtuel
# Sur Windows (PowerShell) :
.venv\Scripts\Activate.ps1
# Sur Windows (cmd) :
.venv\Scripts\activate.bat
# Sur Linux / Mac :
source .venv/bin/activate

# Vérifier que l'environnement est activé (le nom du venv doit apparaître dans le prompt)
# (.venv) user@machine:~/projet$

# Installer toutes les dépendances Python
pip install -r data_pipeline/requirements.txt
```

**Ce que contient `requirements.txt` et pourquoi :**

| Package | Rôle |
|---------|------|
| `polars` | DataFrame ultra-rapide pour parser les CSV (Rust-based) |
| `psycopg[binary]` | Driver PostgreSQL v3, permet le `COPY` bulk insert |
| `dbt-postgres` | Framework de transformation SQL avec gestion des dépendances |
| `dagster` | Orchestrateur de pipeline (scheduling, monitoring, assets) |
| `dagster-webserver` | Serveur de l'UI web de Dagster |
| `dagster-dbt` | Intégration dbt dans Dagster (assets automatiques) |
| `requests` | Téléchargement des fichiers depuis les APIs publiques |
| `pandas` | Requis par certaines librairies dbt en interne |
| `openpyxl` | Lecture des fichiers Excel (FILOSOFI) |
| `sqlalchemy` | ORM utilisé par Dagster pour son stockage interne |
| `python-dotenv` | Lecture automatique du fichier `.env` |

### Étape 5 — Installer les dépendances Node.js

```bash
cd dashboard
npm install
cd ..
```

> Cette commande lit le fichier `dashboard/package.json` et télécharge toutes les librairies JavaScript nécessaires dans `dashboard/node_modules/`.

---

## 🚀 Initialisation des données (Pipeline Dagster) <a name="dagster"></a>

> ⚠️ **Cette étape est obligatoire** avant de pouvoir utiliser le dashboard. La base de données doit être remplie avec les données réelles.
> ⏱️ **Durée estimée** : 15 minutes à 30 minutes.

### Lancer l'UI Dagster

**Avec Docker :** L'UI Dagster est automatiquement démarrée. Accédez à [http://localhost:3001](http://localhost:3001).

**En local (environnement virtuel activé) :**
```bash
make dagster-ui
# ou équivalent :
cd data_pipeline/immo_pipeline && dagster dev -p 3001
```

> Laissez ce terminal ouvert. Ouvrez ensuite [http://localhost:3001](http://localhost:3001) dans votre navigateur.

### Matérialiser les assets

Dans l'interface Dagster, voici les étapes détaillées :

1. **Cliquez sur "Assets"** dans le menu de gauche.
2. Vous verrez le graphe de dépendances de tous les assets :
   - `raw_dvf` (partitionné par 5 années × 5 départements = 25 partitions)
   - `raw_dpe` (partitionné par 5 départements)
   - `raw_filosofi` (1 partition globale)
   - `raw_communes` (1 partition globale)
   - `raw_ban` (partitionné par 5 départements)
   - `raw_iris` (partitionné par 5 départements)
   - `raw_zones_inondables` (1 partition globale)
   - Les modèles `dbt` (stg_*, fact_*) apparaissent en dessous

3. **Cliquez sur "Materialize all"** en haut à droite.
4. Dagster va **demander quelles partitions matérialiser** — sélectionnez toutes les partitions disponibles.
5. Le pipeline démarre. Vous pouvez suivre la progression dans l'onglet **"Runs"**.

> 💡 **Conseil :** Les assets sont idempotents. Si une ingestion échoue (coupure réseau, API indisponible), vous pouvez la relancer sans risque de doublon.

### Vérifier la réussite

Une fois tous les assets **verts** (succès), vérifiez la présence des données dans PostgreSQL :

```bash
# Se connecter à la base de données (si Docker est utilisé)
docker exec -it real_estate_db psql -U postgres -d real_estate_db

# Dans le prompt psql :
SELECT COUNT(*) FROM gold.fact_immobilier;
-- Attendu : ~200 000 à 400 000 lignes

SELECT COUNT(*) FROM gold.fact_communes;
-- Attendu : ~2 000 communes

\q   # Pour quitter
```

### Lancer le Dashboard

**Avec Docker :** Le dashboard est déjà démarré. Rendez-vous sur [http://localhost:3000](http://localhost:3000).

**En local :**
```bash
make dev-front
# ou équivalent :
cd dashboard && npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000). 🎉

---

## 🌟 Fonctionnalités du Dashboard <a name="fonctionnalites"></a>

### 1. 🗺️ Carte Interactive

La carte principale (page d'accueil) est le cœur de l'application.

**Barre de recherche & Filtres (Sidebar gauche) :**
- **Recherche de commune** : Autocomplétion instantanée pour trouver n'importe quelle commune des 5 départements.
- **Filtre par type de bien** : Appartement, Maison ou les deux.
- **Filtre par étiquette DPE** : Sélection multiple des classes énergétiques A, B, C, D, E, F, G.
- **Filtre par fourchette de prix** : Curseur de plage du prix au m².
- **Filtre par superficie** : Surface habitable minimale et maximale.
- **Liste des biens** : Affichage scrollable de tous les biens correspondant aux filtres avec leur prix, surface et DPE.

**Carte (panneau principal) :**
- **Marqueurs de biens** : Chaque point représente une transaction DVF. La couleur correspond à l'étiquette DPE du logement (A=vert → G=rouge).
- **Clustering automatique** : Quand beaucoup de points sont proches, ils se regroupent en clusters avec un compteur. Zoomez pour les séparer.
- **Polygone de commune** : Quand vous sélectionnez une commune, son contour s'affiche sur la carte avec ses statistiques (prix médian, volume de transactions).
- **Zones PPRI (Inondation)** : Les périmètres des Plans de Prévention des Risques d'Inondation approuvés s'affichent en bleu semi-transparent quand vous consultez une commune.
- **Popup de bien** : Un clic sur un marqueur ouvre une fiche détaillée du bien (adresse, prix, surface, DPE, étiquette GES, nombre de pièces, date de mutation).

### 2. 📊 Analyses & Statistiques (`/stats`)

Un onglet dédié aux analyses statistiques avancées.

**KPIs Globaux :**
- Volume total de transactions analysées
- Prix médian au m² (avec distinction Maison vs Appartement)
- Surface habitable moyenne
- Pourcentage de logements avec un DPE renseigné

**Évolution Temporelle :**
- Graphique linéaire de l'évolution trimestrielle du prix médian au m².
- Filtre par type de bien (Maison / Appartement).
- Permet d'identifier les tendances du marché sur 2021-2025.

**Distribution des Étiquettes DPE :**
- Graphique en barres ou camembert de la répartition des classes énergétiques.
- Visualisation de la performance énergétique du parc immobilier local.

**Distribution des Prix :**
- Histogramme des prix de vente au m² pour comprendre la dispersion du marché.

**Statistiques par commune :**
- Tableau comparatif des communes avec leur prix médian, volume de transactions et revenu médian INSEE.

### 3. 🔮 Estimateur de Prix Intelligent

Un outil d'estimation basé sur les données réelles DVF.

**Comment ça fonctionne :**
1. Entrez les caractéristiques du bien : surface (m²), nombre de pièces, type (Appartement/Maison), étiquette DPE souhaitée.
2. Sélectionnez la commune ou le quartier (IRIS) cible.
3. L'estimateur calcule le **prix médian réel au m²** des ventes similaires dans ce secteur géographique et cette période récente.
4. Il affiche :
   - Le prix estimé total et au m²
   - La fourchette basse/haute (percentiles 25-75)
   - L'impact de l'étiquette DPE sur le prix (en % par rapport aux logements F/G)
   - Le revenu médian local INSEE (contexte socio-économique)

### 4. ⚖️ Comparateur de Territoires

Outil de comparaison côte à côte de deux zones géographiques.

**Fonctionnement :**
1. Sélectionnez deux communes ou deux quartiers IRIS.
2. L'outil affiche une **comparaison visuelle** sur :
   - Prix médian au m² (Maison et Appartement séparément)
   - Volume de transactions récentes
   - Revenu médian des ménages (INSEE FILOSOFI)
   - Taux de pauvreté
   - Répartition des étiquettes DPE
   - Surface habitable moyenne des biens vendus

**Utilité :** Idéal pour comparer deux villes voisines (ex: Nantes vs Saint-Nazaire) ou deux quartiers d'une même ville.

---

## 🔌 API Routes (Backend) <a name="api"></a>

Le backend Next.js expose les routes API suivantes, toutes interrogeant PostgreSQL :

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/communes?query=<texte>` | GET | Autocomplétion de communes (nom + code INSEE) |
| `/api/immobilier?commune=<code>&dpe=<A,B,C>&type=<Maison>` | GET | Liste paginée des biens avec filtres |
| `/api/immobilier/detail?id=<id>` | GET | Détail complet d'un bien |
| `/api/stats?commune=<code>` | GET | KPIs globaux pour une commune ou région |
| `/api/stats/communes` | GET | Stats agrégées par commune (prix médian, volumes) |
| `/api/stats/iris?commune=<code>` | GET | Stats par IRIS pour une commune |
| `/api/stats/streets?commune=<code>` | GET | Stats par rue |
| `/api/compare?zone1=<code>&zone2=<code>` | GET | Comparaison entre deux zones |
| `/api/estimate` | POST | Estimation de prix (body JSON avec les caractéristiques) |
| `/api/zones-inondables?commune=<code>` | GET | Polygones PPRI GeoJSON pour une commune |

---

## 🔧 Commandes Makefile

| Commande | Description |
|----------|-------------|
| `make up` | Démarre le conteneur PostgreSQL en arrière-plan |
| `make down` | Arrête et supprime les conteneurs |
| `make dagster-ui` | Lance l'UI Dagster sur le port 3001 (local) |
| `make dbt-run` | Exécute `dbt run` pour transformer les données |
| `make dev-front` | Lance le serveur de développement Next.js sur le port 3000 |

---

## ⚠️ Notes importantes

- **Durée d'ingestion :** La première matérialisation complète prend entre 15 et 30 minutes.
- **Ressources système :** Le pipeline DVF (25 partitions) et les opérations `ST_Within` de dbt sur des millions de lignes sont gourmands en RAM et CPU. Recommandé : **8 Go de RAM minimum**.
- **API Géorisques :** L'API WFS de Géorisques peut être lente ou indisponible occasionnellement. En cas d'échec, l'asset `raw_zones_inondables` utilise des données de démonstration (rectangles simplifiés). Relancez l'asset si l'API est disponible.
- **Clef d'environnement `DAGSTER_HOME` :** En mode local, ce chemin doit être un **chemin absolu** vers le répertoire `.dagster` du projet. Un chemin relatif peut causer des erreurs.

---

*Projet réalisé dans le cadre de la SAE 601 — BUT Science des Données — 3ème année*
