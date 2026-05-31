WITH raw AS (
    SELECT * FROM {{ source('bronze', 'raw_dvf') }}
),
parsed AS (
    SELECT
        id_mutation,
        CAST(NULLIF(date_mutation, '') AS DATE) AS date_mutation,
        CAST(REPLACE(NULLIF(valeur_fonciere, ''), ',', '.') AS NUMERIC) AS valeur_fonciere,
        adresse_numero,
        adresse_nom_voie,
        TRIM(COALESCE(adresse_numero, '') || ' ' || COALESCE(adresse_nom_voie, '')) AS adresse_complete,
        code_commune,
        code_departement,
        CAST(NULLIF(surface_reelle_bati, '') AS NUMERIC) AS surface_reelle_bati,
        type_local,
        CAST(REPLACE(NULLIF(longitude, ''), ',', '.') AS NUMERIC) AS longitude,
        CAST(REPLACE(NULLIF(latitude, ''), ',', '.') AS NUMERIC) AS latitude,
        COUNT(*) OVER (PARTITION BY id_mutation) as nb_lignes_mutation
    FROM raw
)
SELECT *
FROM parsed
WHERE type_local IN ('Appartement', 'Maison')
  AND valeur_fonciere IS NOT NULL
  AND valeur_fonciere <= 5000000
  AND nb_lignes_mutation <= 3
