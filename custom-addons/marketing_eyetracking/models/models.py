import os
import json
from odoo import models, fields, api
import re
import pytz
from datetime import datetime


class EyetrackingAnalysis(models.Model):
    _name = "eyetracking.analysis"
    _description = "Análisis de EyeTracking"

    name = fields.Char("User", readonly=True)
    date_start = fields.Datetime("Start Date")
    date_end = fields.Datetime("End Date")
    image = fields.Binary("Image", attachment=True)
    log_content = fields.Text("Log Content")
    user_action_ids = fields.One2many(
        "eyetracking.user.action", "analysis_id", string="User Actions"
    )
    gaze_point_ids = fields.One2many(
        "eyetracking.gaze.point", "analysis_id", string="Gaze Points"
    )

    @api.model
    def extract_models_from_log(self, log_content):
        """Extrae los modelos desde el contenido del log buscando URLs que incluyen /call_kw."""
        # Buscamos los modelos que están siendo llamados en las URLs
        pattern = re.findall(
            r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+\s+[^\"]+\"(?:POST|GET) /web/dataset/call_kw/([a-zA-Z0-9_.]+)",
            log_content,
        )

        # El patrón devuelve una lista de tuplas (fecha y hora, modelo)
        return pattern

    @api.model
    def create_user_actions(self):
        """Crea registros de acciones de usuario basándose en los modelos extraídos del log"""
        log_path = os.path.join(os.path.dirname(__file__), "../log/odoo.log")
        log_content = ""

        # Leer el contenido del archivo de log
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as log_file:
                log_content = log_file.read()

        # Extraemos los modelos del log
        models_from_log = self.extract_models_from_log(log_content)

        user_actions = []
        base_url = self.env["ir.config_parameter"].sudo().get_param("web.base.url")

        # Para cada modelo encontrado, creamos un diccionario con la información
        for fecha, model_name in models_from_log:
            # Buscamos la acción asociada al modelo en ir.actions.act_window
            action = self.env["ir.actions.act_window"].search(
                [("res_model", "=", model_name)], limit=1
            )
            fecha = fields.Datetime.from_string(fecha)

            if action:
                # Construimos la URL de la acción
                action_url = f"{base_url}/web?#action={action.id}&model={model_name}"
                user_actions.append(
                    {
                        "action_id": action.id,
                        "model": model_name,
                        "url": action_url,
                        "timestamp": fecha,
                    }
                )

        return user_actions

    @api.model
    def create(self, vals):
        log_path = os.path.join(os.path.dirname(__file__), "../log/odoo.log")

        # Leer el contenido del log
        log_content = ""
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as log_file:
                log_content = log_file.read()

        vals["name"] = self.env.user.login
        vals["log_content"] = log_content

        # Crear el registro principal
        record = super(EyetrackingAnalysis, self).create(vals)

        # Crear las acciones de usuario relacionadas
        user_actions = self.create_user_actions()
        for action in user_actions:
            action["analysis_id"] = record.id
            self.env["eyetracking.user.action"].create(action)

        # Borrar el contenido del log después de guardar
        if os.path.exists(log_path):
            open(log_path, "w").close()

        return record

    @api.model
    def save_gaze_data(self, gaze_points):
        log_path = os.path.join(os.path.dirname(__file__), "../log/odoo.log")
        date_start = (
            fields.Datetime.now()
        )  # Valor por defecto si no se encuentra en el log
        date_end = fields.Datetime.now()  # Valor por defecto para date_end

        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as log_file:
                first_line = log_file.readline().strip()  # Leer la primera línea

                # Expresión regular para extraer fecha y hora (YYYY-MM-DD HH:MM:SS)
                match = re.search(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", first_line)
                if match:
                    # Extraer la fecha y hora como string
                    log_datetime_str = match.group(1)

                    # Convertir a un objeto datetime
                    date_start = datetime.strptime(
                        log_datetime_str, "%Y-%m-%d %H:%M:%S"
                    )

                    # Convertir la hora a UTC (y asegurarse que no haya zona horaria añadida)
                    date_start = pytz.UTC.localize(date_start)  # Convertimos a UTC
                    date_start = date_start.astimezone(
                        pytz.UTC
                    )  # Aseguramos que esté en UTC

        # Convertir la hora actual (date_end) a UTC
        date_end = fields.Datetime.now().astimezone(pytz.UTC)

        # Hacer que ambas fechas sean naive (sin zona horaria)
        date_start = date_start.replace(tzinfo=None)
        date_end = date_end.replace(tzinfo=None)

        # Crear el registro principal
        record = self.create(
            {
                "date_start": date_start,
                "date_end": date_end
            }
        )

        # Crear los puntos de seguimiento ocular relacionados
        for point in gaze_points:
            self.env["eyetracking.gaze.point"].create(
                {
                    "analysis_id": record.id,
                    "x": point.get("x", 0),
                    "y": point.get("y", 0),
                    "timestamp": (
                        datetime.fromisoformat(point.get("timestamp"))
                        if "timestamp" in point
                        else fields.Datetime.now()
                    ),
                }
            )

        return record.id


class EyetrackingUserAction(models.Model):
    _name = "eyetracking.user.action"
    _description = "Acciones de Usuario en EyeTracking"

    analysis_id = fields.Many2one(
        "eyetracking.analysis", string="Análisis", ondelete="cascade", required=True
    )
    action_id = fields.Integer("ID de Acción")
    model = fields.Char("Modelo")
    url = fields.Char("URL")
    timestamp = fields.Datetime("Fecha y Hora")


class EyetrackingGazePoint(models.Model):
    _name = "eyetracking.gaze.point"
    _description = "Puntos de Seguimiento Ocular"

    analysis_id = fields.Many2one(
        "eyetracking.analysis", string="Análisis", ondelete="cascade", required=True
    )
    x = fields.Float("Coordenada X")
    y = fields.Float("Coordenada Y")
    timestamp = fields.Datetime("Fecha y Hora")
