#!/usr/bin/env python3
"""
Script de inicio de Odoo en Python para entorno Docker
Utiliza la instancia de Odoo en ejecución para realizar las operaciones
"""

import os
import sys
import logging
import time
import psycopg2
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
        
        # Obtener configuración de BD desde variables de entorno
        self.db_host = os.environ.get('DB_HOST', 'db')
        self.db_port = int(os.environ.get('DB_PORT', 5432))
        self.db_user = os.environ.get('DB_USER', 'odoo')
        self.db_password = os.environ.get('DB_PASSWORD', 'odoo')
        self.db_name = os.environ.get('DB_NAME', 'odoo')
        
        self.log_dir = "/mnt/extra-addons/marketing_eyetracking/log"
        
        logger.info(f"Using Odoo configuration from: {self.config_file}")
        logger.info(f"Database connection: {self.db_user}@{self.db_host}:{self.db_port}")

    def wait_for_database(self, max_attempts=30):
        """Esperar a que la base de datos PostgreSQL esté disponible"""
        logger.info(f"Waiting for database at {self.db_host}:{self.db_port}...")
        
        for attempt in range(max_attempts):
            try:
                conn = psycopg2.connect(
                    host=self.db_host,
                    port=self.db_port,
                    user=self.db_user,
                    password=self.db_password,
                    database='postgres'  # Conectar a la BD por defecto
                )
                conn.close()
                logger.info("Database server is ready!")
                return True
            except psycopg2.OperationalError as e:
                logger.info(f"Database not ready (attempt {attempt + 1}/{max_attempts}): {e}")
                time.sleep(2)
        
        logger.error("Database server is not available after waiting")
        return False

    def setup_odoo_config(self):
        """Configurar Odoo con parámetros de BD desde variables de entorno"""
        # Configurar parámetros de BD dinámicamente
        config_params = [
            '-c', self.config_file,
            f'--db_host={self.db_host}',
            f'--db_port={self.db_port}',
            f'--db_user={self.db_user}',
            f'--db_password={self.db_password}',
        ]
        
        config.parse_config(config_params)
        logger.info("Odoo configuration updated with database parameters")

    def create_filestore_structure(self):
        """Crear estructura completa del filestore"""
        logger.info("Creating filestore directory structure...")
        
        filestore_dir = f"/tmp/odoo/filestore/{self.db_name}"
        
        # Crear directorio principal
        Path(filestore_dir).mkdir(parents=True, exist_ok=True)
        
        # Crear subdirectorios hexadecimales (00-ff)
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
        """Verificar si la base de datos existe usando conexión directa"""
        try:
            conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                user=self.db_user,
                password=self.db_password,
                database='postgres'
            )
            
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (self.db_name,))
            exists = cursor.fetchone() is not None
            
            cursor.close()
            conn.close()
            
            logger.info(f"Database '{self.db_name}' exists: {exists}")
            return exists
            
        except Exception as e:
            logger.error(f"Error checking database existence: {e}")
            return False

    def create_database(self):
        """Crear la base de datos usando conexión directa"""
        logger.info(f"Creating database '{self.db_name}'...")
        
        try:
            conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                user=self.db_user,
                password=self.db_password,
                database='postgres'
            )
            conn.autocommit = True
            
            cursor = conn.cursor()
            cursor.execute(f'CREATE DATABASE "{self.db_name}" OWNER "{self.db_user}"')
            
            cursor.close()
            conn.close()
            
            logger.info("Database created successfully")
            return True
        except Exception as e:
            logger.error(f"Error creating database: {e}")
            return False

    def check_db_initialized(self):
        """Verificar si la BD está inicializada usando Odoo"""
        try:
            registry = odoo.registry(self.db_name)
            with registry.cursor() as cr:
                env = api.Environment(cr, SUPERUSER_ID, {})
                # Verificar si el módulo web está instalado
                web_module = env['ir.module.module'].search([
                    ('name', '=', 'web'),
                    ('state', '=', 'installed')
                ], limit=1)
                initialized = bool(web_module)
                logger.info(f"Database {self.db_name} initialized: {initialized}")
                return initialized
        except Exception as e:
            logger.info(f"Database not initialized: {e}")
            return False

    def initialize_database(self):
        """Inicializar base de datos con módulos base usando Odoo"""
        logger.info("Installing base modules...")
        
        try:
            registry = odoo.registry(self.db_name)
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

    def clean_orphaned_attachments(self):
        """Limpiar referencias de archivos huérfanos usando Odoo"""
        logger.info("Cleaning orphaned file references...")
        
        try:
            registry = odoo.registry(self.db_name)
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

    def start_odoo_server(self):
        """Iniciar el servidor de Odoo"""
        logger.info("Starting Odoo server...")
        
        try:
            # Configurar Odoo con parámetros finales
            self.setup_odoo_config()
            
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
        
        # Esperar a que la BD esté disponible
        if not self.wait_for_database():
            logger.error("Database server is not available")
            sys.exit(1)
        
        # Configurar Odoo inicial
        self.setup_odoo_config()
        
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
                logger.info(f"Database '{self.db_name}' does not exist. Creating...")
                
                if self.create_database():
                    logger.info("Initializing database with base modules...")
                    if not self.initialize_database():
                        logger.error("Failed to initialize new database")
                        sys.exit(1)
                else:
                    logger.error("Failed to create database")
                    sys.exit(1)
            
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