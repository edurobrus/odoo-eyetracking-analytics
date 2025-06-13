#!/bin/bash
set -e

echo "Verificando conexión con PostgreSQL..."
# Necesitamos obtener los valores del .conf para usarlos con psql
DB_HOST=$(grep -Po "(?<=^db_host = ).*" odoo.conf)
DB_PORT=$(grep -Po "(?<=^db_port = ).*" odoo.conf)
DB_USER=$(grep -Po "(?<=^db_user = ).*" odoo.conf)
DB_PASSWORD=$(grep -Po "(?<=^db_password = ).*" odoo.conf)
DB_NAME=$(grep -Po "(?<=^db_name = ).*" odoo.conf)

export PGPASSWORD=$DB_PASSWORD

if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -t 5; then
    echo "ERROR: No se puede conectar a PostgreSQL."
    exit 1
fi
echo "Conexión con PostgreSQL exitosa."

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "La base de datos '$DB_NAME' ya existe."
else
    echo "La base de datos '$DB_NAME' no existe. Creando..."
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    echo "Inicializando la base de datos..."
    odoo --config=./odoo.conf -d "$DB_NAME" -i base,web --stop-after-init --without-demo=all
fi

echo "Iniciando servidor Odoo..."
exec odoo --config=./odoo.conf