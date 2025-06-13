#!/bin/bash
set -e
CONFIG_FILE="/etc/odoo/odoo.conf"
DB_NAME="odoo_7epq"

echo "Starting Odoo initialization..."

# Use PostgreSQL environment variables with fallbacks
DB_HOST=${DB_HOST:-${PGHOST}}
DB_PORT=${DB_PORT:-${PGPORT:-5432}}
DB_USER=${DB_USER:-${PGUSER}}
DB_PASSWORD=${DB_PASSWORD:-${PGPASSWORD}}

# Debug: Show what variables we have (without showing password)
echo "DB_HOST: ${DB_HOST:-'NOT SET'}"
echo "DB_PORT: ${DB_PORT:-'NOT SET'}"
echo "DB_USER: ${DB_USER:-'NOT SET'}"
echo "DB_PASSWORD: ${DB_PASSWORD:+***SET***}"

# Check that required variables are defined
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: Required database connection variables not set"
    echo "Please set: DB_HOST, DB_USER, DB_PASSWORD"
    echo "Or alternatively: PGHOST, PGUSER, PGPASSWORD"
    exit 1
fi

# Function to check if DB is initialized
check_db_initialized() {
    # Check connection to DB first
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
        echo "Cannot connect to database or database doesn't exist"
        return 1
    fi
    
    # Check if base modules are installed
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM ir_module_module WHERE name='web' AND state='installed' LIMIT 1;" 2>/dev/null | grep -q "1"
}

# Check if database exists
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
    # Create the database
    PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    # Initialize with base modules
    odoo --config=$CONFIG_FILE -d $DB_NAME -i base,web --stop-after-init --log-level=info --without-demo=all
    echo "Starting Odoo with new database..."
    exec odoo --config=$CONFIG_FILE
fi