import os
import subprocess
import platform
import logging
from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

class ExcelFile(models.Model):
    _name = 'excel.file'
    _description = 'Excel File Record'
    _order = 'create_date desc'

    name = fields.Char('File Name', required=True)
    excel_file = fields.Binary('Excel File', required=True)
    pdf_file = fields.Binary('PDF File', readonly=True)
    pdf_filename = fields.Char('PDF Filename', readonly=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('processing', 'Processing'),
        ('converted', 'Converted'),
        ('error', 'Error')
    ], default='draft', string='Status')

    error_message = fields.Text('Error Message', readonly=True)

    # Agregar constraint SQL para unicidad
    _sql_constraints = [
        ('name_unique', 'unique(name)', 'El nombre del archivo debe ser único!')
    ]

    @api.model
    def create(self, vals):
        """Override create to handle unique name constraint"""
        if 'name' in vals:
            # Buscar si ya existe un registro con el mismo nombre
            existing_record = self.search([('name', '=', vals['name'])], limit=1)
            if existing_record:
                # Si existe, actualizarlo en lugar de crear uno nuevo
                _logger.info(f"Actualizando registro existente con nombre: {vals['name']}")
                existing_record.write({
                    'excel_file': vals.get('excel_file', existing_record.excel_file),
                    'state': vals.get('state', 'draft'),
                    'pdf_file': False,  # Reset PDF cuando se actualiza el Excel
                    'pdf_filename': False,
                    'error_message': False
                })
                return existing_record
        
        # Si no existe, crear normalmente
        return super(ExcelFile, self).create(vals)

    def write(self, vals):
        """Override write to handle name changes"""
        if 'name' in vals:
            # Verificar si el nuevo nombre ya existe en otro registro
            for record in self:
                existing_record = self.search([
                    ('name', '=', vals['name']),
                    ('id', '!=', record.id)
                ], limit=1)
                if existing_record:
                    raise ValidationError(
                        _("Ya existe un archivo con el nombre '%s'. Por favor, use un nombre diferente.") % vals['name']
                    )
        
        return super(ExcelFile, self).write(vals)

    def _check_libreoffice_installed(self):
        """Check if LibreOffice is installed on Linux"""
        try:
            result = subprocess.run(['libreoffice', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except:
            return False

    def _install_libreoffice(self):
        """Install LibreOffice on Linux"""
        try:
            _logger.info("Installing LibreOffice...")
            # Try different package managers
            commands = [
                ['sudo', 'apt-get', 'update', '&&', 'sudo', 'apt-get', 'install', '-y', 'libreoffice'],
                ['sudo', 'yum', 'install', '-y', 'libreoffice'],
                ['sudo', 'dnf', 'install', '-y', 'libreoffice'],
                ['sudo', 'pacman', '-S', '--noconfirm', 'libreoffice-fresh']
            ]
            
            for cmd in commands:
                try:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                    if result.returncode == 0:
                        _logger.info("LibreOffice installed successfully")
                        return True
                except:
                    continue
            
            return False
        except Exception as e:
            _logger.error(f"Error installing LibreOffice: {str(e)}")
            return False

    def _convert_with_libreoffice(self, excel_path, output_dir):
        """Convert Excel to PDF using LibreOffice"""
        try:
            # Check if LibreOffice is installed
            if not self._check_libreoffice_installed():
                _logger.info("LibreOffice not found, attempting to install...")
                if not self._install_libreoffice():
                    raise UserError(_("LibreOffice is not installed and could not be installed automatically. Please install it manually."))
            
            # Convert using LibreOffice headless mode
            cmd = [
                'libreoffice',
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', output_dir,
                excel_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode == 0:
                # Find the generated PDF file
                base_name = os.path.splitext(os.path.basename(excel_path))[0]
                pdf_path = os.path.join(output_dir, f"{base_name}.pdf")
                
                if os.path.exists(pdf_path):
                    return True, pdf_path
                else:
                    return False, "PDF file was not generated"
            else:
                return False, f"LibreOffice error: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return False, "Conversion timeout"
        except Exception as e:
            return False, f"Error: {str(e)}"

    def _convert_with_excel_com(self, excel_path, output_dir):
        """Convert Excel to PDF using Windows COM (your original function)"""
        import win32com.client
        import pythoncom
        import time
        
        excel_app = None
        workbook = None
        
        try:
            # Initialize COM for this thread
            pythoncom.CoInitialize()
            
            # Create output filename
            file_name = os.path.basename(excel_path)
            pdf_name = os.path.splitext(file_name)[0] + '.pdf'
            pdf_path = os.path.join(output_dir, pdf_name)
            
            # Convert to absolute paths
            excel_path = os.path.abspath(excel_path)
            pdf_path = os.path.abspath(pdf_path)
            
            # Verify file exists
            if not os.path.exists(excel_path):
                return False, "File does not exist"
            
            # Retry COM connection if necessary
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    excel_app = win32com.client.DispatchEx("Excel.Application")
                    excel_app.DisplayAlerts = False
                    excel_app.Visible = False
                    excel_app.ScreenUpdating = False
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        return False, f"Could not initialize Excel after {max_retries} attempts: {str(e)}"
                    time.sleep(1)
            
            try:
                workbook = excel_app.Workbooks.Open(
                    excel_path,
                    UpdateLinks=0,
                    ReadOnly=True,
                    IgnoreReadOnlyRecommended=True,
                    Notify=False,
                    CorruptLoad=1
                )
                
                if workbook.Sheets.Count == 0:
                    return False, "Excel file contains no sheets"
                
                # Configure print options for all sheets
                for sheet_index in range(1, workbook.Sheets.Count + 1):
                    try:
                        sheet = workbook.Sheets(sheet_index)
                        if sheet.UsedRange is None:
                            continue
                        
                        sheet.PageSetup.Zoom = False
                        sheet.PageSetup.FitToPagesWide = 1
                        sheet.PageSetup.FitToPagesTall = False
                        sheet.PageSetup.LeftMargin = excel_app.InchesToPoints(0.5)
                        sheet.PageSetup.RightMargin = excel_app.InchesToPoints(0.5)
                        sheet.PageSetup.TopMargin = excel_app.InchesToPoints(0.5)
                        sheet.PageSetup.BottomMargin = excel_app.InchesToPoints(0.5)
                        
                    except Exception as sheet_e:
                        _logger.warning(f"Error configuring sheet {sheet_index}: {str(sheet_e)}")
                        continue
                
                # Export to PDF
                workbook.ExportAsFixedFormat(
                    Type=0,  # PDF
                    Filename=pdf_path,
                    Quality=0,  # Standard
                    IncludeDocProperties=True,
                    IgnorePrintAreas=False,
                    OpenAfterPublish=False
                )
                
                time.sleep(0.5)
                
                if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
                    return True, pdf_path
                else:
                    return False, "PDF file was not generated correctly"
                    
            except Exception as inner_e:
                error_msg = str(inner_e)
                if "-2147221005" in error_msg:
                    return False, "COM Error: Possible corrupt file or incompatible Excel version"
                else:
                    return False, f"Error processing Excel: {error_msg}"
        
        except Exception as e:
            return False, f"General error: {str(e)}"
        
        finally:
            # Clean up resources safely
            try:
                if workbook:
                    workbook.Close(False)
            except:
                pass
            
            try:
                if excel_app:
                    excel_app.Quit()
            except:
                pass
            
            try:
                if excel_app:
                    del excel_app
            except:
                pass
            
            try:
                pythoncom.CoUninitialize()
            except:
                pass

    @api.model
    def convert_excel_to_pdf(self, excel_data, filename):
        """Main conversion method"""
        import tempfile
        import base64
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save Excel file temporarily
            excel_path = os.path.join(temp_dir, filename)
            with open(excel_path, 'wb') as f:
                f.write(base64.b64decode(excel_data))
            
            # Choose conversion method based on OS
            if platform.system() == 'Windows':
                try:
                    success, result = self._convert_with_excel_com(excel_path, temp_dir)
                except ImportError:
                    # If win32com is not available, fallback to LibreOffice
                    success, result = self._convert_with_libreoffice(excel_path, temp_dir)
            else:
                success, result = self._convert_with_libreoffice(excel_path, temp_dir)
            
            if success:
                # Read PDF file and return as base64
                with open(result, 'rb') as pdf_file:
                    pdf_data = base64.b64encode(pdf_file.read())
                
                pdf_filename = os.path.basename(result)
                return True, pdf_data, pdf_filename, None
            else:
                return False, None, None, result

    def action_convert_to_pdf(self):
        """Convert single file to PDF"""
        if not self.excel_file:
            raise UserError(_("Please upload an Excel file first."))
        
        success, pdf_data, pdf_filename, error_msg = self.convert_excel_to_pdf(
            self.excel_file, self.name
        )
        
        if success:
            self.write({
                'pdf_file': pdf_data,
                'pdf_filename': pdf_filename,
                'state': 'converted',
                'error_message': False
            })
        else:
            self.write({
                'state': 'error',
                'error_message': error_msg
            })
            raise UserError(_("Conversion failed: %s") % error_msg)

    @api.model
    def create_or_update_by_name(self, vals):
        """
        Método auxiliar para crear o actualizar por nombre
        Útil para APIs o importaciones externas
        """
        if 'name' not in vals:
            raise ValidationError(_("El nombre es requerido"))
        
        existing_record = self.search([('name', '=', vals['name'])], limit=1)
        if existing_record:
            existing_record.write(vals)
            return existing_record
        else:
            return self.create(vals)