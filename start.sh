#!/bin/bash
set -e

CONFIG_FILE="/etc/odoo/odoo.conf"
DB_NAME="odoo_7epq"

echo "Starting Odoo initialization..."

# Verificar que las variables de entorno estén definidas
if [ -z "$PGHOST" ] || [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ]; then
    echo "ERROR: PostgreSQL environment variables not set"
    echo "Required: PGHOST, PGUSER, PGPASSWORD"
    exit 1
fi

# Configurar variables de entorno para PostgreSQL
export PGPASSWORD="$PGPASSWORD"
PGPORT=${PGPORT:-5432}

echo "Connecting to PostgreSQL at $PGHOST:$PGPORT as $PGUSER"

# Función para verificar conexión a PostgreSQL
check_postgres_connection() {
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "SELECT 1;" &>/dev/null
}

# Función para verificar si la base de datos existe
check_database_exists() {
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"
}

# Función para verificar si la BD está inicializada con Odoo
check_db_initialized() {
    # Primero verificar si podemos conectar a la BD
    if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
        return 1
    fi
    
    # Verificar si las tablas de Odoo existen
    local table_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('ir_module_module', 'res_users');" 2>/dev/null | tr -d ' ')
    
    if [ "$table_count" != "2" ]; then
        return 1
    fi
    
    # Verificar si los módulos base están instalados
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" -t -c "SELECT 1 FROM ir_module_module WHERE name='base' AND state='installed' LIMIT 1;" 2>/dev/null | grep -q "1"
}

# Función para crear la base de datos
create_database() {
    echo "Creating database: $DB_NAME"
    createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$DB_NAME"
}

# Función para inicializar Odoo
initialize_odoo() {
    echo "Initializing Odoo with base modules..."
    timeout 300 odoo --config="$CONFIG_FILE" -d "$DB_NAME" -i base --stop-after-init --log-level=info --without-demo=all
}

# Función para actualizar módulos
update_modules() {
    echo "Updating Odoo modules..."
    timeout 300 odoo --config="$CONFIG_FILE" -d "$DB_NAME" -u base --stop-after-init --log-level=info
}

# Verificar conexión a PostgreSQL
echo "Checking PostgreSQL connection..."
if ! check_postgres_connection; then
    echo "ERROR: Cannot connect to PostgreSQL server"
    echo "Host: $PGHOST, Port: $PGPORT, User: $PGUSER"
    exit 1
fi

echo "PostgreSQL connection successful"

# Verificar si la base de datos existe
if check_database_exists; then
    echo "Database '$DB_NAME' exists"
    
    # Verificar si está inicializada
    if check_db_initialized; then
        echo "Database is properly initialized with Odoo"
        echo "Starting Odoo..."
        exec odoo --config="$CONFIG_FILE"
    else
        echo "Database exists but is not properly initialized"
        
        # Intentar inicializar
        if initialize_odoo; then
            echo "Database initialized successfully"
        else
            echo "Failed to initialize database. Trying to update modules..."
            update_modules
        fi
        
        echo "Starting Odoo..."
        exec odoo --config="$CONFIG_FILE"
    fi
else
    echo "Database '$DB_NAME' does not exist"
    
    # Crear la base de datos
    if create_database; then
        echo "Database created successfully"
    else
        echo "ERROR: Failed to create database"
        exit 1
    fi
    
    # Inicializar Odoo
    if initialize_odoo; then
        echo "Odoo initialized successfully"
    else
        echo "ERROR: Failed to initialize Odoo"
        exit 1
    fi
    
    echo "Starting Odoo with new database..."
    exec odoo --config="$CONFIG_FILE"
fi