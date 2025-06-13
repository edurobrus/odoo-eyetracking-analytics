#!/bin/bash
set -e

CONFIG_FILE="/etc/odoo/odoo.conf"
DB_NAME="odoo_7epq"

echo "Starting Odoo initialization..."

# Usar variables de entorno de PostgreSQL correctamente
DB_HOST=${DB_HOST:-$PGHOST}
DB_PORT=${DB_PORT:-$PGPORT}
DB_USER=${DB_USER:-$PGUSER}
DB_PASSWORD=${DB_PASSWORD:-$PGPASSWORD}

# Verificar que las variables estén definidas
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ]; then
    echo "ERROR: Database connection variables not set properly"
    echo "DB_HOST: $DB_HOST"
    echo "DB_USER: $DB_USER"
    exit 1
fi

# Función para verificar si la BD está inicializada
check_db_initialized() {
    # Verificar conexión a BD primero
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
        echo "Cannot connect to database or database doesn't exist"
        return 1
    fi
    
    # Verificar si módulos base están instalados
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM ir_module_module WHERE name='web' AND state='installed' LIMIT 1;" 2>/dev/null | grep -q "1"
}

# Verificar si la base de datos existe
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "Database exists. Checking initialization..."
    
    if check_db_initialized; then
        echo "Database properly initialized. Starting Odoo..."
        exec odoo --config=$CONFIG_FILE
    else
        echo "Database exists but not properly initialized. Updating modules..."
        odoo --config=$CONFIG_FILE -d $DB_NAME -u base,web --stop-after-init --log-level=info --without-demo=all
        
        echo "Starting Odoo..."
        exec odoo --config=$CONFIG_FILE
    fi
else
    echo "Database doesn't exist. Creating and initializing..."
    
    # Crear la base de datos
    PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    
    # Inicializar con módulos base
    odoo --config=$CONFIG_FILE -d $DB_NAME -i base,web --stop-after-init --log-level=info --without-demo=all
    
    echo "Starting Odoo with new database..."
    exec odoo --config=$CONFIG_FILE
fi