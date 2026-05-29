WITH raw AS (
    SELECT * FROM {{ source('bronze', 'raw_filosofi') }}
    WHERE geo = 'COM' -- Uniquement les communes
)

SELECT
    geo_object AS code_commune,
    MAX(CASE WHEN filosofi_measure = 'MED_SL' AND obs_value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST(obs_value AS NUMERIC) END) AS niveau_vie_median,
    MAX(CASE WHEN filosofi_measure = 'PR_MD60' AND obs_value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST(obs_value AS NUMERIC) END) AS taux_pauvrete,
    MAX(CASE WHEN filosofi_measure = 'GI_SL' AND obs_value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST(obs_value AS NUMERIC) END) AS indice_gini
FROM raw
GROUP BY geo_object
