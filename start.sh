#!/bin/bash
set -e

# Render ya exporta las variables de entorno, no es necesario declararlas de nuevo.
# Estas variables (DB_USER, DB_PASSWORD, etc.) DEBEN estar configuradas en el dashboard de Render.

CONFIG_TEMPLATE="./odoo.conf.template"
FINAL_CONFIG="./odoo.conf"

echo "Generando odoo.conf a partir de la plantilla..."

# 'envsubst' reemplaza las variables de entorno ($DB_USER, $DB_HOST, etc.) en el archivo de plantilla
# y crea el archivo de configuración final.
envsubst < "$CONFIG_TEMPLATE" > "$FINAL_CONFIG"

echo "Verificando conexión con PostgreSQL en $DB_HOST..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -t 5; then
    echo "ERROR: No se puede conectar a PostgreSQL en $DB_HOST:$DB_PORT."
    exit 1
fi
echo "Conexión con PostgreSQL exitosa."

# Comprobar si la base de datos existe
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "La base de datos '$DB_NAME' ya existe. Iniciando Odoo."
    # Podrías agregar aquí lógicas más complejas si lo necesitas, como la limpieza de adjuntos.
else
    echo "La base de datos '$DB_NAME' no existe. Creando e inicializando..."
    # Crear la base de datos
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -T template0 "$DB_NAME"
    
    echo "Inicializando la base de datos con los módulos base..."
    # Inicializar con módulos base y detenerse
    odoo --config="$FINAL_CONFIG" -d "$DB_NAME" -i base,web --stop-after-init --without-demo=all
fi

echo "Iniciando servidor Odoo..."
exec odoo --config="$FINAL_CONFIG"