# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class MarketingEyetracking(http.Controller):
    @http.route('/webcam/start', auth='user', type='http', website=True)
    def start_webcam(self, **kw):
        """Renderiza una página con la vista de la cámara"""
        return request.render("marketing_eyetracking.webcam_view")
