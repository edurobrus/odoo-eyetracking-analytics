// static/src/js/image_field.js
odoo.define('marketing_eyetracking.image_field', function (require) {
    var FormController = require('web.FormController');
    var Dialog = require('web.Dialog');
    var core = require('web.core');

    FormController.include({
        _onOpenWebcamDialog: function () {
            // Mostrar un diálogo para capturar la imagen
            var self = this;
            new Dialog(this, {
                title: 'Capturar imagen de la cámara',
                size: 'medium',
                $content: $('<video autoplay></video>').attr('id', 'webcam'),
                buttons: [
                    {
                        text: 'Capturar',
                        classes: 'btn-primary',
                        click: function () {
                            // Lógica para capturar la imagen
                            var video = document.getElementById('webcam');
                            var canvas = document.createElement('canvas');
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            canvas.getContext('2d').drawImage(video, 0, 0);
                            var imageUrl = canvas.toDataURL();
                            self._setValue(imageUrl);  // Establecer la imagen en el campo
                            self.close();
                        }
                    }
                ]
            }).open();
        }
    });
});
