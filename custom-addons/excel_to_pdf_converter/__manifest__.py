{
    'name': 'Excel to PDF Converter',
    'version': '16.0.1.0.0',
    'category': 'Tools',
    'summary': 'Convert Excel files to PDF format',
    'description': '''
        This module allows you to convert Excel files to PDF format.
        - Supports multiple file selection
        - Works on Windows (Excel COM) and Linux (LibreOffice)
        - Auto-installs LibreOffice if not present on Linux
        - Simple and user-friendly interface
    ''',
    'author': 'Your Company',
    'website': 'https://www.yourcompany.com',
    'depends': ['base', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/excel_converter_wizard_views.xml',
        'views/excel_file_views.xml',
        'views/menu_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
