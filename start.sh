#!/bin/bash
set -e

CONFIG_FILE="/etc/odoo/odoo.conf"

echo "Starting Odoo initialization..."

# Crear estructura completa del filestore para evitar errores
FILESTORE_DIR="/tmp/odoo/filestore"
echo "Creating filestore directory structure..."
mkdir -p "$FILESTORE_DIR"

# Crear subdirectorios hexadecimales para cualquier base de datos
for i in {0..15}; do
    for j in {0..15}; do
        hex_dir=$(printf "%x%x" $i $j)
        mkdir -p "$FILESTORE_DIR/$hex_dir"
    done
done
echo "Filestore structure created"

# Crear directorio de logs
LOG_DIR="/mnt/extra-addons/marketing_eyetracking/log"
mkdir -p "$LOG_DIR" || true

# Función para limpiar assets usando Odoo CLI
cleanup_assets_with_odoo() {
    echo "Cleaning assets using Odoo..."
    
    # Usar Odoo shell para limpiar assets
    python3 -c "
import odoo
from odoo import api, SUPERUSER_ID
import os
import sys

# Configurar Odoo
odoo.tools.config.parse_config(['-c', '$CONFIG_FILE'])

try:
    # Obtener lista de bases de datos
    db_names = odoo.service.db.list_dbs()
    
    for db_name in db_names:
        print(f'Cleaning assets for database: {db_name}')
        
        # Conectar a la base de datos
        registry = odoo.registry(db_name)
        
        with registry.cursor() as cr:
            env = api.Environment(cr, SUPERUSER_ID, {})
            
            # Limpiar attachments de assets
            attachments = env['ir.attachment'].search([
                '|',
                ('res_model', '=', 'ir.ui.view'),
                ('store_fname', 'ilike', '/tmp/odoo/filestore/%')
            ])
            
            if attachments:
                print(f'Removing {len(attachments)} asset attachments...')
                attachments.unlink()
            
            # Limpiar parámetros de assets
            params = env['ir.config_parameter'].search([
                ('key', 'like', 'web.assets.%')
            ])
            
            if params:
                print(f'Removing {len(params)} asset parameters...')
                params.unlink()
            
            cr.commit()
            print(f'Assets cleaned for {db_name}')
            
except Exception as e:
    print(f'Asset cleanup completed with some warnings: {e}')
    pass
" 2>/dev/null || echo "Asset cleanup attempted"
}

# Función para inicializar base de datos si es necesario
initialize_if_needed() {
    echo "Checking if database initialization is needed..."
    
    # Intentar inicializar con base y web, Odoo se encarga de verificar si es necesario
    echo "Ensuring base modules are installed..."
    odoo --config="$CONFIG_FILE" -i base,web --stop-after-init --log-level=info --without-demo=all --db-filter=.* 2>/dev/null || {
        echo "Base modules installation completed or already installed"
    }
}

# Función para limpiar assets después de inicialización
post_init_cleanup() {
    echo "Performing post-initialization cleanup..."
    
    # Limpiar usando shell de Odoo después de inicialización
    odoo --config="$CONFIG_FILE" --shell --stop-after-init << 'EOF' 2>/dev/null || true
# Limpiar todos los assets temporales
for db_name in env.registry.db_names:
    if db_name == env.cr.dbname:
        # Limpiar attachments problemáticos
        attachments = env['ir.attachment'].search([
            '|', '|',
            ('store_fname', 'ilike', '/tmp/%'),
            ('res_model', '=', 'ir.ui.view'),
            ('name', 'ilike', 'web_assets_%')
        ])
        attachments.unlink()
        
        # Limpiar parámetros de cache
        params = env['ir.config_parameter'].search([
            ('key', 'like', 'web.assets.%')
        ])
        params.unlink()
        
        env.cr.commit()
        break
EOF
    echo "Post-initialization cleanup completed"
}

echo "=== Starting Odoo Initialization Process ==="

# Paso 1: Intentar limpiar assets existentes
cleanup_assets_with_odoo

# Paso 2: Inicializar base de datos si es necesario
initialize_if_needed

# Paso 3: Limpiar assets después de inicialización
post_init_cleanup

echo "=== Initialization Complete ==="
echo "Starting Odoo server..."

# Iniciar Odoo normalmente
exec odoo --config="$CONFIG_FILE" --log-level=info