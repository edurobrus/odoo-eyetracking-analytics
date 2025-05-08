from odoo import models, fields


class EyetrackingUserAction(models.Model):
    _name = "eyetracking.user.action"
    _description = "Acciones de Usuario en EyeTracking"

    analysis_id = fields.Many2one(
        "eyetracking.analysis",
        string="Análisis",
        ondelete="cascade",
        required=True
    )
    action_id = fields.Integer("ID de Acción")
    model = fields.Char("Modelo")
    url = fields.Char("URL")
    timestamp = fields.Datetime("Fecha y Hora")
