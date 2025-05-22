#!/bin/bash

echo "🔄 Iniciando proceso de reinicialización completa de Odoo..."

# Función para esperar a que PostgreSQL esté disponible
wait_for_postgres() {
    echo "⏳ Esperando a que PostgreSQL esté disponible..."
    while ! pg_isready -h $HOST -p ${PORT:-5432} -U $USER; do
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
DB_USER=${DB_USER:-odoo}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

# Configurar variables de entorno para PostgreSQL
export PGPASSWORD="$DB_PASSWORD"
export HOST="$DB_HOST"
export PORT="$DB_PORT"
export USER="$DB_USER"

echo "🗃️ Configuración de base de datos:"
echo "   - Host: $DB_HOST"
echo "   - Puerto: $DB_PORT"
echo "   - Usuario: $DB_USER"
echo "   - Base de datos: $DB_NAME"

# Esperar a que PostgreSQL esté disponible
wait_for_postgres

echo "🗑️ Eliminando base de datos existente..."
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || echo "   ℹ️ Base de datos no existía"

echo "🆕 Creando nueva base de datos..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

echo "🧹 Limpiando caché y filestore..."
# Limpiar filestore (archivos adjuntos, imágenes, etc.)
rm -rf /var/lib/odoo/.local/share/Odoo/filestore/* 2>/dev/null || true
# Limpiar sesiones
rm -rf /var/lib/odoo/.local/share/Odoo/sessions/* 2>/dev/null || true
# Limpiar caché de Python
find /var/lib/odoo -name "*.pyc" -delete 2>/dev/null || true
find /var/lib/odoo -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo "🔧 Recreando directorios necesarios..."
mkdir -p /var/lib/odoo/.local/share/Odoo/filestore/"$DB_NAME"
mkdir -p /var/lib/odoo/.local/share/Odoo/sessions

echo "🚀 Iniciando Odoo con inicialización completa..."
echo "   - Instalando módulos base y personalizados..."
echo "   - Esto puede tomar varios minutos..."

# Obtener lista de módulos personalizados para instalar
CUSTOM_MODULES=""
if [ -d "/mnt/extra-addons" ]; then
    for module_dir in /mnt/extra-addons/*/; do
        if [ -d "$module_dir" ] && [ -f "$module_dir/__manifest__.py" -o -f "$module_dir/__openerp__.py" ]; then
            module_name=$(basename "$module_dir")
            if [ -n "$CUSTOM_MODULES" ]; then
                CUSTOM_MODULES="$CUSTOM_MODULES,$module_name"
            else
                CUSTOM_MODULES="$module_name"
            fi
        fi
    done
fi

# Construir comando de inicialización
INIT_COMMAND="odoo -c /etc/odoo/odoo.conf --init=base"
if [ -n "$CUSTOM_MODULES" ]; then
    INIT_COMMAND="$INIT_COMMAND,$CUSTOM_MODULES"
    echo "   - Módulos personalizados a instalar: $CUSTOM_MODULES"
fi

# Ejecutar inicialización
$INIT_COMMAND --stop-after-init --log-level=info

if [ $? -eq 0 ]; then
    echo "✅ Inicialización completada exitosamente"
    echo "🌐 Iniciando servidor Odoo..."
    
    # Iniciar Odoo en modo normal
    exec odoo -c /etc/odoo/odoo.conf
else
    echo "❌ Error durante la inicialización"
    exit 1
fi