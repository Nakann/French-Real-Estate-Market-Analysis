WITH ventes AS (
    SELECT * FROM {{ ref('stg_dvf') }}
),

dpes AS (
    -- On déduplique les DPE par adresse en gardant le plus récent
    SELECT *
    FROM (
        SELECT *,
               ROW_NUMBER() OVER(PARTITION BY adresse_brut, code_commune ORDER BY date_etablissement_dpe DESC) as rn
        FROM {{ ref('stg_dpe') }}
    )
    WHERE rn = 1
),

socio AS (
    SELECT * FROM {{ ref('stg_filosofi') }}
)

SELECT
    v.id_mutation,
    v.date_mutation,
    v.valeur_fonciere,
    v.surface_reelle_bati,
    v.type_local,
    -- Calcul du prix au m2
    CASE 
        WHEN v.surface_reelle_bati > 0 THEN v.valeur_fonciere / v.surface_reelle_bati 
        ELSE NULL 
    END AS prix_m2,
    
    -- Localisation
    v.adresse_complete,
    v.code_commune,
    v.code_departement,
    v.longitude,
    v.latitude,
    
    -- Variables DPE (Jointure heuristique sur l'adresse et le code commune)
    d.etiquette_dpe,
    d.etiquette_ges,
    d.consommation_energie,
    
    -- Variables FILOSOFI (Jointure sur le code commune)
    s.niveau_vie_median,
    s.taux_pauvrete,
    s.indice_gini
    
FROM ventes v
LEFT JOIN dpes d 
    ON d.code_commune = v.code_commune
    AND d.adresse_brut ILIKE '%' || v.adresse_complete || '%'
LEFT JOIN socio s 
    ON s.code_commune = v.code_commune
