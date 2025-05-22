#!/bin/bash

echo "🔄 Iniciando proceso de reinicialización completa de Odoo..."

# Función para esperar a que PostgreSQL esté disponible
wait_for_postgres() {
    echo "⏳ Esperando a que PostgreSQL esté disponible..."
    # Usamos $PGHOST, $PGPORT, $PGUSER directamente si ya están exportadas,
    # si no, usamos las variables de la función con valores por defecto.
    # También pasamos PGPASSWORD de forma segura a pg_isready.
    while ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
        echo "PostgreSQL no está listo - esperando..."
        sleep 2
    done
    echo "✅ PostgreSQL está disponible"
}

# Leer configuración de la base de datos desde odoo.conf
# Usamos 'head -1' para asegurarnos de tomar solo la primera ocurrencia si hay duplicados (aunque es mejor eliminarlos del .conf)
DB_NAME=$(grep -E "^db_name\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_USER=$(grep -E "^db_user\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_PASSWORD=$(grep -E "^db_password\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_HOST=$(grep -E "^db_host\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)
DB_PORT=$(grep -E "^db_port\s*=" /etc/odoo/odoo.conf | cut -d'=' -f2 | tr -d ' ' | head -1)

# Valores por defecto si no se encuentran en la configuración (ajusta si tus defaults son otros)
DB_NAME=${DB_NAME:-odoo}
DB_USER=${DB_USER:-odoo}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

# Configurar variables de entorno para PostgreSQL (para comandos psql/dropdb/createdb)
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

# Terminar todas las conexiones activas a la base de datos antes de intentar eliminarla
echo "   - Terminando conexiones activas a '$DB_NAME'..."
psql -d "postgres" -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '$DB_NAME'
      AND pid <> pg_backend_pid();
" > /dev/null 2>&1 # Redirige salida y errores a /dev/null para no saturar el log

# Intentar eliminar la base de datos
if dropdb "$DB_NAME" 2>/dev/null; then
    echo "✅ Base de datos '$DB_NAME' eliminada correctamente."
else
    # Comprobar si la base de datos realmente existía o si hubo un error de permisos/conexión
    if psql -lqt | cut -d \| -f 1 | grep -wq "$DB_NAME"; then
        echo "❌ ERROR: No se pudo eliminar la base de datos '$DB_NAME'. Podría haber conexiones persistentes o problemas de permisos."
        exit 1 # Salir si la eliminación falla y la DB aún existe
    else
        echo "   ℹ️ Base de datos '$DB_NAME' no existía o ya se eliminó previamente."
    fi
fi

echo "🆕 Creando nueva base de datos '$DB_NAME'..."
if createdb "$DB_NAME"; then
    echo "✅ Base de datos '$DB_NAME' creada correctamente."
else
    echo "❌ ERROR: Falló la creación de la base de datos '$DB_NAME'."
    exit 1 # Salir si la creación falla
fi

echo "⚙️ Configurando PostgreSQL para evitar crashes..."
# Ejecutar comandos SQL directamente en la base de datos recién creada
psql -d "$DB_NAME" -c "
    -- Configuraciones para evitar timeouts y crashes
    ALTER DATABASE $DB_NAME SET lock_timeout = '0';
    ALTER DATABASE $DB_NAME SET statement_timeout = '0';
    ALTER DATABASE $DB_NAME SET idle_in_transaction_session_timeout = '0';
    ALTER DATABASE $DB_NAME SET deadlock_timeout = '1s';
    ALTER DATABASE $DB_NAME SET log_lock_waits = off;
    ALTER DATABASE $DB_NAME SET log_statement = 'none';
    ALTER DATABASE $DB_NAME SET log_min_duration_statement = -1;
    -- Configuraciones de memoria
    ALTER DATABASE $DB_NAME SET work_mem = '2MB';
    ALTER DATABASE $DB_NAME SET maintenance_work_mem = '32MB';
    ALTER DATABASE $DB_NAME SET temp_buffers = '8MB';
    -- Deshabilitar autovacuum temporalmente durante la inicialización
    ALTER DATABASE $DB_NAME SET autovacuum = off;
" 2>/dev/null || echo "   ⚠️ Algunas configuraciones de PostgreSQL no se pudieron aplicar"

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
# Primero instalamos solo la base para asegurar que Odoo inicie correctamente
INIT_COMMAND_BASE="odoo -c /etc/odoo/odoo.conf --init=base --stop-after-init --log-level=warn --without-demo=all"

echo "🚀 Ejecutando inicialización de Odoo (solo módulos esenciales)..."
# Ejecutar inicialización de la base
$INIT_COMMAND_BASE

if [ $? -eq 0 ]; then
    echo "✅ Base instalada correctamente."
    
    # Luego, si hay módulos personalizados, los instalamos
    if [ -n "$CUSTOM_MODULES" ]; then
        echo "   - Instalando módulos personalizados: $CUSTOM_MODULES"
        INIT_COMMAND_CUSTOM="odoo -c /etc/odoo/odoo.conf --init=\"$CUSTOM_MODULES\" --stop-after-init --log-level=warn --without-demo=all"
        $INIT_COMMAND_CUSTOM
        
        if [ $? -ne 0 ]; then
            echo "⚠️ Algunos módulos personalizados fallaron durante la instalación. Verifica los logs de Odoo."
        else
            echo "✅ Módulos personalizados instalados correctamente."
        fi
    fi
    
    echo "✅ Inicialización completa del sistema Odoo."
    echo "⏳ Esperando estabilización del sistema antes de habilitar autovacuum..."
    sleep 10 # Darle un momento a Odoo para consolidar los cambios

    echo "🧹 Habilitando autovacuum nuevamente en PostgreSQL..."
    psql -d "$DB_NAME" -c "
        ALTER DATABASE $DB_NAME SET autovacuum = on;
    " > /dev/null 2>&1 || true # Si falla, no es crítico para el inicio

    echo "🌐 Iniciando servidor Odoo..."
    # Finalmente, iniciar el servidor Odoo en modo normal
    exec odoo -c /etc/odoo/odoo.conf --log-level=info
else
    echo "❌ Error crítico durante la inicialización de la base de Odoo. Consulta los logs anteriores."
    exit 1
fi