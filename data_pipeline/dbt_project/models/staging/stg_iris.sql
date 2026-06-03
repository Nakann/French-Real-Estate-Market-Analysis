{{ config(
    materialized='table',
    indexes=[
      {'columns': ['geom'], 'type': 'gist'},
      {'columns': ['code_commune']}
    ]
  )
}}

SELECT
    iris_code AS code_iris,
    iris_name AS nom_iris,
    com_code AS code_commune,
    dep_code AS code_departement,
    public.ST_SetSRID(public.ST_GeomFromGeoJSON(geometry_json), 4326) AS geom
FROM {{ source('bronze', 'raw_iris') }}
WHERE geometry_json IS NOT NULL AND geometry_json != 'null'
