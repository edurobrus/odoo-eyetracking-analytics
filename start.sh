#!/bin/bash
set -e

CONFIG_FILE="/etc/odoo/odoo.conf"
DB_NAME="odoo_7epq"

echo "Starting Odoo initialization..."

# Crear directorio temporal para filestore (se borra en cada reinicio)
mkdir -p /tmp/odoo/filestore/$DB_NAME
mkdir -p /tmp/odoo/sessions
chown -R odoo:odoo /tmp/odoo

echo "Filestore configured in /tmp/odoo (non-persistent)"

# Función para verificar si la BD está inicializada
check_db_initialized() {
    # Verificar conexión a BD primero
    if ! psql -h $PGHOST -p $PGPORT -U $PGUSER -d $DB_NAME -c "SELECT 1;" &>/dev/null; then
        echo "Cannot connect to database or database doesn't exist"
        return 1
    fi
    
    # Verificar si módulos base están instalados
    psql -h $PGHOST -p $PGPORT -U $PGUSER -d $DB_NAME -c "SELECT 1 FROM ir_module_module WHERE name='web' AND state='installed' LIMIT 1;" 2>/dev/null | grep -q "1"
}

# Verificar si la base de datos existe
if psql -h $PGHOST -p $PGPORT -U $PGUSER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
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
    createdb -h $PGHOST -p $PGPORT -U $PGUSER $DB_NAME
    
    # Inicializar con módulos base
    odoo --config=$CONFIG_FILE -d $DB_NAME -i base,web --stop-after-init --log-level=info --without-demo=all
    
    echo "Starting Odoo with new database..."
    exec odoo --config=$CONFIG_FILE
fi