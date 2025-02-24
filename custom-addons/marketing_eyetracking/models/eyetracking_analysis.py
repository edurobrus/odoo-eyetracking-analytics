from odoo import models, fields, api


class EyeTrackingAnalysis(models.Model):
    _name = "eyetracking.analysis"
    _description = "Eye Tracking Analysis"

    name = fields.Char(string="Analysis Name", required=True, tracking=True)
    date_start = fields.Datetime(string="Start Time", tracking=True)
    date_end = fields.Datetime(string="End Time", tracking=True)

    @api.model
    def action_open_webcam(self):
        return {
            'type': 'ir.actions.client',
            'tag': 'marketing_eyetracking.WebcamDialog',
        }

