{{
  config(
    materialized='table',
    indexes=[
      {'columns': ['geometry'], 'type': 'gist'},
      {'columns': ['code_commune']}
    ]
  )
}}

WITH immo_stats AS (
    SELECT
        code_commune,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_m2) AS prix_m2_median,
        COUNT(*) AS nb_mutations
    FROM {{ ref('fact_immobilier') }}
    WHERE prix_m2 IS NOT NULL
    GROUP BY code_commune
)

SELECT
    c.code_commune,
    c.nom_commune,
    c.geometry,
    s.prix_m2_median,
    s.nb_mutations
FROM {{ ref('stg_communes') }} c
LEFT JOIN immo_stats s ON c.code_commune = s.code_commune
