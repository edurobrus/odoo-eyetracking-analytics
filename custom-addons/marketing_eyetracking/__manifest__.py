# -*- coding: utf-8 -*-
{
    'name': "marketing_eyetracking",
    'version': '1.0',
    'summary': 'Analyze marketing campaigns using eye tracking techniques',
    'description': """This module allows recording and analyzing eye tracking data during marketing campaigns.
    Additionally, it integrates a webcam functionality to capture live video.""",
    'author': 'Eduardo Robles Russo',
    'category': 'Marketing',
    'depends': ['base', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'views/views.xml'
    ],
    'assets': {
        'web.assets_backend': [
            'marketing_eyetracking/static/src/lib/ridgeWorker.js',
            'marketing_eyetracking/static/src/lib/webgazer.js',
            'marketing_eyetracking/static/src/lib/sweetalert.min.js',
            'marketing_eyetracking/static/src/lib/html2canvas.min.js',
            'marketing_eyetracking/static/src/js/webcam_dialog.js',
            'marketing_eyetracking/static/src/js/calibration.js',
            'marketing_eyetracking/static/src/js/main.js',
            'marketing_eyetracking/static/src/js/collision.js',
            'marketing_eyetracking/static/src/js/heatmap-demo.js',
            'marketing_eyetracking/static/src/js/precision_store_points.js',
            'marketing_eyetracking/static/src/js/precision_calculation.js',
            'marketing_eyetracking/static/src/js/resize_canvas.js',
            'marketing_eyetracking/static/src/js/image_field.js',
            "marketing_eyetracking/static/src/xml/web_widget_image_webcam.xml"
        ],
    },
    'installable': True,
    'application': True
}
