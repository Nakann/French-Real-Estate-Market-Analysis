{{ config(materialized='view') }}

SELECT
    code_commune,
    nom_commune,
    ST_SetSRID(ST_GeomFromGeoJSON(geometry_json), 4326) AS geometry
FROM {{ source('bronze', 'raw_communes') }}
WHERE geometry_json IS NOT NULL AND geometry_json != 'null'
