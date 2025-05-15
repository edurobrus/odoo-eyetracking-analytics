/** @odoo-module */
import { registry } from "@web/core/registry";
import { Component, useState, onMounted } from "@odoo/owl";
import { EyeTrackingComponent } from "./eye_tracking_component";
// Import the service if the ClientAction itself needed to interact with it directly
// import { eyeTrackingService } from './eye_tracking_service';

/**
 * Web Dialog Client Action
 *
 * This client action renders the EyeTrackingComponent.
 * The persistent eye tracking logic is now managed by the eye_tracking_service.
 */
class WebDialogClientAction extends Component {
    setup() {
        super.setup();
        this.state = useState({
            eyeTrackingData: null, // This might only be updated via service notifications now
            webcamSnapshot: null, // Still managed by component and passed up
        });

        onMounted(() => {
            console.log("WebDialogClientAction mounted.");
            // The EyeTrackingComponent manages its own interaction with the service buttons
        });
         // No need for onWillUnmount cleanup related to tracking here, the service is persistent
    }

    /**
     * Handle eye tracking data saved (This might be redundant if service notifies globally)
     * @param {Object} data - The saved data (passed by EyeTrackingComponent if it still uses this prop)
     */
    onEyeTrackingSaved(data) {
        console.log("WebDialogClientAction received saved eye tracking data (via component callback):", data);
        this.state.eyeTrackingData = data;
        // Note: The service now also notifies via Odoo's notification service.
        // You can keep this if the parent component needs specific data updates.
    }

    /**
     * Handle webcam snapshot saved (called by EyeTrackingComponent via onWebcamCallback prop)
     * @param {string} base64 - Base64 encoded image (data part)
     * @param {string} mimetype - MIME type
     */
    onWebcamCallback(base64, mimetype) {
        console.log("WebDialogClientAction received webcam snapshot.");
        this.state.webcamSnapshot = `data:${mimetype};base64,${base64}`;
         // You could add logic here to save the snapshot to Odoo if needed
    }

     /**
      * Handle close request from the component.
      */
     onClickCloseComponent(ev) {
         console.log("WebDialogClientAction received close request.");
         // Implement logic to close the dialog or action here
         // e.g., this.env.services.action.doAction({ type: 'ir.actions.act_window_close' });
         // Or if embedded, hide the component: this.state.showComponent = false;
     }
}

WebDialogClientAction.template = "marketing_eyetracking.WebDialogClientAction";
WebDialogClientAction.components = { EyeTrackingComponent }; // Declare the child component

// Register the client action
registry.category("actions").add("owl.web_dialog", WebDialogClientAction);