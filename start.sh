#!/bin/bash
set -e

CONFIG_FILE="/etc/odoo/odoo.conf"
echo "--- Odoo Startup Script Initialized ---"
echo "Reading configuration from: $CONFIG_FILE"

# --- Lógica de Parseo para Leer desde odoo.conf (Como se solicitó) ---
get_config_value() {
    # Extrae el valor para una clave dada del archivo de configuración
    # Elimina comentarios, espacios en blanco y toma el valor después del '='
    local value=$(grep -E "^\s*$1\s*=" "$CONFIG_FILE" | cut -d '=' -f 2- | sed 's/^\s*//;s/\s*$//')
    echo "$value"
}

# Leer las variables de la base de datos desde el archivo .conf
DB_HOST=$(get_config_value "db_host")
DB_PORT=$(get_config_value "db_port")
DB_USER=$(get_config_value "db_user")
DB_PASSWORD=$(get_config_value "db_password")
DB_NAME=$(get_config_value "db_name")

# Verificación: si falta alguna credencial clave, el script no puede continuar.
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    echo "ERROR: Could not read one or more required database settings (db_host, db_user, db_password, db_name) from $CONFIG_FILE."
    exit 1
fi

# Exportar las variables leídas para que herramientas como psql las puedan usar
export PGHOST=$DB_HOST
export PGPORT=${DB_PORT:-5432} # Usar 5432 como puerto por defecto si no está definido
export PGUSER=$DB_USER
export PGPASSWORD=$DB_PASSWORD

echo "Database configuration loaded from file:"
echo "Host: $PGHOST"
echo "Port: $PGPORT"
echo "User: $PGUSER"
echo "Database: $DB_NAME"
echo "----------------------------------------"

# --- Funciones de Comprobación (Tu Lógica Mantenida) ---

wait_for_postgres() {
    echo "Waiting for PostgreSQL to be ready..."
    n=0
    until [ $n -ge 30 ]; do
       pg_isready -q && return 0
       n=$((n+1))
       echo "PostgreSQL is unavailable - sleeping for 1 second..."
       sleep 1
    done
    echo "ERROR: Could not connect to PostgreSQL after 30 seconds."
    exit 1
}

check_database_exists() {
    psql -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"
}

check_db_initialized() {
    psql -d "$DB_NAME" -tc "SELECT 1 FROM ir_module_module WHERE name='web' AND state='installed';" | grep -q 1
}

# --- Lógica Principal de Arranque ---

wait_for_postgres
echo "PostgreSQL connection successful."

if check_database_exists; then
    echo "Database '$DB_NAME' already exists."
    if check_db_initialized; then
        echo "Database is already initialized. Starting Odoo server..."
        exec odoo --config="$CONFIG_FILE"
    else
        echo "Database exists but is not initialized. Initializing core modules..."
        odoo --config="$CONFIG_FILE" -i base,web --stop-after-init --without-demo=all
        echo "Initialization complete. Starting Odoo server..."
        exec odoo --config="$CONFIG_FILE"
    fi
else
    echo "Database '$DB_NAME' does not exist. Odoo will create and initialize it."
    odoo --config="$CONFIG_FILE" -i base,web --stop-after-init --without-demo=all
    echo "Database created and initialized. Starting Odoo server..."
    exec odoo --config="$CONFIG_FILE"
fi