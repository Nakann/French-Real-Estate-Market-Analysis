FROM python:3.11-slim

WORKDIR /app

# Installe les dépendances système nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copie et installe les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie le reste du code de data_pipeline
COPY . .

# Définit le dossier home de Dagster
ENV DAGSTER_HOME=/app/.dagster

EXPOSE 3001

# Place le répertoire de travail là où se trouve pyproject.toml de Dagster
WORKDIR /app/immo_pipeline

# Démarre le serveur Dagster accessible de l'extérieur
CMD ["dagster", "dev", "-h", "0.0.0.0", "-p", "3001"]
