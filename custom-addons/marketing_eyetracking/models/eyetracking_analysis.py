import os
from odoo import models, fields, api
import re
import pytz
from datetime import datetime
import base64


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
    log_lines_ids = fields.One2many(
        "eyetracking.log", "analysis_id", string="Log Lines"
    )
    screen_recording_ids = fields.One2many(
        "eyetracking.screen.recording", "analysis_id", string="Grabaciones de Pantalla"
    )

    @api.model
    def extract_models_from_log(self, log_content):
        pattern = re.findall(
            r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+\s+[^\"]+\"(?:POST|GET) /web/dataset/call_kw/([a-zA-Z0-9_.]+)/([a-z_]+)",
            log_content,
        )
        return [
            (fecha, model_name, "list" if method == "web_search_read" else "form")
            for fecha, model_name, method in pattern
            if method != "read"
        ]

    @api.model
    def create_user_actions(self):
        log_path = os.path.join(os.path.dirname(__file__), "../log/odoo.log")
        log_content = ""

        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as log_file:
                log_content = log_file.read()
        models_from_log = self.extract_models_from_log(log_content)

        user_actions = []
        base_url = self.env["ir.config_parameter"].sudo().get_param("web.base.url")

        for fecha, model_name, view_type in models_from_log:
            action = self.env["ir.actions.act_window"].search(
                [("res_model", "=", model_name)], limit=1
            )
            fecha = fields.Datetime.from_string(fecha)

            if action:
                action_url = f"{base_url}/web?#action={action.id}&model={model_name}&view_type={view_type}"
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
    def create_log_lines(self):
        log_path = os.path.join(os.path.dirname(__file__), "../log/odoo.log")
        log_lines = []

        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as log_file:
                for line in log_file:
                    match = re.search(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", line)
                    if match:
                        log_datetime_str = match.group(1)

                        timestamp = datetime.strptime(
                            log_datetime_str, "%Y-%m-%d %H:%M:%S"
                        )

                        first_space_index = line.find(" ")
                        log_text_part = line[first_space_index:].strip()
                        log_text_clean = re.sub(
                            r"\[\d{2}/\w{3}/\d{4} \d{2}:\d{2}:\d{2}\]",
                            "",
                            log_text_part,
                        ).strip()
                        second_space_index = log_text_clean.find(" ")
                        log_text = log_text_clean[second_space_index:].strip()

                        log_lines.append({"timestamp": timestamp, "text": log_text})

        return log_lines

    @api.model
    def create(self, vals):
        log_path = os.path.join(os.path.dirname(__file__), "../log/odoo.log")
        log_content = ""
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as log_file:
                log_content = log_file.read()

        vals["name"] = self.env.user.login
        vals["log_content"] = log_content
        record = super(EyetrackingAnalysis, self).create(vals)
        user_actions = self.create_user_actions()

        for action in user_actions:
            action["analysis_id"] = record.id
            self.env["eyetracking.user.action"].create(action)
        log_lines = self.create_log_lines()

        for log_entry in log_lines:
            log_entry["analysis_id"] = record.id
            self.env["eyetracking.log"].create(log_entry)
        if os.path.exists(log_path):
            open(log_path, "w").close()

        return record

    @api.model
    def save_gaze_data(self, gaze_points, video_data):
        log_path = os.path.join(os.path.dirname(__file__), "../log/odoo.log")
        date_start = fields.Datetime.now()
        date_end = fields.Datetime.now()

        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as log_file:
                first_line = log_file.readline().strip()
                match = re.search(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", first_line)
                if match:
                    log_datetime_str = match.group(1)
                    date_start = datetime.strptime(
                        log_datetime_str, "%Y-%m-%d %H:%M:%S"
                    )
                    date_start = pytz.UTC.localize(date_start)
                    date_start = date_start.astimezone(pytz.UTC)

        date_end = fields.Datetime.now().astimezone(pytz.UTC)
        date_start = date_start.replace(tzinfo=None)
        date_end = date_end.replace(tzinfo=None)
        record = self.create({"date_start": date_start, "date_end": date_end})

        video_filename = fields.Datetime.now().strftime("%Y%m%d%H%M%S") + ".mp4"

        static_path = os.path.join(os.path.dirname(__file__), "..", "static", "videos")
        if not os.path.exists(static_path):
            os.makedirs(static_path)
        video_file_path = os.path.join(static_path, video_filename)
        with open(video_file_path, "wb") as f:
            f.write(base64.b64decode(video_data))
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
        if video_data:
            self.env["eyetracking.screen.recording"].create(
                {
                    "analysis_id": record.id,
                    "video": video_data,
                    "str_video": video_data,
                    "filename": fields.Datetime.now().strftime("%Y%m%d%H%M%S") + ".mp4",
                    "date": fields.Datetime.now(),
                }
            )

        return record.id
