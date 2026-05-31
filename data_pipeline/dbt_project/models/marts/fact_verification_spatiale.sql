{{
  config(
    materialized='table'
  )
}}

-- Récupération des transactions avec coordonnées
WITH transactions AS (
    SELECT
        id_mutation,
        adresse_numero,
        adresse_nom_voie,
        code_commune,
        code_departement,
        longitude,
        latitude,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geometry_dvf
    FROM {{ ref('stg_dvf') }}
    WHERE longitude IS NOT NULL AND latitude IS NOT NULL
      AND adresse_nom_voie IS NOT NULL
),

-- Récupération des adresses BAN
adresses_ban AS (
    SELECT
        id_ban,
        numero,
        nom_voie,
        code_commune,
        geometry AS geometry_ban
    FROM {{ ref('stg_ban') }}
)

SELECT
    t.id_mutation,
    t.adresse_numero,
    t.adresse_nom_voie,
    t.code_commune,
    t.code_departement,
    b.id_ban,
    -- Distance en mètres entre les coordonnées DVF et les coordonnées BAN officielles
    -- On utilise ST_DistanceSphere pour obtenir la distance en mètres
    ST_DistanceSphere(t.geometry_dvf, b.geometry_ban) AS distance_meters
FROM transactions t
LEFT JOIN adresses_ban b 
  ON t.code_commune = b.code_commune
 AND LOWER(t.adresse_nom_voie) = LOWER(b.nom_voie)
 AND COALESCE(t.adresse_numero, '') = COALESCE(b.numero, '')
