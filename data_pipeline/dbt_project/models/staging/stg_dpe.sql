WITH raw AS (
    SELECT * FROM {{ source('bronze', 'raw_dpe') }}
)

SELECT
    numero_dpe,
    CAST(NULLIF(date_etablissement_dpe, '') AS DATE) AS date_etablissement_dpe,
    identifiant_ban,
    adresse_brut,
    code_insee_ban AS code_commune,
    CAST(NULLIF(surface_habitable_immeuble, '') AS NUMERIC) AS surface_habitable,
    CAST(NULLIF(conso_5_usages_par_m2_ep, '') AS NUMERIC) AS consommation_energie,
    etiquette_dpe,
    etiquette_ges
FROM raw
WHERE NULLIF(etiquette_dpe, '') IS NOT NULL
