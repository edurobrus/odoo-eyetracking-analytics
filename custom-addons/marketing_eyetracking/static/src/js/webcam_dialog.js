/** @odoo-module */
const { Component, useRef, useState, onMounted } = owl;
import { Dialog } from "@web/core/dialog/dialog";
import { session } from '@web/session';

class WebcamDialog extends Component {
    async setup() {
        super.setup();
        this.state = useState({
            snapshot: ""
        });
        this.video = useRef("video");
        this.saveButton = useRef("saveButton");
        this.selectCamera = useRef("selectCamera");
        onMounted(() => this._mounted());
    }

    async _mounted() {
        await this.initSelectCamera();
        await this.startVideo();
    }

    async initSelectCamera() {
        // Agregar todos los dispositivos de cámara disponibles al selector
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        videoDevices.map(videoDevice => {
            let opt = document.createElement('option');
            opt.value = videoDevice.deviceId;
            opt.innerHTML = videoDevice.label || `Camera ${videoDevice.deviceId}`;
            this.selectCamera.el.append(opt);
            return opt;
        });
    }

    onChangeDevice(e) {
        // Cambiar la cámara seleccionada
        const device = $(e.target).val();
        this.stopVideo();
        this.startVideo(device);
    }

    // Método para tomar la foto con puntos de la mirada
    takeSnapshot(video) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const canvasContext = canvas.getContext("2d");

        // Dibujar el video en el canvas
        canvasContext.drawImage(video, 0, 0);

        // Si hay datos de la mirada, dibujar los puntos sobre el video
        if (window.gazeData && window.gazeData.length > 0) {
            window.gazeData.forEach(({ x, y }) => {
                this.drawGazePoint(canvasContext, x, y);
            });
        }

        // Retornar la imagen en base64
        return canvas.toDataURL('image/jpeg');
    }

    // Función para dibujar los puntos de la mirada sobre el canvas
    drawGazePoint(ctx, x, y) {
        const radius = 15;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 0, 1)'); // Amarillo brillante
        gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.7)'); // Naranja
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)'); // Rojo transparente
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    async handleStream(stream) {
        const def = $.Deferred();

        // Establecer la cámara seleccionada en el selector
        if (stream && stream.getVideoTracks().length)
            this.selectCamera.el.value = stream.getVideoTracks()[0].getSettings().deviceId;

        // Mostrar el video en el diálogo
        this.video.el.srcObject = stream;

        this.video.el.addEventListener("canplay", () => {
            this.video.el.play();
        });

        this.video.el.addEventListener("loadedmetadata", () => {
            this.streamStarted = true;
            def.resolve();
        }, false);

        return def;
    }

    async startVideo(device = null) {
        try {
            let config = {
                width: { ideal: session.am_webcam_width || 1280 },
                height: { ideal: session.am_webcam_height || 720 },
            }
            if (device)
                config.deviceId = { exact: device }

            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: config
            });
            await this.handleStream(videoStream);
        } catch (e) {
            console.error('Error al iniciar video:', e);
        }
    }

    stopVideo() {
        // Detener el flujo de video
        this.streamStarted = false;

        // Si el flujo de video está activo, detenerlo
        if (this.video.el.srcObject)
            this.video.el.srcObject.getTracks().forEach((track) => {
                track.stop();
            });
    }

    /**
     * @returns {string}
     */
    getBody() {
        return this.env._t('You can adjust the default photo size and quality in the general settings.');
    }

    /**
     * @returns {string}
     */
    getTitle() {
        return this.env._t("Attachments Manager Webcam");
    }

    urltoFile(url, filename, mimeType) {
        return (fetch(url)
            .then(function (res) { return res.arrayBuffer(); })
            .then(function (buf) { return new File([buf], filename, { type: mimeType }); })
        );
    }

    async onwebcam(base64, mimetype) {
        await this.props.onWebcamCallback(base64);
    }

    // Handlers
    _onClickCancel(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.stopVideo();
        this.props.close();
    }

    _onWebcamSnapshot() {
        // Capturar la imagen con los puntos de la mirada
        this.state.snapshot = this.takeSnapshot(this.video.el);
    }

    _onStartEyeTracking() {
        if (!window.webgazer) {
            console.error("WebGazer no está cargado.");
            return;
        }
        window.gazeData = [];
        webgazer.setGazeListener((data, elapsedTime) => {
            if (data !== null) {
                window.gazeData.push({ x: data.x, y: data.y });
            }
        }).begin();

        console.log("Seguimiento ocular iniciado.");
    }

    _onStopEyeTracking() {
        if (!window.webgazer) {
            console.error("WebGazer no está cargado.");
            return;
        }

        webgazer.end();
        console.log("Seguimiento ocular detenido.");

        // Al finalizar, guardar los puntos capturados en la imagen
        this.drawAllPoints();
    }

    // Función para dibujar todos los puntos
    drawAllPoints() {
        if (window.gazeData && window.gazeData.length > 0) {
            // Usar html2canvas para capturar toda la página
            const canvas = document.createElement('canvas');
            canvas.width = 100;  // Establecer el tamaño correcto
            canvas.height = 100;
            const context = canvas.getContext('2d');
            html2canvas(document.body, {
                useCORS: true, // Permite cargar imágenes de dominios cruzados
                backgroundColor: '#ffffff', // Fondo blanco en caso de que no se pueda cargar el fondo
            }).then((canvas) => {
                const imageData = canvas.toDataURL('image/png');
                const fileName = 'full_page_screenshot.png';
                const link = document.createElement('a');
                link.download = fileName;
                link.href = imageData;
                link.click();
                console.log("Captura completa descargada.");
            }).catch((error) => {
                console.error("Error al capturar el HTML:", error);
            });
        }
    }

    async _onWebcamSave(ev) {
        if (!this.state.snapshot) return;

        // Enviar la imagen capturada al callback
        await this.onwebcam(this.state.snapshot.split(',')[1], "image/jpeg");
        this._onClickCancel(ev);
    }
}

WebcamDialog.props = {
    mode: { type: Boolean, optional: true },
    onWebcamCallback: { type: Function, optional: true },
    close: Function,
};

WebcamDialog.components = {
    Dialog,
};

WebcamDialog.defaultProps = {
    mode: false,
    onWebcamCallback: () => { },
};

WebcamDialog.template = 'marketing_eyetracking.WebcamDialog';

export default WebcamDialog;
