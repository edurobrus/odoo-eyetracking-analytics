#!/bin/bash
set -e

CONFIG_FILE="/etc/odoo/odoo.conf"
DB_NAME="odoo_7epq"

echo "Starting Odoo initialization..."

# Función para verificar si la BD está inicializada
check_db_initialized() {
    psql -h $PGHOST -p $PGPORT -U $PGUSER -d $DB_NAME -c "SELECT 1 FROM ir_module_module WHERE name='web' AND state='installed' LIMIT 1;" 2>/dev/null | grep -q "1"
}

if check_db_initialized; then
    echo "Database properly initialized. Starting Odoo..."
    exec odoo --config=$CONFIG_FILE
else
    echo "Initializing database with base modules..."
    odoo --config=$CONFIG_FILE -d $DB_NAME -i base,web --stop-after-init --log-level=info --without-demo=all
    
    echo "Starting Odoo..."
    exec odoo --config=$CONFIG_FILE
fi