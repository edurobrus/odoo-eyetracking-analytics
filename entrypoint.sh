set -e

# Entrypoint para Odoo 16 con manejo de filestore volátil
echo "=== Iniciando Odoo 16 ==="

# Crear directorios necesarios si no existen
echo "Creando directorios necesarios..."
mkdir -p /tmp/odoo/filestore
mkdir -p /var/lib/odoo/.local/share/Odoo/sessions
mkdir -p /var/lib/odoo/.local/share/Odoo/addons

# Asegurar permisos correctos
chown -R odoo:odoo /tmp/odoo /var/lib/odoo 2>/dev/null || true

# Función para limpiar assets corruptos
cleanup_assets() {
    echo "Limpiando assets potencialmente corruptos..."
    
    # Si tenemos acceso a la base de datos, limpiar registros de assets huérfanos
    if [ -n "$DB_NAME" ] && [ -n "$DB_HOST" ]; then
        echo "Intentando limpiar registros de assets huérfanos..."
        python3 << 'EOF'
import os
import sys
try:
    import psycopg2
    
    # Parámetros de conexión
    conn_params = {
        'host': os.environ.get('DB_HOST', 'localhost'),
        'port': int(os.environ.get('DB_PORT', '5432')),
        'database': os.environ.get('DB_NAME'),
        'user': os.environ.get('DB_USER'),
        'password': os.environ.get('DB_PASSWORD')
    }
    
    if all(conn_params.values()):
        conn = psycopg2.connect(**conn_params)
        cur = conn.cursor()
        
        # Limpiar attachments huérfanos (assets)
        cur.execute("""
            DELETE FROM ir_attachment 
            WHERE store_fname IS NOT NULL 
            AND res_model = 'ir.ui.view' 
            AND name LIKE '%.min.js'
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("✓ Assets huérfanos limpiados de la base de datos")
    else:
        print("! Parámetros de DB incompletos, saltando limpieza")
        
except Exception as e:
    print(f"! Error limpiando assets: {e}")
    print("Continuando sin limpieza...")
EOF
    fi
}

# Función para inicializar Odoo
init_odoo() {
    echo "Verificando estado de la base de datos..."
    
    # Parámetros base
    ODOO_CMD="python3 /usr/bin/odoo"
    COMMON_PARAMS="--config=/etc/odoo/odoo.conf --addons-path=/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons"
    
    # Si es la primera vez o necesitamos regenerar assets
    if [ "$REGENERATE_ASSETS" = "true" ] || [ "$CLEAN_START" = "true" ]; then
        echo "Regenerando assets de Odoo..."
        cleanup_assets
        
        $ODOO_CMD $COMMON_PARAMS --update=web --stop-after-init --log-level=warn || {
            echo "! Error regenerando assets, continuando..."
        }
    fi
    
    # Iniciar Odoo normalmente
    echo "=== Iniciando Odoo en modo normal ==="
    exec $ODOO_CMD $COMMON_PARAMS "$@"
}

# Manejo de señales para shutdown limpio
cleanup() {
    echo "=== Deteniendo Odoo ==="
    kill -TERM "$child" 2>/dev/null || true
    wait "$child"
}

trap cleanup SIGTERM SIGINT

# Si hay argumentos, ejecutar directamente
if [ $# -gt 0 ]; then
    case "$1" in
        odoo)
            shift
            init_odoo "$@"
            ;;
        bash|sh)
            exec "$@"
            ;;
        *)
            echo "Ejecutando comando personalizado: $@"
            exec "$@"
            ;;
    esac
else
    # Comportamiento por defecto
    init_odoo
fi