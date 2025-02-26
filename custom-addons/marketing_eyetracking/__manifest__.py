{
    'name': 'Eye Tracking for Marketing',
    'version': '1.0',
    'summary': 'Analiza campañas de marketing utilizando técnicas de eye tracking',
    'description': """Este módulo permite grabar y analizar datos de eye tracking durante campañas de marketing.
                      Además, integra una funcionalidad de webcam para capturar video en vivo.""",
    'author': 'Eduardo Robles Russo',
    'category': 'Marketing',
    'depends': ['base', 'web'],
    'data': [
        'views/assets.xml',  # Asegúrate de que tu archivo de assets esté aquí
        'views/form_view.xml',  # El archivo con el formulario y el botón de cámara
    ],
    'assets': {
        'web.assets_backend': [
            'marketing_eyetracking/static/src/js/webcam_dialog.js',
        ],
        'web.assets_frontend': [
            'marketing_eyetracking/static/src/js/webcam_dialog.js',
        ],
    },

    'images': ['static/description/icon.png'],
    'installable': True,
    'application': True,
}
