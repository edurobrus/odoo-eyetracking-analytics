# -*- coding: utf-8 -*-
# Part of Creyox Technologies

from odoo import api, fields, models
from io import BytesIO
import xlsxwriter
import base64


class ResPartnerPurchaseReport(models.TransientModel):
    _name = "res.partner.purchase.wizard"
    _description = "Purchase Report Wizard for Res Partner"

    start_date = fields.Date(string="Start Date:")
    end_date = fields.Date(string="End Date:")

    def action_generate_pdf_report(self):
        partner_id = self.env.context.get("active_ids")
        purchase_ids = self.env["purchase.order"].search(
            [
                ("partner_id", "in", partner_id),
                ("date_order", ">=", self.start_date),
                ("date_order", "<", self.end_date),
            ]
        )
        purchase_lines = self.env["purchase.order.line"].search(
            [("order_id", "in", purchase_ids.ids)]
        )
        products = []
        values = []
        index = 1
        for purchase_line in purchase_lines:
            if purchase_line.product_id.id not in products:
                products.append(purchase_line.product_id.id)
                product_order_lines = purchase_lines.filtered(
                    lambda line: line.product_id.id == purchase_line.product_id.id
                )
                total_qty = sum(product_order_lines.mapped("product_qty"))
                subtotal = sum(product_order_lines.mapped("price_subtotal"))
                purchase_line_data = {
                    "srno": index,
                    "product": purchase_line.product_id.name,
                    "quantity": total_qty,
                    "subtotal": subtotal,
                }
                index += 1
                values.append(purchase_line_data)
                total_quantity = sum([value["quantity"] for value in values])
                total_amount = sum([value["subtotal"] for value in values])
        return self.env.ref(
            "cr_partner_purchase_excel_report.action_report_partner_purchase"
        ).report_action(
            self,
            data={
                "product_lines": values,
                "date_start": self.start_date,
                "date_end": self.end_date,
                "partner": purchase_ids.partner_id.name,
                "q_total": total_quantity,
                "s_total": total_amount,
            },
        )

    def generate_excel_report(self):
        partner_id = self.env.context.get("active_ids")
        purchase_ids = self.env["purchase.order"].search(
            [
                ("partner_id", "in", partner_id),
                ("date_order", ">=", self.start_date),
                ("date_order", "<", self.end_date),
            ]
        )
        purchase_lines = self.env["purchase.order.line"].search(
            [("order_id", "in", purchase_ids.ids)]
        )

        fp = BytesIO()
        file_name = "purchase.xlsx"
        workbook = xlsxwriter.Workbook(fp, {"in_memory": True})
        worksheet = workbook.add_worksheet()
        purchase_line_header = ["SR NO.", "Product", "Quantity", "Sub Total"]
        center_format1 = workbook.add_format(
            {"align": "center", "valign": "vcenter", "bold": True}
        )
        center_format1.set_bg_color("#D3D3D3")
        center_format2 = workbook.add_format(
            {"align": "center", "valign": "vcenter", "bold": True}
        )
        center_format2.set_bg_color("#48AAAD")
        center_format3 = workbook.add_format(
            {"align": "center", "valign": "vcenter", "bold": True}
        )
        date = workbook.add_format(
            {"align": "center", "valign": "vcenter", "bold": True}
        )
        date.set_bg_color("#ADD8E6")
        bold = workbook.add_format({"bold": True})

        values = []
        products = []
        for purchase_line in purchase_lines:
            if purchase_line.product_id.id not in products:
                products.append(purchase_line.product_id.id)
                product_order_lines = purchase_lines.filtered(
                    lambda line: line.product_id.id == purchase_line.product_id.id
                )
                total_qty = sum(product_order_lines.mapped("product_qty"))
                subtotal = sum(product_order_lines.mapped("price_subtotal"))
                purchase_line_data = {
                    "product": purchase_line.product_id.name,
                    "quantity": total_qty,
                    "subtotal": subtotal,
                }
                values.append(purchase_line_data)

        worksheet.merge_range(
            "A1:G3", "Sale Report: %s" % purchase_ids.company_id.name, center_format1
        )
        worksheet.merge_range(
            "A6:F7", "Time Period: %s -- %s" % (self.start_date, self.end_date), date
        )
        worksheet.merge_range("A9:C10", purchase_ids.partner_id.name, center_format2)
        worksheet.write_row(11, 0, purchase_line_header, center_format3)
        worksheet.set_column("A:D", 16)
        row = 12
        index = 1
        for val in values:
            worksheet.write(row, 0, index)
            worksheet.write(row, 1, val.get("product"))
            worksheet.write(row, 2, val.get("quantity"))
            worksheet.write(row, 3, val.get("subtotal"))
            row += 1
            index += 1

        worksheet.write_formula("C16", "{=SUM(C13:C15)}", bold)
        worksheet.write_formula("D16", "{=SUM(D13:C15)}", bold)

        workbook.close()
        attachment_id = self.env["ir.attachment"].create(
            {
                "name": file_name,
                "type": "binary",
                "datas": base64.encodebytes(fp.getvalue()),
                "res_model": self._name,
                "res_id": self.id,
            }
        )
        return {
            "type": "ir.actions.act_url",
            "url": "/web/content/%s/%s/datas/%s"
                   % ("ir.attachment", attachment_id.id, file_name),
            "target": "self",
        }
