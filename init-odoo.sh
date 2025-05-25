#!/bin/bash

echo "🔄 Iniciando proceso de reinicialización completa de Odoo..."

# Función para esperar a que PostgreSQL esté disponible
wait_for_postgres() {
    echo "⏳ Esperando a que PostgreSQL esté disponible..."
    while ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
        echo "PostgreSQL no está listo - esperando..."
        sleep 2
    done
    echo "✅ PostgreSQL está disponible"
}

# Leer configuración de la base de datos desde odoo.conf
DB_NAME=$(grep -E "^db_name\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_USER=$(grep -E "^db_user\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_PASSWORD=$(grep -E "^db_password\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_HOST=$(grep -E "^db_host\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_PORT=$(grep -E "^db_port\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)

# Valores por defecto si no se encuentran en la configuración
DB_NAME=${DB_NAME:-odoo}
DB_USER=${DB_USER:-admin}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

# Configurar variables de entorno para PostgreSQL
export PGPASSWORD="$DB_PASSWORD"
export PGHOST="$DB_HOST"
export PGPORT="$DB_PORT"
export PGUSER="$DB_USER"

echo "🗃️ Configuración de base de datos:"
echo "   - Host: $DB_HOST"
echo "   - Puerto: $DB_PORT"
echo "   - Usuario: $DB_USER"
echo "   - Base de datos: $DB_NAME"

# Esperar a que PostgreSQL esté disponible
wait_for_postgres

echo "🗑️ Eliminando base de datos existente (si la hay)..."

# Terminar conexiones activas
echo "   - Terminando conexiones activas a '$DB_NAME'..."
psql -d "postgres" -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '$DB_NAME'
      AND pid <> pg_backend_pid();
" > /dev/null 2>&1

# Eliminar base de datos
dropdb --if-exists "$DB_NAME" 2>/dev/null && echo "   - Base de datos eliminada" || echo "   - No existía la base de datos"

echo "⚙️ Configurando PostgreSQL para evitar crashes..."
createdb "$DB_NAME" 2>/dev/null
psql -d "$DB_NAME" -c "
    ALTER DATABASE $DB_NAME SET lock_timeout = '0';
    ALTER DATABASE $DB_NAME SET statement_timeout = '0';
    ALTER DATABASE $DB_NAME SET idle_in_transaction_session_timeout = '0';
    ALTER DATABASE $DB_NAME SET deadlock_timeout = '1s';
    ALTER DATABASE $DB_NAME SET work_mem = '2MB';
    ALTER DATABASE $DB_NAME SET maintenance_work_mem = '32MB';
    ALTER DATABASE $DB_NAME SET temp_buffers = '8MB';
    ALTER DATABASE $DB_NAME SET autovacuum = off;
" 2>/dev/null

echo "🧹 Limpiando caché y filestore..."
rm -rf /var/lib/odoo/.local/share/Odoo/filestore/* 2>/dev/null || true
rm -rf /var/lib/odoo/.local/share/Odoo/sessions/* 2>/dev/null || true
find /var/lib/odoo -name "*.pyc" -delete 2>/dev/null || true
find /var/lib/odoo -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo "🔧 Recreando directorios necesarios..."
mkdir -p /var/lib/odoo/.local/share/Odoo/filestore/"$DB_NAME"
mkdir -p /var/lib/odoo/.local/share/Odoo/sessions

# ==============================================
# NUEVO: Configuración del directorio de logs
# ==============================================
echo "📂 Creando directorio de logs..."
LOG_FILE=$(grep -E "^logfile\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
if [ -n "$LOG_FILE" ]; then
    LOG_DIR=$(dirname "$LOG_FILE")
    mkdir -p "$LOG_DIR"
    chown -R odoo:odoo "$LOG_DIR" 2>/dev/null || true
    echo "   - Directorio de logs creado en: $LOG_DIR"
else
    echo "   ⚠️ No se configuró logfile en odoo.conf - Logs en salida estándar"
fi

echo "🚀 Iniciando Odoo con inicialización completa..."
CUSTOM_MODULES=""
if [ -d "/mnt/extra-addons" ]; then
    for module_dir in /mnt/extra-addons/*/; do
        if [ -f "$module_dir/__manifest__.py" ] || [ -f "$module_dir/__openerp__.py" ]; then
            module_name=$(basename "$module_dir")
            CUSTOM_MODULES="${CUSTOM_MODULES}${module_name},"
        fi
    done
    CUSTOM_MODULES=${CUSTOM_MODULES%,}
fi

# Instalación en dos fases
echo "🔌 Instalando módulos base..."
odoo -c /etc/odoo/odoo.conf --init=base --stop-after-init --log-level=warn --without-demo=all

if [ $? -eq 0 ]; then
    echo "✅ Base instalada correctamente."
    
    if [ -n "$CUSTOM_MODULES" ]; then
        echo "🔌 Instalando módulos personalizados: $CUSTOM_MODULES"
        odoo -c /etc/odoo/odoo.conf --init="$CUSTOM_MODULES" --stop-after-init --log-level=warn --without-demo=all
        [ $? -eq 0 ] && echo "✅ Módulos personalizados instalados" || echo "⚠️ Error instalando módulos personalizados"
    fi

    echo "⚙️ Optimizando configuración PostgreSQL..."
    psql -d "$DB_NAME" -c "
        ALTER DATABASE $DB_NAME SET autovacuum = on;
        ANALYZE;
    " > /dev/null 2>&1

    echo "🚀 Iniciando servidor Odoo..."
    exec odoo -c /etc/odoo/odoo.conf --log-level=info
else
    echo "❌ Error crítico durante la inicialización"
    exit 1
fi