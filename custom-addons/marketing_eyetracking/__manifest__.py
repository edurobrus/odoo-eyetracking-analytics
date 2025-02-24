{
    'name': 'Eye Tracking for Marketing',
    'version': '1.0',
    'summary': 'Analyze marketing campaigns using eye tracking techniques',
    'description': """This module allows recording and analyzing eye tracking data during marketing campaigns.
                      Additionally, it integrates a webcam functionality to capture live video.""",
    'author': 'Eduardo Robles Russo',
    'category': 'Marketing',
    'depends': ['base', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'views/eyetracking_analysis_views.xml',
        'views/eyetracking_session_views.xml',
        'views/menu_views.xml',
    ],
    'images': ['static/description/icon.png'],
    "assets": {
        "web.assets_backend": [
            "marketing_eyetracking/static/src/js/webcam_dialog.js",
            "marketing_eyetracking/static/src/js/image_field.js",
            "marketing_eyetracking/static/src/xml/web_widget_image_webcam.xml",
        ],
    },
    'installable': True,
    'application': True,
}
