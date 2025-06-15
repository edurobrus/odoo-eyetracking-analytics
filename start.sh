#!/bin/bash
set -e

CONFIG_FILE="${CONFIG_FILE:-/etc/odoo/odoo.conf}"
DB_NAME="${DB_NAME:-odoo_7epq}"

echo "Starting Odoo initialization..."

# Verificar que las variables requeridas estén configuradas
if [ -z "$PGHOST" ] || [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ]; then
  echo "ERROR: Required environment variables not set"
  echo "Please set: PGHOST, PGUSER, PGPASSWORD, DB_NAME"
  exit 1
fi

# Configurar variables de PostgreSQL
export PGPASSWORD="$PGPASSWORD"
export PGUSER="$PGUSER"
export PGHOST="$PGHOST"
export PGPORT="${PGPORT:-5432}"

echo "Database configuration:"
echo "Host: $PGHOST"
echo "Port: $PGPORT"
echo "User: $PGUSER"
echo "Database: $DB_NAME"

# Crear estructura de filestore
FILESTORE_DIR="/tmp/odoo/filestore/$DB_NAME"
echo "Creating filestore directory structure..."
mkdir -p "$FILESTORE_DIR"

# Subdirectorios hexadecimales (00-ff)
for i in {0..15}; do
  for j in {0..15}; do
    hex_dir=$(printf "%x%x" $i $j)
    mkdir -p "$FILESTORE_DIR/$hex_dir"
  done
done
echo "Filestore structure created."

# Crear directorio de logs
LOG_DIR="/mnt/extra-addons/marketing_eyetracking/log"
mkdir -p "$LOG_DIR" || true

# Función para verificar conexión a PostgreSQL
check_postgres_connection() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "SELECT 1;" &>/dev/null
}

# Función para verificar si la base de datos existe
check_database_exists() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"
}

# Función para verificar si la BD está inicializada
check_db_initialized() {
  if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
    return 1
  fi
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" -c \
    "SELECT 1 FROM ir_module_module WHERE name='web' AND state='installed' LIMIT 1;" 2>/dev/null | grep -q "1"
}

# Limpiar archivos huérfanos
clean_orphaned_attachments() {
  echo "Cleaning orphaned file references..."
  local sql_query="
    DELETE FROM ir_attachment
    WHERE store_fname IS NOT NULL
      AND store_fname != ''
      AND type = 'binary'
      AND res_model != 'ir.ui.view';
     
    DELETE FROM ir_attachment
    WHERE resmodel = 'ir.ui.view'
      AND name LIKE '%.assets%';
  "
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" -c "$sql_query" 2>/dev/null || true
  echo "Orphaned attachments cleaned."
}

# Verificar conexión a PostgreSQL
echo "Checking PostgreSQL connection..."
if ! check_postgres_connection; then
  echo "ERROR: Cannot connect to PostgreSQL"
  echo "Please verify database credentials and network connectivity"
  exit 1
fi
echo "PostgreSQL connection successful."

# Lógica de manejo de base de datos
if check_database_exists; then
  echo "Database '$DB_NAME' exists"
  if check_db_initialized; then
    echo "Database properly initialized. Cleaning orphaned files..."
    clean_orphaned_attachments
    echo "Starting Odoo..."
    exec odoo --config="$CONFIG_FILE" --log-level=info
  else
    echo "Database exists but not initialized. Initializing..."
    clean_orphaned_attachments
    echo "Installing base modules..."
    odoo --config="$CONFIG_FILE" -d "$DB_NAME" -i base,web --stop-after-init --log-level=info --without-demo=all
    echo "Starting Odoo..."
    exec odoo --config="$CONFIG_FILE" --log-level=info
  fi
else
  echo "Database '$DB_NAME' does not exist. Creating..."
  createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$DB_NAME"
  echo "Initializing database with base modules..."
  odoo --config="$CONFIG_FILE" -d "$DB_NAME" -i base,web --stop-after-init --log-level=info --without-demo=all
  echo "Starting Odoo with new database..."
  exec odoo --config="$CONFIG_FILE" --log-level=info
fi