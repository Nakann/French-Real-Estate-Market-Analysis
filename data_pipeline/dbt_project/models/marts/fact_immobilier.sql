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
WITH raw_ventes AS (
    SELECT
        id_mutation,
        date_mutation,
        valeur_fonciere,
        surface_reelle_bati,
        type_local,
        adresse_complete,
        code_commune,
        code_departement,
        longitude,
        latitude
    FROM {{ ref('stg_dvf') }}
),

ventes_count AS (
    -- On compte combien de locaux principaux (Maison/Appartement) figurent dans chaque transaction
    -- Les dépendances, caves, parkings sont ignorés de ce comptage
    SELECT id_mutation
    FROM raw_ventes
    WHERE type_local IN ('Appartement', 'Maison')
    GROUP BY id_mutation
    HAVING COUNT(*) = 1
),

ventes AS MATERIALIZED (
    SELECT r.*,
           ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326) AS geom
    FROM raw_ventes r
    INNER JOIN ventes_count vc ON r.id_mutation = vc.id_mutation
    WHERE r.type_local IN ('Appartement', 'Maison')
      AND r.valeur_fonciere IS NOT NULL
      AND r.surface_reelle_bati > 0
      AND r.longitude IS NOT NULL
      AND r.latitude IS NOT NULL
      -- Filtre anti-aberrations sur le prix au m²
      AND (r.valeur_fonciere / r.surface_reelle_bati) BETWEEN 500 AND 30000
),

-- ─── Vérification spatiale ───────────────────────────────────────────────────
verif AS MATERIALIZED (
    SELECT 
        id_mutation, 
        MAX(id_ban) AS id_ban,
        MIN(distance_meters) AS distance_meters
    FROM {{ ref('fact_verification_spatiale') }}
    GROUP BY id_mutation
),

-- ─── DPE : un enregistrement par adresse BAN ─────────────────────────────────────
dpe_par_ban AS MATERIALIZED (
    SELECT DISTINCT ON (identifiant_ban)
        identifiant_ban,
        etiquette_dpe,
        etiquette_ges,
        conso_5_usages_par_m2_ep                                            AS consommation_energie
    FROM {{ source('bronze', 'raw_dpe') }}
    WHERE identifiant_ban IS NOT NULL
      AND identifiant_ban != ''
      AND identifiant_ban IN (SELECT id_ban FROM verif)
    ORDER BY identifiant_ban, date_etablissement_dpe DESC
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
    s.indice_gini,
    -- Fiabilité Localisation
    verif.distance_meters AS distance_ban,
    -- Risques naturels (Désactivé pour perfs de la démo pour le moment)
    FALSE AS in_zone_inondable

FROM ventes v
LEFT JOIN verif          verif ON verif.id_mutation = v.id_mutation
LEFT JOIN dpe_par_ban    d ON d.identifiant_ban = verif.id_ban
LEFT JOIN socio          s ON s.code_commune = v.code_commune

