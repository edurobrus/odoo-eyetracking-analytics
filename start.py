#!/usr/bin/env python3
"""
Script de inicio de Odoo en Python usando la API interna de Odoo
Utiliza la instancia de Odoo en ejecución para realizar las operaciones
"""

import os
import sys
import logging
from pathlib import Path

# Agregar Odoo al path si no está
sys.path.append('/usr/lib/python3/dist-packages')

import odoo
from odoo import api, SUPERUSER_ID
from odoo.tools import config
from odoo.service import db

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class OdooStarter:
    def __init__(self):
        self.config_file = "/etc/odoo/odoo.conf"
        
        # Configurar Odoo con el archivo de configuración
        config.parse_config(['-c', self.config_file])
        
        # Usar None para que Odoo maneje automáticamente la BD
        self.db_name = None
        
        self.log_dir = "/mnt/extra-addons/marketing_eyetracking/log"
        
        logger.info(f"Using Odoo configuration from: {self.config_file}")
        logger.info("Database will be handled automatically by Odoo")

    def create_filestore_structure(self):
        """Crear estructura completa del filestore"""
        logger.info("Creating filestore directory structure...")
        
        # Si no tenemos nombre específico, crear estructura general
        if self.db_name:
            filestore_dir = f"/tmp/odoo/filestore/{self.db_name}"
        else:
            filestore_dir = "/tmp/odoo/filestore"
        
        # Crear directorio principal
        Path(filestore_dir).mkdir(parents=True, exist_ok=True)
        
        # Crear subdirectorios hexadecimales (00-ff) solo si tenemos BD específica
        if self.db_name:
            for i in range(16):
                for j in range(16):
                    hex_dir = f"{i:x}{j:x}"
                    Path(f"{filestore_dir}/{hex_dir}").mkdir(parents=True, exist_ok=True)
        
        logger.info("Filestore structure created")

    def create_log_directory(self):
        """Crear directorio de logs"""
        try:
            Path(self.log_dir).mkdir(parents=True, exist_ok=True)
            logger.info(f"Log directory created: {self.log_dir}")
        except Exception as e:
            logger.warning(f"Could not create log directory: {e}")

    def check_database_exists(self):
        """Verificar si la base de datos existe usando Odoo"""
        try:
            databases = db.list_dbs()
            logger.info(f"Available databases: {databases}")
            
            if self.db_name:
                exists = self.db_name in databases
                logger.info(f"Database '{self.db_name}' exists: {exists}")
                return exists
            else:
                # Si no especificamos BD, asumimos que existe al menos una
                return len(databases) > 0
                
        except Exception as e:
            logger.error(f"Error checking database existence: {e}")
            return False

    def check_db_initialized(self):
        """Verificar si la BD está inicializada usando Odoo"""
        try:
            # Si no hay nombre específico, usar la primera BD disponible
            db_name = self.db_name
            if not db_name:
                databases = db.list_dbs()
                if databases:
                    db_name = databases[0]
                else:
                    return False
            
            # Intentar conectar a la base de datos
            registry = odoo.registry(db_name)
            with registry.cursor() as cr:
                env = api.Environment(cr, SUPERUSER_ID, {})
                # Verificar si el módulo web está instalado
                web_module = env['ir.module.module'].search([
                    ('name', '=', 'web'),
                    ('state', '=', 'installed')
                ], limit=1)
                initialized = bool(web_module)
                logger.info(f"Database {db_name} initialized: {initialized}")
                return initialized
        except Exception as e:
            logger.info(f"Database not initialized: {e}")
            return False

    def clean_orphaned_attachments(self):
        """Limpiar referencias de archivos huérfanos usando Odoo"""
        logger.info("Cleaning orphaned file references...")
        
        try:
            # Determinar qué BD usar
            db_name = self.db_name
            if not db_name:
                databases = db.list_dbs()
                if databases:
                    db_name = databases[0]
                else:
                    logger.warning("No database found for cleaning")
                    return
            
            registry = odoo.registry(db_name)
            with registry.cursor() as cr:
                env = api.Environment(cr, SUPERUSER_ID, {})
                
                # Buscar attachments con archivos pero que no sean vistas
                orphaned_attachments = env['ir.attachment'].search([
                    ('store_fname', '!=', False),
                    ('store_fname', '!=', ''),
                    ('type', '=', 'binary'),
                    ('res_model', '!=', 'ir.ui.view')
                ])
                
                if orphaned_attachments:
                    count = len(orphaned_attachments)
                    orphaned_attachments.unlink()
                    logger.info(f"Cleaned {count} orphaned attachments")
                
                # Limpiar assets de vistas
                asset_attachments = env['ir.attachment'].search([
                    ('res_model', '=', 'ir.ui.view'),
                    ('name', 'like', '%.assets_%')
                ])
                
                if asset_attachments:
                    count = len(asset_attachments)
                    asset_attachments.unlink()
                    logger.info(f"Cleaned {count} asset attachments")
                
                cr.commit()
                logger.info("Orphaned attachments cleaned successfully")
                
        except Exception as e:
            logger.warning(f"Error cleaning orphaned attachments: {e}")

    def create_database(self):
        """Crear la base de datos usando Odoo"""
        if not self.db_name:
            logger.warning("No database name specified, skipping database creation")
            return True
            
        logger.info(f"Creating database '{self.db_name}'...")
        
        try:
            # Crear base de datos usando la API de Odoo
            db.exp_create_database(self.db_name, False, 'en_US', 'admin')
            logger.info("Database created successfully")
            return True
        except Exception as e:
            logger.error(f"Error creating database: {e}")
            return False

    def initialize_database(self):
        """Inicializar base de datos con módulos base usando Odoo"""
        logger.info("Installing base modules...")
        
        try:
            # Determinar qué BD usar
            db_name = self.db_name
            if not db_name:
                databases = db.list_dbs()
                if databases:
                    db_name = databases[0]
                else:
                    logger.error("No database available for initialization")
                    return False
            
            registry = odoo.registry(db_name)
            with registry.cursor() as cr:
                env = api.Environment(cr, SUPERUSER_ID, {})
                
                # Instalar módulos base
                modules_to_install = ['base', 'web']
                
                for module_name in modules_to_install:
                    module = env['ir.module.module'].search([
                        ('name', '=', module_name)
                    ], limit=1)
                    
                    if module and module.state not in ['installed', 'to install']:
                        module.button_immediate_install()
                        logger.info(f"Module '{module_name}' installed")
                
                cr.commit()
                logger.info("Base modules installed successfully")
                return True
                
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            return False

    def start_odoo_server(self):
        """Iniciar el servidor de Odoo"""
        logger.info("Starting Odoo server...")
        
        try:
            # Configurar Odoo
            odoo.tools.config.parse_config(['-c', self.config_file])
            
            # Iniciar el servidor
            odoo.service.server.start(preload=[], stop=False)
            
        except KeyboardInterrupt:
            logger.info("Odoo server stopped by user")
        except Exception as e:
            logger.error(f"Error starting Odoo server: {e}")
            sys.exit(1)

    def run(self):
        """Función principal de ejecución"""
        logger.info("Starting Odoo initialization...")
        
        # Crear estructura de filestore
        self.create_filestore_structure()
        
        # Crear directorio de logs
        self.create_log_directory()
        
        try:
            # Verificar estado de la base de datos
            if self.check_database_exists():
                logger.info("Database exists")
                
                if self.check_db_initialized():
                    logger.info("Database properly initialized. Cleaning orphaned files...")
                    self.clean_orphaned_attachments()
                else:
                    logger.info("Database exists but not initialized. Initializing...")
                    if not self.initialize_database():
                        logger.error("Failed to initialize database")
                        sys.exit(1)
            else:
                if self.db_name:
                    logger.info(f"Database '{self.db_name}' does not exist. Creating...")
                    
                    if self.create_database():
                        logger.info("Initializing database with base modules...")
                        if not self.initialize_database():
                            logger.error("Failed to initialize new database")
                            sys.exit(1)
                    else:
                        logger.error("Failed to create database")
                        sys.exit(1)
                else:
                    logger.info("No specific database configured, starting Odoo...")
            
            # Iniciar servidor de Odoo
            self.start_odoo_server()
            
        except Exception as e:
            logger.error(f"Unexpected error during initialization: {e}")
            sys.exit(1)


if __name__ == "__main__":
    try:
        starter = OdooStarter()
        starter.run()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)