# -*- coding: utf-8 -*-
import os
from odoo import http
from odoo.http import request
from odoo.modules.module import get_module_path
import base64


class MarketingEyetracking(http.Controller):
    @http.route("/marketing_eyetracking/clear_log", type="json", auth="user")
    def clear_log(self):
        # Get the module path dynamically
        module_path = get_module_path("marketing_eyetracking")
        log_path = os.path.join(module_path, "log", "odoo.log")

        if os.path.exists(log_path):
            open(log_path, "w").close()
            return {"status": "success", "message": "Log borrado"}
        else:
            # Create the log directory if it doesn't exist
            log_dir = os.path.dirname(log_path)
            if not os.path.exists(log_dir):
                os.makedirs(log_dir)
            # Create an empty log file
            open(log_path, "w").close()
            return {"status": "success", "message": "Log creado y borrado"}

    @http.route("/marketing_eyetracking/save_gaze_data", type="json", auth="user")
    def save_gaze_data(self, gaze_data, video_data):
        """
        Guarda los datos de seguimiento ocular y la grabación de pantalla.
        :param gaze_data: Datos de puntos de seguimiento ocular en formato JSON
        :param video_data: Video de la grabación de pantalla en base64
        :return: Un diccionario con el estado de la operación y el ID del registro creado
        """
        try:
            record_id = request.env["eyetracking.analysis"].save_gaze_data(
                gaze_points=gaze_data, video_data=video_data
            )

            return {"status": "success", "record_id": record_id}

        except Exception as e:
            return {"status": "error", "message": str(e)}
