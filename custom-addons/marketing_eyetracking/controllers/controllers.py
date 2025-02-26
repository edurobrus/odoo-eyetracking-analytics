# -*- coding: utf-8 -*-
# from odoo import http


# class MarketingEyetracking(http.Controller):
#     @http.route('/marketing_eyetracking/marketing_eyetracking', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/marketing_eyetracking/marketing_eyetracking/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('marketing_eyetracking.listing', {
#             'root': '/marketing_eyetracking/marketing_eyetracking',
#             'objects': http.request.env['marketing_eyetracking.marketing_eyetracking'].search([]),
#         })

#     @http.route('/marketing_eyetracking/marketing_eyetracking/objects/<model("marketing_eyetracking.marketing_eyetracking"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('marketing_eyetracking.object', {
#             'object': obj
#         })
