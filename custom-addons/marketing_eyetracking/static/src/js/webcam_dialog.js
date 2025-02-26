odoo.define('marketing_eyetracking.webcam_dialog', function (require) {
    "use strict";

    var FormController = require('web.FormController');
    var Dialog = require('web.Dialog');
    var core = require('web.core');
    var QWeb = require('web.QWeb');  // Asegúrate de usar esta línea si necesitas usar plantillas QWeb

    FormController.include({
        _onOpenWebcamDialog: function () {
            var self = this;

            // Crear el contenido del diálogo con la etiqueta video
            var $video = $('<video autoplay></video>').attr('id', 'webcam');

            // Crear el diálogo
            var dialog = new Dialog(self, {
                title: 'Captura de Webcam',
                size: 'medium',
                $content: $video,
                buttons: [
                    {
                        text: 'Capturar',
                        classes: 'btn-primary',
                        click: function () {
                            var video = document.getElementById('webcam');
                            var canvas = document.createElement('canvas');
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            canvas.getContext('2d').drawImage(video, 0, 0);
                            var imageUrl = canvas.toDataURL();
                            self._setValue(imageUrl);
                            self.close();
                        }
                    }
                ]
            });

            // Abrir el diálogo
            dialog.open();

            // Acceder al flujo de la webcam
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(function (stream) {
                    $video[0].srcObject = stream;
                    self.stream = stream;
                })
                .catch(function (error) {
                    console.error('Error al acceder a la cámara:', error);
                });
        }
    });
});
