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
            # Original assets
            'marketing_eyetracking/static/src/js/webcam_dialog.js',
            'marketing_eyetracking/static/src/css/webcam_dialog.css',
            'marketing_eyetracking/static/src/js/image_field.js',
            "marketing_eyetracking/static/src/xml/web_widget_image_webcam.xml",

            # Eye tracking assets
            'marketing_eyetracking/static/lib/webgazer.js',
            'marketing_eyetracking/static/src/js/webcam_eye_tracking.js',
            'marketing_eyetracking/static/src/js/calibration.js',
            'marketing_eyetracking/static/src/js/precision_calculation.js',
            'marketing_eyetracking/static/src/js/precision_store_points.js',
        ],
    },
    'installable': True,
    'application': True
}