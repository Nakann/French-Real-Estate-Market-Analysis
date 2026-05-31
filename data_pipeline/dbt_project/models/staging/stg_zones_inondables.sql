WITH source AS (
    SELECT *
    FROM {{ source('bronze', 'raw_zones_inondables') }}
),

renamed AS (
    SELECT
        properties->>'nom_zone' AS nom_zone,
        properties->>'niveau_risque' AS niveau_risque,
        properties->>'id_ppri' AS id_ppri,
        ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) AS geom
    FROM source
)

SELECT * FROM renamed
