# -*- coding: utf-8 -*-
# Part of Creyox Technologies
{
    'name': 'Generate an Excel & PDF Report of Purchase of Customers',
    "author": "Creyox Technologies",
    "website": "https://www.creyox.com",
    "support": "support@creyox.com",
    'category': 'Purchase',
    'summary': 'Print Excel and PDF reports of Purchase orders of customer between start date and end date',
    'license': 'LGPL-3',
    'version': '16.0.0.1',
    'description': """

Generate Excel & PDF Report of Purchase order for Customer is module where 
all the Purchase orders of customer is fetched and stored into container and
on button click functionality it downloads the EXcel or PDF Report for 
the start date and end date given from wizard area.

""",
    'depends': ["account", "base", "purchase"],
    'data': [
        "security/ir.model.access.csv",
        "wizard/res_partner_wizard_view.xml",
        "report/purchase_excel_to_pdf_report_template.xml",
        "report/purchase_excel_to_pdf_report.xml",
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
    "images": ["static/description/banner.png", ],
    "price": 0,
    "currency": "USD"
}
