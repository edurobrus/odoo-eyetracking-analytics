# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale.tests.common import TestSaleCommon
from odoo.exceptions import ValidationError
from odoo.tests.common import tagged
from psycopg2 import Error as Psycopg2Error


@tagged('post_install', '-at_install')
class TestSoLineMilestones(TestSaleCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.env['res.config.settings'].create({'group_project_milestone': True}).execute()
        uom_hour = cls.env.ref('uom.product_uom_hour')

        cls.product_delivery_milestones1 = cls.env['product.product'].create({
            'name': "Milestones 1, create project only",
            'standard_price': 15,
            'list_price': 30,
            'type': 'service',
            'invoice_policy': 'delivery',
            'uom_id': uom_hour.id,
            'uom_po_id': uom_hour.id,
            'default_code': 'MILE-DELI4',
            'service_type': 'milestones',
            'service_tracking': 'project_only',
        })
        cls.product_delivery_milestones2 = cls.env['product.product'].create({
            'name': "Milestones 2, create project only",
            'standard_price':20,
            'list_price': 35,
            'type': 'service',
            'invoice_policy': 'delivery',
            'uom_id': uom_hour.id,
            'uom_po_id': uom_hour.id,
            'default_code': 'MILE-DELI4',
            'service_type': 'milestones',
            'service_tracking': 'project_only',
        })
        cls.product_delivery_milestones3 = cls.env['product.product'].create({
            'name': "Milestones 3, create project & task",
            'standard_price': 20,
            'list_price': 35,
            'type': 'service',
            'invoice_policy': 'delivery',
            'uom_id': uom_hour.id,
            'uom_po_id': uom_hour.id,
            'default_code': 'MILE-DELI4',
            'service_type': 'milestones',
            'service_tracking': 'task_in_project',
        })

        cls.sale_order = cls.env['sale.order'].create({
            'partner_id': cls.partner_a.id,
            'partner_invoice_id': cls.partner_a.id,
            'partner_shipping_id': cls.partner_a.id,
        })
        cls.sol1 = cls.env['sale.order.line'].create({
            'product_id': cls.product_delivery_milestones1.id,
            'product_uom_qty': 20,
            'order_id': cls.sale_order.id,
        })
        cls.sol2 = cls.env['sale.order.line'].create({
            'product_id': cls.product_delivery_milestones2.id,
            'product_uom_qty': 30,
            'order_id': cls.sale_order.id,
        })
        cls.sale_order.action_confirm()

        cls.project = cls.sol1.project_id

        cls.milestone1 = cls.env['project.milestone'].create({
            'name': 'Milestone 1',
            'project_id': cls.project.id,
            'is_reached': False,
            'sale_line_id': cls.sol1.id,
            'quantity_percentage': 0.5,
        })

    def test_reached_milestones_delivered_quantity(self):
        self.milestone2 = self.env['project.milestone'].create({
            'name': 'Milestone 2',
            'project_id': self.project.id,
            'is_reached': False,
            'sale_line_id': self.sol2.id,
            'quantity_percentage': 0.2,
        })
        self.milestone3 = self.env['project.milestone'].create({
            'name': 'Milestone 3',
            'project_id': self.project.id,
            'is_reached': False,
            'sale_line_id': self.sol2.id,
            'quantity_percentage': 0.4,
        })

        self.assertEqual(self.sol1.qty_delivered, 0.0, "Delivered quantity should start at 0")
        self.assertEqual(self.sol2.qty_delivered, 0.0, "Delivered quantity should start at 0")

        self.milestone1.is_reached = True
        self.assertEqual(self.sol1.qty_delivered, 10.0, "Delivered quantity should update after a milestone is reached")

        self.milestone2.is_reached = True
        self.assertEqual(self.sol2.qty_delivered, 6.0, "Delivered quantity should update after a milestone is reached")

        self.milestone3.is_reached = True
        self.assertEqual(self.sol2.qty_delivered, 18.0, "Delivered quantity should update after a milestone is reached")

    def test_update_reached_milestone_quantity(self):
        self.milestone1.is_reached = True
        self.assertEqual(self.sol1.qty_delivered, 10.0, "Delivered quantity should start at 10")

        self.milestone1.quantity_percentage = 0.75
        self.assertEqual(self.sol1.qty_delivered, 15.0, "Delivered quantity should update after a milestone's quantity is updated")

    def test_remove_reached_milestone(self):
        self.milestone1.is_reached = True
        self.assertEqual(self.sol1.qty_delivered, 10.0, "Delivered quantity should start at 10")

        self.milestone1.unlink()
        self.assertEqual(self.sol1.qty_delivered, 0.0, "Delivered quantity should update when a milestone is removed")

    def test_compute_sale_line_in_task(self):
        task = self.env['project.task'].create({
            'name': 'Test Task',
            'project_id': self.project.id,
        })
        self.assertEqual(task.sale_line_id, self.sol1, 'The task should have the one of the project linked')
        self.project.sale_line_id = False
        task.sale_line_id = False
        self.assertFalse(task.sale_line_id)
        task.write({'milestone_id': self.milestone1.id})
        self.assertEqual(task.sale_line_id, self.milestone1.sale_line_id, 'The task should have the SOL from the milestone.')
        self.project.sale_line_id = self.sol2
        self.assertEqual(task.sale_line_id, self.sol1, 'The task should keep the SOL linked to the milestone.')

    def test_create_milestone_on_project_set_on_sales_order(self):
        """
        Regression Test:
        If we confirm an SO with a service with a delivery based on milestones,
        that creates both a project & task, and we set a project on the SO,
        the project for the milestone should be the one set on the SO,
        and no ValidationError or NotNullViolation should be raised.
        """
        project = self.env['project.project'].create({
            'name': 'Test Project For Milestones',
            'partner_id': self.partner_a.id
        })
        sale_order = self.env['sale.order'].create({
            'partner_id': self.partner_a.id,
            'partner_invoice_id': self.partner_a.id,
            'partner_shipping_id': self.partner_a.id,
            'project_id': project.id,  # the user set a project on the SO
        })
        self.env['sale.order.line'].create({
            'product_id': self.product_delivery_milestones3.id,
            'product_uom_qty': 20,
            'order_id': sale_order.id,
        })
        try:
            sale_order.action_confirm()
        except ValidationError:
            self.fail("The sale order should be confirmed, "
                    "and no ValidationError should be raised, "
                    "for a missing project on the milestone.")
        except Psycopg2Error as e:
            # Check if the error is a NOT NULL violation
            NotNullViolationPgCode = '23502'
            if e.pgcode == NotNullViolationPgCode:
                self.fail("The sale order should be confirmed, "
                        "and no NotNullViolation should be raised, "
                        "for a missing project on the milestone.")
            else:
                # Re-raise any other unexpected database error
                raise
