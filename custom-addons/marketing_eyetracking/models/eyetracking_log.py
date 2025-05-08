from odoo import models, fields


class EyetrackingLog(models.Model):
    _name = "eyetracking.log"
    _description = "Registro de Logs de EyeTracking"
    _order = "timestamp desc"
    text = fields.Text("Mensaje Completo")
    timestamp = fields.Datetime("Fecha y Hora")
    analysis_id = fields.Many2one(
        "eyetracking.analysis", string="Análisis", ondelete="cascade"
    )
