from odoo import models, fields


class EyetrackingAnalysis(models.Model):
    _name = 'eyetracking.analysis'
    _description = 'Análisis de EyeTracking'

    name = fields.Char('Name')
    date_start = fields.Datetime('Start Date')
    date_end = fields.Datetime('End Date')
    image = fields.Binary('Image', attachment=True)
