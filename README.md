# French Real Estate Market Analysis 🏠📊

Ce projet a pour objectif de construire un outil d'aide à la décision (Business Intelligence / Data Science) pour le marché immobilier français. Il permet de répondre à une question centrale : **Étant donné un prix, une localisation et des caractéristiques d'un bien, s'agit-il d'une bonne affaire ?**

Le projet est réalisé dans le cadre de la SAE 602 (BUT Science des Données - Semestre 3).

---

## 🚀 Fonctionnalités principales

* **Pipeline Ingestion & Transformation** : Extraction, nettoyage et croisement de plusieurs millions de lignes de données publiques.
* **Analyses Spatiales Avancées** :
  * Calcul de la distance réelle aux points d'intérêt (Gares, Écoles).
  * Détermination de l'exposition au bruit (zones de bruit PEB des aéroports).
  * Géocodage précis des transactions immobilières (DVF) via la Base Adresse Nationale (BAN).
* **Évaluation Énergétique** : Analyse de l'impact des classes DPE sur la valeur foncière.
* **Dashboard Décisionnel** : Visualisation cartographique, estimateur de prix et recherche d'opportunités d'achat.

---

## 🛠️ Stack Technique

* **Base de données** : PostgreSQL 16
* **Extension spatiale** : PostGIS 3.6
* **Traitement & Ingestion** : Python (Pandas, GeoPandas, SQLAlchemy)
* **Visualisation** : Dashboard interactif / Cartes choroplèthes

---

## 📂 Structure du Projet

```text
├── Consignes.md         # Consignes détaillées du projet (ignoré par Git)
├── schema.sql           # Schéma de base de données PostgreSQL + PostGIS
├── .gitignore           # Fichiers à exclure du dépôt Git (données volumineuses, venv, etc.)
└── README.md            # Présentation générale du projet
```

---

## ⚙️ Installation & Démarrage Rapide

### 1. Prérequis
1. Téléchargez et installez **PostgreSQL 16** (avec l'extension **PostGIS** via Stack Builder) ou lancez-le via Docker.
2. Clonez le dépôt et configurez votre environnement de développement :
   ```bash
   git clone https://github.com/Nakann/French-Real-Estate-Market-Analysis.git
   cd French-Real-Estate-Market-Analysis
   ```

### 2. Initialisation de la base de données
Connectez-vous à votre serveur PostgreSQL et exécutez le script d'initialisation du schéma :
```bash
psql -U postgres -d real_estate_db -f schema.sql
```
*(Vous pouvez également importer et exécuter [schema.sql](schema.sql) directement dans DBeaver ou pgAdmin).*
