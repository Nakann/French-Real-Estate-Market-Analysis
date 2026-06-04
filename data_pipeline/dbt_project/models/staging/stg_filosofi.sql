WITH raw AS (
    SELECT * FROM {{ source('bronze', 'raw_filosofi') }}
    WHERE geo_object = 'COM'
      AND time_period = '2023'
)

SELECT
    geo AS code_commune,
    MAX(CASE WHEN filosofi_measure = 'MED_SL'  AND obs_value IS NOT NULL THEN CAST(obs_value AS NUMERIC) END) AS niveau_vie_median,
    MAX(CASE WHEN filosofi_measure = 'PR_MD60' AND obs_value IS NOT NULL THEN CAST(obs_value AS NUMERIC) END) AS taux_pauvrete,
    MAX(CASE WHEN filosofi_measure = 'GI_SL'   AND obs_value IS NOT NULL THEN CAST(obs_value AS NUMERIC) END) AS indice_gini
FROM raw
GROUP BY geo

