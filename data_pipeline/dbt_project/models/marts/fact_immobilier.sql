{{
  config(
    materialized='table',
    indexes=[
      {'columns': ['latitude', 'longitude']},
      {'columns': ['code_commune']},
      {'columns': ['etiquette_dpe']}
    ]
  )
}}

-- ─── DVF pré-agrégé ───────────────────────────────────────────────────────────
-- On sélectionne uniquement les ventes avec coordonnées GPS valides
WITH ventes AS (
    SELECT
        id_mutation,
        CAST(NULLIF(date_mutation, '') AS DATE)                              AS date_mutation,
        CAST(REPLACE(NULLIF(valeur_fonciere, ''), ',', '.') AS NUMERIC)     AS valeur_fonciere,
        CAST(NULLIF(surface_reelle_bati, '') AS NUMERIC)                    AS surface_reelle_bati,
        type_local,
        TRIM(COALESCE(adresse_numero,'') || ' ' || COALESCE(adresse_nom_voie,'')) AS adresse_complete,
        code_commune,
        code_departement,
        CAST(REPLACE(NULLIF(longitude,''),',','.') AS NUMERIC)              AS longitude,
        CAST(REPLACE(NULLIF(latitude, ''),',','.') AS NUMERIC)             AS latitude
    FROM {{ source('bronze', 'raw_dvf') }}
    WHERE type_local IN ('Appartement', 'Maison')
      AND NULLIF(valeur_fonciere, '') IS NOT NULL
      AND NULLIF(longitude, '') IS NOT NULL
      AND NULLIF(latitude,  '') IS NOT NULL
),

-- ─── DPE : un enregistrement par commune ─────────────────────────────────────
dpe_par_commune AS (
    SELECT DISTINCT ON (code_insee_ban)
        code_insee_ban                                                       AS code_commune,
        etiquette_dpe,
        etiquette_ges,
        conso_5_usages_par_m2_ep                                            AS consommation_energie
    FROM {{ source('bronze', 'raw_dpe') }}
    WHERE code_insee_ban IS NOT NULL
      AND code_insee_ban != ''
    ORDER BY code_insee_ban, date_etablissement_dpe DESC
),

-- ─── Filosofi : déjà pivoté ───────────────────────────────────────────────────
socio AS (
    SELECT * FROM {{ ref('stg_filosofi') }}
)

-- ─── Jointure finale ──────────────────────────────────────────────────────────
SELECT
    v.id_mutation,
    v.date_mutation,
    v.valeur_fonciere,
    v.surface_reelle_bati,
    v.type_local,
    CASE
        WHEN v.surface_reelle_bati > 0 THEN v.valeur_fonciere / v.surface_reelle_bati
        ELSE NULL
    END                                                                      AS prix_m2,
    v.adresse_complete,
    v.code_commune,
    v.code_departement,
    v.longitude,
    v.latitude,
    -- DPE
    d.etiquette_dpe,
    d.etiquette_ges,
    d.consommation_energie,
    -- Socio-éco
    s.niveau_vie_median,
    s.taux_pauvrete,
    s.indice_gini

FROM ventes v
LEFT JOIN dpe_par_commune d ON d.code_commune = v.code_commune
LEFT JOIN socio          s ON s.code_commune = v.code_commune
