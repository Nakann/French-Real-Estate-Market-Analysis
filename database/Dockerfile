FROM postgis/postgis:16-3.4

# On copie le script d'init directement dans l'image
# → évite les problèmes de montage de volume sur Windows avec des chemins contenant des espaces
COPY init.sql /docker-entrypoint-initdb.d/10_init.sql
