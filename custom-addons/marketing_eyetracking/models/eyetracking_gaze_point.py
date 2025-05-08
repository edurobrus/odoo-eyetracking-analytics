from odoo import models, fields


class EyetrackingGazePoint(models.Model):
    _name = "eyetracking.gaze.point"
    _description = "Puntos de Seguimiento Ocular"

    analysis_id = fields.Many2one(
        "eyetracking.analysis", 
        string="Análisis",
        ondelete="cascade",
        required=True
    )
    x = fields.Float("Coordenada X")
    y = fields.Float("Coordenada Y")
    timestamp = fields.Datetime("Fecha y Hora")
