{{ config(materialized='view') }}

SELECT
    id AS id_ban,
    id_fantoir,
    numero,
    rep,
    nom_voie,
    code_postal,
    code_insee AS code_commune,
    nom_commune,
    code_insee_ancienne_commune,
    nom_ancienne_commune,
    x,
    y,
    CAST(lon AS FLOAT) AS longitude,
    CAST(lat AS FLOAT) AS latitude,
    type_position,
    alias,
    nom_ld,
    libelle_acheminement,
    nom_afnor,
    source_position,
    source_nom_voie,
    certification_commune,
    -- Création de l'objet spatial
    public.ST_SetSRID(public.ST_MakePoint(CAST(lon AS FLOAT), CAST(lat AS FLOAT)), 4326) AS geometry
FROM {{ source('bronze', 'raw_ban') }}
WHERE lon IS NOT NULL AND lat IS NOT NULL AND lon != '' AND lat != ''
