/** @odoo-module */
const { Component, useRef, useState, onMounted } = owl;
import { useService } from "@web/core/utils/hooks";
import { session } from '@web/session';

/**
 * Eye Tracking Component
 *
 * This component handles eye tracking functionality within the Odoo interface,
 * allowing for webcam access, eye tracking, and data recording.
 */
export class EyeTrackingComponent extends Component {
    setup() {
        super.setup();
        this.state = useState({
            snapshot: "",
            calibrated: false,
            isTracking: false
        });
        this.rpcService = useService("rpc");
        this.video = useRef("video");
        this.saveButton = useRef("saveButton");
        this.selectCamera = useRef("selectCamera");
        this.recordedChunks = [];
        this.mediaRecorder = null;
        this.stream = null;
        this.streamStarted = false;
        
        onMounted(() => this._mounted());
    }
    
    async _mounted() {
        await this.initSelectCamera();
        await this.startVideo();
        this._setupCalibrationPoints();
    }
    
    /**
     * Set up calibration points for eye tracking
     * This initializes the webgazer calibration points
     */
    _setupCalibrationPoints() {
        // Wait for webgazer to be fully loaded
        if (window.webgazer) {
            // Set up calibration points
            this.calibrationPoints = [
                document.getElementById('Pt1'),
                document.getElementById('Pt2'),
                document.getElementById('Pt3'),
                document.getElementById('Pt4'),
                document.getElementById('Pt5'),
                document.getElementById('Pt6'),
                document.getElementById('Pt7'),
                document.getElementById('Pt8'),
                document.getElementById('Pt9')
            ].filter(point => point !== null);
            
            // Setup the webgazer UI elements
            this._setupUI();
        } else {
            console.warn("WebGazer is not loaded, calibration points setup skipped");
        }
    }
    
    /**
     * Sets up the WebGazer UI elements
     */
    _setupUI() {
        // Set up accuracy test to appear after calibration
        document.getElementById("Accuracy").style.display = "none";
        
        // Set up the calibration points
        const width = window.innerWidth;
        const height = window.innerHeight;
        const margin = 50;
        
        const canvasRect = document.getElementById('plotting_canvas').getBoundingClientRect();
        
        // Position calibration points
        if (this.calibrationPoints.length === 9) {
            // Set position for calibration points
            const positions = [
                { top: margin, left: margin },                           // top left
                { top: margin, left: Math.floor(width/2) },              // top center
                { top: margin, left: width - margin },                   // top right
                { top: Math.floor(height/2), left: margin },             // middle left
                { top: Math.floor(height/2), left: Math.floor(width/2) },// middle center
                { top: Math.floor(height/2), left: width - margin },     // middle right
                { top: height - margin, left: margin },                  // bottom left
                { top: height - margin, left: Math.floor(width/2) },     // bottom center
                { top: height - margin, left: width - margin }           // bottom right
            ];
            
            // Apply positions to calibration points
            this.calibrationPoints.forEach((point, index) => {
                if (point) {
                    point.style.position = 'fixed';
                    point.style.top = positions[index].top + 'px';
                    point.style.left = positions[index].left + 'px';
                }
            });
        }
    }
    
    /**
     * Clear Odoo logs related to eye tracking
     */
    async _clearOdooLog() {
        try {
            const result = await this.rpcService("/marketing_eyetracking/clear_log", {});
            if (result.status === "success") {
                console.log("Odoo log cleared successfully.");
            } else {
                console.error("Error clearing log:", result.message);
            }
        } catch (error) {
            console.error("RPC request error:", error);
        }
    }

