from odoo import models, fields


class EyeTrackingSession(models.Model):
    _name = 'eyetracking.session'
    _description = 'Eye Tracking Session'

    name = fields.Char(string='Session Name', required=True)
    analysis_id = fields.Many2one('eyetracking.analysis',
                                  string='Related Analysis',
                                  ondelete='cascade')
    duration = fields.Float(string='Duration (seconds)')
    participant_count = fields.Integer(string='Number of Participants')
