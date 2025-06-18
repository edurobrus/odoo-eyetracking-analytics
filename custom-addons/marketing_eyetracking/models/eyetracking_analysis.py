import os
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
        user_login = self.env.user.login
        date_start = vals.get("date_start") or fields.Datetime.now()
        formatted_date = date_start.strftime("%Y-%m-%d_%H-%M-%S")
        unique_name = f"{user_login}_{formatted_date}"
        vals["name"] = unique_name
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
        date_start = fields.Datetime.now()
        date_end = fields.Datetime.now()
        if gaze_points:
            first_point_ts = gaze_points[0].get("timestamp")
            if first_point_ts:
                date_start = datetime.fromisoformat(first_point_ts)
            last_point_ts = gaze_points[-1].get("timestamp")
            if last_point_ts:
                date_end = datetime.fromisoformat(last_point_ts)
        if hasattr(date_start, 'tzinfo') and date_start.tzinfo:
            date_start = date_start.replace(tzinfo=None)
        if hasattr(date_end, 'tzinfo') and date_end.tzinfo:
            date_end = date_end.replace(tzinfo=None)
        record = self.create({"date_start": date_start, "date_end": date_end})
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
            
        # Si existe video_data, se crea el registro de la grabación.
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