    /**
     * Initialize the camera selection dropdown
     */
    async initSelectCamera() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            videoDevices.forEach(videoDevice => {
                let opt = document.createElement('option');
                opt.value = videoDevice.deviceId;
                opt.innerHTML = videoDevice.label || `Camera ${videoDevice.deviceId}`;
                this.selectCamera.el.append(opt);
            });
        } catch (error) {
            console.error("Error initializing camera selection:", error);
        }
    }

    /**
     * Handle camera device change
     * @param {Event} e - Change event
     */
    onChangeDevice(e) {
        const device = e.target.value;
        this.stopVideo();
        this.startVideo(device);
    }

    /**
     * Take a snapshot with eye gaze points
     * @param {HTMLVideoElement} video - Video element
     * @returns {string} - Base64 encoded image
     */
    takeSnapshot(video) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const canvasContext = canvas.getContext("2d");

        // Draw video on canvas
        canvasContext.drawImage(video, 0, 0);

        // Draw gaze points if available
        if (window.gazeData && window.gazeData.length > 0) {
            window.gazeData.forEach(({ x, y }) => {
                this.drawGazePoint(canvasContext, x, y);
            });
        }

        // Return base64 image
        return canvas.toDataURL('image/jpeg');
    }

    /**
     * Draw a gaze point on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    drawGazePoint(ctx, x, y) {
        const radius = 15;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 0, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    /**
     * Handle video stream
     * @param {MediaStream} stream - Media stream
     */
    async handleStream(stream) {
        const def = $.Deferred();

        // Set selected camera in dropdown
        if (stream && stream.getVideoTracks().length)
            this.selectCamera.el.value = stream.getVideoTracks()[0].getSettings().deviceId;

        // Display video in dialog
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

    /**
     * Start video stream
     * @param {string} device - Device ID
     */
    async startVideo(device = null) {
        try {
            let config = {
                width: { ideal: session.am_webcam_width || 1280 },
                height: { ideal: session.am_webcam_height || 720 },
            };
            
            if (device) {
                config.deviceId = { exact: device };
            }

            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: config
            });
            
            await this.handleStream(videoStream);
        } catch (e) {
            console.error('Error starting video:', e);
        }
    }

    /**
     * Stop video stream
     */
    stopVideo() {
        this.streamStarted = false;

        if (this.video.el.srcObject) {
            this.video.el.srcObject.getTracks().forEach((track) => {
                track.stop();
            });
        }
    }

    /**
     * Convert URL to File
     * @param {string} url - URL
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     * @returns {Promise<File>} - File object
     */
    urltoFile(url, filename, mimeType) {
        return (fetch(url)
            .then(function (res) { return res.arrayBuffer(); })
            .then(function (buf) { return new File([buf], filename, { type: mimeType }); })
        );
    }

    /**
     * Handle webcam snapshot
     * @param {string} base64 - Base64 encoded image
     * @param {string} mimetype - MIME type
     */
    async onwebcam(base64, mimetype) {
        if (this.props.onWebcamCallback) {
            await this.props.onWebcamCallback(base64);
        }
    }

    /**
     * Start eye tracking
     */
    async _onStartEyeTracking() {
        if (!window.webgazer) {
            console.error("WebGazer is not loaded.");
            return;
        }
        
        window.gazeData = [];
        window.recordData = [];
        let record = true;
        this.state.isTracking = true;
        this.eyeTrackingStartTime = new Date();
        
        // Try to get screen stream
        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: true
            });
            this.mediaRecorder = new MediaRecorder(this.stream);
        } catch (err) {
            console.error("Could not capture screen:", err);
            console.log("Continuing with eye tracking without screen recording");
        }
        
        webgazer.setGazeListener((data, elapsedTime) => {
            if (data !== null) {
                const now = new Date();
                if (this.mediaRecorder) {
                    try {
                        if (record) {
                            this.mediaRecorder.ondataavailable = (event) => {
                                window.recordData.push(event.data);
                            };
                            this.mediaRecorder.onstop = () => {
                                this._saveRecording();
                            };
                            this.mediaRecorder.start();
                            record = false;
                        }
                    } catch (err) {
                        console.error("Error setting up recording:", err);
                        this.mediaRecorder = null;
                    }
                }
                window.gazeData.push({
                    x: data.x,
                    y: data.y,
                    timestamp: now.toISOString().slice(0, 19).replace("T", " ")
                });
            }
        }).begin();
        
        this._clearOdooLog();
        console.log("Eye tracking started.");
    }

    /**
     * Stop eye tracking
     */
    _onStopEyeTracking() {
        if (!window.webgazer) {
            console.error("WebGazer is not loaded.");
            return;
        }

        this.state.isTracking = false;
        
        // Stop WebGazer
        webgazer.end();
        console.log("Eye tracking stopped.");
        
        // Save recording and stop screen recording
        this._saveRecording();
        this._stopScreenRecording();
    }

    /**
     * Stop screen recording
     */
    async _stopScreenRecording() {
        // Stop screen recording
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            this.mediaRecorder.stop();
        }

        // Stop stream
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
        }

        webgazer.clearData();
        if (window.localforage) {
            localforage.clear();
        }
    }

    /**
     * Save recording
     */
    async _saveRecording() {
        if (!window.recordData || window.recordData.length === 0) {
            console.log("No recording data to save.");
            
            // Still save gaze data if available
            if (window.gazeData && window.gazeData.length > 0) {
                await this._saveGazeData(window.gazeData, null);
            }
            return;
        }
        
        const blob = new Blob(window.recordData, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(blob);
        const base64Video = await this.blobToBase64(blob);

        // Send data to backend
        await this._saveGazeData(window.gazeData, base64Video);
        
        // Reset chunks
        this.recordedChunks = [];
        console.log("Recording saved.");
    }

    /**
     * Save gaze data and video
     * @param {Array} gazeData - Gaze data
     * @param {string} videoBase64 - Base64 encoded video
     */
    async _saveGazeData(gazeData, videoBase64) {
        if (!gazeData || gazeData.length === 0) {
            console.warn("No gaze data to save.");
            return;
        }

        try {
            const result = await this.rpcService("/marketing_eyetracking/save_gaze_data", {
                gaze_data: gazeData,
                video_data: videoBase64
            });
            
            console.log("Gaze data and video saved successfully, ID:", result.record_id);
            
            // Notify parent component if callback provided
            if (this.props.onDataSaved) {
                this.props.onDataSaved({
                    recordId: result.record_id,
                    gazeSampleCount: gazeData.length,
                    hasVideo: !!videoBase64
                });
            }
        } catch (error) {
            console.error("Error saving gaze data:", error);
        }
    }

    /**
     * Convert Blob to Base64
     * @param {Blob} blob - Blob data
     * @returns {Promise<string>} - Base64 string
     */
    async blobToBase64(blob) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Take webcam snapshot
     */
    _onWebcamSnapshot() {
        this.state.snapshot = this.takeSnapshot(this.video.el);
    }

    /**
     * Save webcam snapshot
     * @param {Event} ev - Event
     */
    async _onWebcamSave(ev) {
        if (!this.state.snapshot) return;

        // Send snapshot to callback
        await this.onwebcam(this.state.snapshot.split(',')[1], "image/jpeg");
        
        if (this.props.onClickClose) {
            this.props.onClickClose(ev);
        }
    }
    
    /**
     * Cancel operation
     * @param {Event} ev - Event
     */
    _onClickCancel(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.stopVideo();
        
        if (this.props.onClickClose) {
            this.props.onClickClose(ev);
        }
    }
    
    /**
     * Restart calibration
     */
    _onRestartCalibration() {
        if (window.Restart) {
            window.Restart();
            this.state.calibrated = true;
        } else {
            console.error("Restart function not available");
        }
    }
    
    /**
     * Toggle Kalman filter
     */
    _onToggleKalmanFilter() {
        if (window.webgazer && window.webgazer.params) {
            webgazer.applyKalmanFilter(!webgazer.params.applyKalmanFilter);
        }
    }
}

EyeTrackingComponent.template = 'marketing_eyetracking.EyeTrackingComponent';

EyeTrackingComponent.props = {
    onWebcamCallback: { type: Function, optional: true },
    onDataSaved: { type: Function, optional: true },
    onClickClose: { type: Function, optional: true }
};

EyeTrackingComponent.defaultProps = {
    onWebcamCallback: () => { },
    onDataSaved: () => { },
    onClickClose: () => { }
};

export default EyeTrackingComponent;