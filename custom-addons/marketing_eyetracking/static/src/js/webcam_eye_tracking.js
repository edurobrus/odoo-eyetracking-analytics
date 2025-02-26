/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { useRef, useState, onMounted, onWillUnmount } from "@odoo/owl";

export class WebcamEyeTrackingDialog extends Component {
    setup() {
        this.video = useRef("video");
        this.eyeTrackingCanvas = useRef("eyeTrackingCanvas");
        this.selectCamera = useRef("selectCamera");
        this.saveButton = useRef("saveButton");
        
        this.state = useState({
            snapshot: false,
            deviceId: false,
            devices: [],
            eyeTrackingEnabled: false,
            isCalibrated: false,
            showCalibration: false,
            accuracy: null,
            webgazer: null,
        });
        
        onMounted(this.onMounted);
        onWillUnmount(this.onWillUnmount);
    }
    
    onMounted() {
        this._getDevices();
        this._loadWebGazerScripts();
    }
    
    onWillUnmount() {
        if (this.state.eyeTrackingEnabled && this.state.webgazer) {
            this.state.webgazer.pause();
            this.state.webgazer.end();
        }
    }
    
    async _loadWebGazerScripts() {
        // Check if webgazer is already loaded
        if (window.webgazer) {
            this.state.webgazer = window.webgazer;
            return;
        }
        
        // This would typically be handled by Odoo's asset loading system
        // For demonstration purposes, we're showing how you would initialize it
        console.log("WebGazer scripts would be loaded here");
    }
    
    async _toggleEyeTracking() {
        if (this.state.eyeTrackingEnabled) {
            // Disable eye tracking
            if (this.state.webgazer) {
                this.state.webgazer.pause();
                this.state.eyeTrackingEnabled = false;
                this.state.showCalibration = false;
            }
        } else {
            // Enable eye tracking
            if (!this.state.webgazer && window.webgazer) {
                this.state.webgazer = window.webgazer;
            }
            
            if (this.state.webgazer) {
                // Set up WebGazer
                this.state.webgazer.setGazeListener((data, elapsedTime) => {
                    if (data && this.eyeTrackingCanvas.el) {
                        this._drawGazePrediction(data.x, data.y);
                    }
                })
                .begin()
                .showVideoPreview(false) // Hide default video preview
                .showPredictionPoints(true) // Show prediction points
                .applyKalmanFilter(true); // Apply Kalman filter for smoother predictions
                
                this._setupCanvas();
                this.state.eyeTrackingEnabled = true;
            } else {
                // Show error or notification that WebGazer couldn't be loaded
                this.notification.add(_t("Eye tracking library could not be loaded"), {
                    type: "warning",
                });
            }
        }
    }
    
    _setupCanvas() {
        if (this.eyeTrackingCanvas.el && this.video.el) {
            const videoRect = this.video.el.getBoundingClientRect();
            this.eyeTrackingCanvas.el.width = videoRect.width;
            this.eyeTrackingCanvas.el.height = videoRect.height;
        }
    }
    
    _drawGazePrediction(x, y) {
        if (!this.eyeTrackingCanvas.el) return;
        
        const canvas = this.eyeTrackingCanvas.el;
        const context = canvas.getContext('2d');
        
        // Clear the canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw prediction point
        context.beginPath();
        context.arc(x, y, 10, 0, 2 * Math.PI);
        context.fillStyle = 'red';
        context.fill();
        
        // Draw outer ring for visibility
        context.beginPath();
        context.arc(x, y, 15, 0, 2 * Math.PI);
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.stroke();
    }
    
    _calibrateEyeTracking() {
        if (!this.state.eyeTrackingEnabled || !this.state.webgazer) return;
        
        // Show calibration overlay
        this.state.showCalibration = true;
        
        // Initialize calibration
        // In a real implementation, you would use the calibration.js functionality from WebGazer
        const calibrationPoints = document.querySelectorAll('.Calibration');
        let pointsCalibrated = 0;
        
        const clickHandler = (e) => {
            const id = e.target.id;
            // This simplified example just counts calibration points
            // The actual implementation would use the webgazer calibration system
            pointsCalibrated++;
            
            if (pointsCalibrated >= 9) {
                // All points calibrated
                this.state.isCalibrated = true;
                this.state.showCalibration = false;
                
                // Calculate accuracy (simplified for this example)
                this.state.accuracy = "95%";
                
                // Remove event listeners
                calibrationPoints.forEach(point => {
                    point.removeEventListener('click', clickHandler);
                });
            }
        };
        
        // Add click handlers to calibration points
        calibrationPoints.forEach(point => {
            point.addEventListener('click', clickHandler);
        });
    }
    
    _toggleKalmanFilter() {
        if (this.state.webgazer) {
            const isEnabled = this.state.webgazer.params.applyKalmanFilter;
            this.state.webgazer.applyKalmanFilter(!isEnabled);
        }
    }
    
    async _getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            this.state.devices = videoDevices;
            
            // Update select options
            if (this.selectCamera.el) {
                videoDevices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || `Camera ${this.selectCamera.el.options.length}`;
                    this.selectCamera.el.add(option);
                });
            }
        } catch (error) {
            console.error('Error getting media devices:', error);
        }
    }
    
    async onChangeDevice(ev) {
        this.state.deviceId = ev.target.value;
        await this._startStream();
    }
    
    async _startStream() {
        if (!this.video.el) return;
        
        try {
            const constraints = {
                video: this.state.deviceId ? { deviceId: { exact: this.state.deviceId } } : true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.el.srcObject = stream;
            
            // If eye tracking is enabled, we need to update WebGazer
            if (this.state.eyeTrackingEnabled && this.state.webgazer) {
                this.state.webgazer.setVideoElement(this.video.el);
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    }
    
    _onWebcamSnapshot() {
        if (!this.video.el) return;
        
        const video = this.video.el;
        const canvas = document.createElement('canvas');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // If eye tracking is enabled, draw gaze data on the snapshot
        if (this.state.eyeTrackingEnabled && this.eyeTrackingCanvas.el) {
            ctx.drawImage(this.eyeTrackingCanvas.el, 0, 0, canvas.width, canvas.height);
        }
        
        this.state.snapshot = canvas.toDataURL('image/jpeg');
    }
    
    async _onWebcamSave() {
        if (!this.state.snapshot) return;
        
        const result = {
            attachment: {
                name: "webcam_snapshot.jpg",
                type: "image/jpeg",
                data: this.state.snapshot.split(',')[1], // Remove data URL prefix
            },
            eyeTrackingData: this.state.eyeTrackingEnabled ? {
                isCalibrated: this.state.isCalibrated,
                accuracy: this.state.accuracy,
            } : null,
        };
        
        this.props.onSave(result);
        this.props.close();
    }
    
    _onClickCancel() {
        this.props.close();
    }
    
    getTitle() {
        return this.props.title || _t("Camera");
    }
    
    getBody() {
        return this.props.body || _t("Take a snapshot or enable eye tracking");
    }
}

WebcamEyeTrackingDialog.template = "marketing_eyetracking.WebcamDialog";
WebcamEyeTrackingDialog.components = { Dialog };
