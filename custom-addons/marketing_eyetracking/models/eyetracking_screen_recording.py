from odoo import models, fields, api


class EyetrackingScreenRecording(models.Model):
    _name = "eyetracking.screen.recording"
    _description = "Grabaciones de Pantalla de EyeTracking"

    analysis_id = fields.Many2one(
        "eyetracking.analysis", string="Análisis", required=True, ondelete="cascade"
    )
    video = fields.Binary("Video", required=True)
    filename = fields.Char("Nombre del Archivo", required=True)
    date = fields.Datetime("Fecha de Grabación", default=fields.Datetime.now)
    str_video = fields.Text("String Video")
    video_html = fields.Html(
        "Video Preview", compute="_compute_video_html", sanitize=False
    )

    @api.depends("str_video")
    def _compute_video_html(self):
        for rec in self:
            if rec.str_video:
                video_base64 = rec.str_video.strip()
                if video_base64.startswith("b'"):
                    video_base64 = video_base64[2:-1]
                rec.video_html = f"""
                    <video width="640" height="360" controls>
                        <source src="data:video/mp4;base64,{video_base64}" type="video/mp4">
                        Tu navegador no soporta el video.
                    </video>
                """
            else:
                rec.video_html = "<p>No hay video disponible.</p>"
