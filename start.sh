#!/bin/bash
set -e

CONFIG_FILE="/etc/odoo/odoo.conf"
DB_NAME="odoo_7epq"

echo "Starting Odoo initialization..."
echo "Database: $DB_NAME"

# Crear estructura completa del filestore para evitar errores
FILESTORE_DIR="/tmp/odoo/filestore/$DB_NAME"
echo "Creating filestore directory structure..."
mkdir -p "$FILESTORE_DIR"

# Crear subdirectorios hexadecimales (00-ff) para evitar FileNotFoundError
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

# Función para verificar si la base de datos existe y está inicializada usando Odoo
check_database_with_odoo() {
    echo "Checking database status with Odoo..."
    
    # Intentar conectar a la base de datos específica
    if odoo --config="$CONFIG_FILE" -d "$DB_NAME" --test-enable --stop-after-init --log-level=error 2>/dev/null; then
        echo "Database '$DB_NAME' exists and is accessible"
        return 0
    else
        echo "Database '$DB_NAME' does not exist or is not accessible"
        return 1
    fi
}

# Función para verificar si los módulos base están instalados
check_modules_installed() {
    echo "Checking if base modules are installed..."
    
    # Crear un script Python temporal para verificar módulos
    cat > /tmp/check_modules.py << 'EOF'
import sys
import odoo
from odoo import api, SUPERUSER_ID

try:
    # Configurar Odoo
    odoo.tools.config.parse_config(sys.argv[1:])
    db_name = odoo.tools.config['db_name']
    
    if not db_name:
        sys.exit(1)
    
    # Conectar a la base de datos
    registry = odoo.registry(db_name)
    
    with registry.cursor() as cr:
        env = api.Environment(cr, SUPERUSER_ID, {})
        
        # Verificar si el módulo web está instalado
        web_module = env['ir.module.module'].search([
            ('name', '=', 'web'),
            ('state', '=', 'installed')
        ], limit=1)
        
        if web_module:
            print("Base modules are installed")
            sys.exit(0)
        else:
            print("Base modules are not installed")
            sys.exit(1)
            
except Exception as e:
    print("Error checking modules or database not initialized")
    sys.exit(1)
EOF

    if python3 /tmp/check_modules.py --config="$CONFIG_FILE" -d "$DB_NAME" 2>/dev/null; then
        rm -f /tmp/check_modules.py
        return 0
    else
        rm -f /tmp/check_modules.py
        return 1
    fi
}

# Función para limpiar attachments huérfanos usando Odoo
clean_orphaned_attachments_with_odoo() {
    echo "Cleaning orphaned file references with Odoo..."
    
    # Crear script Python para limpiar attachments
    cat > /tmp/clean_attachments.py << 'EOF'
import sys
import odoo
from odoo import api, SUPERUSER_ID

try:
    # Configurar Odoo
    odoo.tools.config.parse_config(sys.argv[1:])
    db_name = odoo.tools.config['db_name']
    
    if not db_name:
        sys.exit(0)
    
    # Conectar a la base de datos
    registry = odoo.registry(db_name)
    
    with registry.cursor() as cr:
        env = api.Environment(cr, SUPERUSER_ID, {})
        
        # Limpiar attachments huérfanos
        attachments_to_clean = env['ir.attachment'].search([
            '|', '|',
            '&', ('store_fname', '!=', False), ('store_fname', '!=', ''),
            '&', ('type', '=', 'binary'), ('res_model', '!=', 'ir.ui.view'),
            '&', ('res_model', '=', 'ir.ui.view'), ('name', 'like', '%.assets_%')
        ])
        
        if attachments_to_clean:
            print(f"Removing {len(attachments_to_clean)} orphaned attachments")
            attachments_to_clean.unlink()
        
        # Limpiar parámetros de assets
        asset_params = env['ir.config_parameter'].search([
            ('key', 'like', 'web.assets.%')
        ])
        
        if asset_params:
            print(f"Removing {len(asset_params)} asset parameters")
            asset_params.unlink()
        
        cr.commit()
        print("Orphaned attachments cleaned successfully")
        
except Exception as e:
    print(f"Cleanup completed with warnings: {e}")
    pass
EOF

    python3 /tmp/clean_attachments.py --config="$CONFIG_FILE" -d "$DB_NAME" 2>/dev/null || echo "Cleanup attempted"
    rm -f /tmp/clean_attachments.py
}

# Función para crear e inicializar la base de datos
create_and_initialize_database() {
    echo "Creating and initializing database '$DB_NAME'..."
    echo "Installing base modules..."
    odoo --config="$CONFIG_FILE" -d "$DB_NAME" -i base,web --stop-after-init --log-level=info --without-demo=all
    echo "Database initialized successfully"
}

# Función para inicializar base de datos existente
initialize_existing_database() {
    echo "Database exists but not initialized. Initializing..."
    echo "Installing base modules..."
    odoo --config="$CONFIG_FILE" -d "$DB_NAME" -i base,web --stop-after-init --log-level=info --without-demo=all
    echo "Database initialized successfully"
}

# Lógica principal equivalente al script original
echo "Checking database status..."

if check_database_with_odoo; then
    echo "Database '$DB_NAME' exists"
    
    if check_modules_installed; then
        echo "Database properly initialized. Cleaning orphaned files..."
        # Limpiar archivos huérfanos antes de iniciar
        clean_orphaned_attachments_with_odoo
        echo "Starting Odoo..."
        exec odoo --config="$CONFIG_FILE" --log-level=info
    else
        echo "Database exists but not initialized. Initializing..."
        # Limpiar archivos huérfanos primero
        clean_orphaned_attachments_with_odoo
        initialize_existing_database
        echo "Starting Odoo..."
        exec odoo --config="$CONFIG_FILE" --log-level=info
    fi
else
    echo "Database '$DB_NAME' does not exist. Creating..."
    create_and_initialize_database
    echo "Starting Odoo with new database..."
    exec odoo --config="$CONFIG_FILE" --log-level=info
fi