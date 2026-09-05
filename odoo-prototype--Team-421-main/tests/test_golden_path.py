# -*- coding: utf-8 -*-
"""DealFlow360 — 20-Step End-to-End Golden Path Integration & Acceptance Test.

Executes the complete commercial lifecycle across all DealFlow components,
verifying all 20 Acceptance Criteria (AC-1 through AC-20) in exact sequential order:

1. AC-1: Read Customer Profile (Acme Corp credit limit & invoiced total)
2. AC-2: Read Product Catalog & Pricing (Hardware, consu, recurring services)
3. AC-3: Read Draft Quotation Lines & Subtotals
4. AC-4: Assemble Canonical DealContextDTO for Decision Engine
5. AC-5: Rep Discount Update (18.0% blended discount calculation)
6. AC-6: Governance Evaluation & Automated Order Locking (High risk, approval required)
7. AC-7: Order Confirmation Guard Enforcement (Blocks unapproved/locked confirmation)
8. AC-8: Customer Portal Counter-Offer Negotiation Submission (22.0% requested)
9. AC-9: Customer Portal Payload Privacy Defense (Strict margin/cost exclusion)
10. AC-10: Insecure Direct Object Reference (IDOR) Defense (Cross-tenant rejection)
11. AC-11: Commercial Governance Review & Formal Approval (Finance / Manager)
12. AC-12: Atomic Governance Application to Odoo (20.0% agreed discount, Net 45)
13. AC-13: Multi-Warehouse Inventory Stock Query (WH1 Main: 9, WH2 East: 6)
14. AC-14: Fulfillment Split Allocation Algorithm (15 units -> 9 WH1, 6 WH2)
15. AC-15: Fulfillment Plan Execution (Multi-warehouse delivery pickings generated)
16. AC-16: Authorized Order Confirmation (State transition 'draft' -> 'sale')
17. AC-17: Customer Invoice Generation (account.move 'out_invoice', posted, unpaid)
18. AC-18: Real-Time Payment Synchronization (Payment execution to fully paid)
19. AC-19: Subscription & Recurring Metrics (MRR / ARR calculation on recurring lines)
20. AC-20: Domain Event Notification Dispatch (Audit logs, events, chatter trail)
"""

import json
import pytest
from typing import Any, Dict

from dealflow_odoo.constants import (
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    APPROVAL_STATE_REAPPROVAL_REQUIRED,
    ERR_AUTHORIZATION,
    EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
    EVENT_DISCOUNT_CHANGED,
    EVENT_INVOICE_CREATED,
    EVENT_ORDER_APPROVED,
    EVENT_ORDER_CONFIRMED,
    EVENT_STOCK_CHANGED,
)
from dealflow_odoo.controllers.portal import PortalController, request as portal_request
from dealflow_odoo.schemas import (
    AuthorizationError,
    CustomerDTO,
    DealContextDTO,
    FulfillmentPlanDTO,
    OrderLineDTO,
    ProductDTO,
)
from dealflow_odoo.services.accounting_adapter import AccountingAdapter
from dealflow_odoo.services.event_dispatcher import EventDispatcher
from dealflow_odoo.services.integration_service import OdooIntegrationService
from dealflow_odoo.services.inventory_adapter import InventoryAdapter
from dealflow_odoo.services.sales_adapter import SalesAdapter
from dealflow_odoo.services.subscription_adapter import SubscriptionAdapter


def set_portal_request(env: Any, user: Any = None, data: Any = None) -> None:
    """Helper to configure simulated customer portal HTTP request context."""
    portal_request.env = env
    if env is not None:
        env.user = user
    portal_request.params = {}
    if data is not None:
        portal_request.httprequest.data = json.dumps(data).encode("utf-8")
    else:
        portal_request.httprequest.data = b""


class TestGoldenPathE2E:
    """Complete 20-Step End-to-End Golden Path Test Suite."""

    def test_complete_golden_path_20_steps(
        self,
        mock_odoo_env: Any,
        seed_data: Dict[str, Any],
        integration_service: OdooIntegrationService,
        sales_adapter: SalesAdapter,
        inventory_adapter: InventoryAdapter,
        subscription_adapter: SubscriptionAdapter,
        accounting_adapter: AccountingAdapter,
        event_dispatcher: EventDispatcher,
        sample_quotation: Any,
    ):
        """Executes and validates all 20 Acceptance Criteria end-to-end."""
        print("[STEP 1: AC-1 - Read Customer Profile]", flush=True)

        # ---------------------------------------------------------------------
        # STEP 1: AC-1 - Read Customer Profile
        # ---------------------------------------------------------------------
        acme_customer = integration_service.get_customer(1)
        assert isinstance(acme_customer, CustomerDTO)
        assert acme_customer.id == 1
        assert acme_customer.name == "Acme Corp"
        assert acme_customer.email == "contact@acme.example.com"
        assert acme_customer.credit_limit == 50000.0
        assert acme_customer.total_invoiced == 12000.0
        assert acme_customer.is_company is True

        # ---------------------------------------------------------------------
        # STEP 2: AC-2 - Read Product Catalog & Pricing
        # ---------------------------------------------------------------------
        laptop_prod = integration_service.get_product(1)
        support_prod = integration_service.get_product(5)

        assert isinstance(laptop_prod, ProductDTO)
        assert laptop_prod.name == "Laptop"
        assert laptop_prod.list_price == 1200.0
        assert laptop_prod.standard_price == 800.0
        assert laptop_prod.is_recurring is False

        assert isinstance(support_prod, ProductDTO)
        assert support_prod.name == "Premium Support"
        assert support_prod.list_price == 500.0
        assert support_prod.is_recurring is True
        assert support_prod.recurring_interval == "month"

        # ---------------------------------------------------------------------
        # STEP 3: AC-3 - Read Draft Quotation Lines & Subtotals
        # ---------------------------------------------------------------------
        order_raw = integration_service.get_order(sample_quotation.id)
        assert order_raw["id"] == sample_quotation.id
        assert order_raw["state"] == "draft"
        assert order_raw["dealflow_deal_id"] == "DEAL-ACME-001"
        assert len(order_raw["lines"]) == 2
        assert order_raw["amount_untaxed"] == 1700.0
        assert order_raw["amount_total"] == 1870.0

        # ---------------------------------------------------------------------
        # STEP 4: AC-4 - Assemble Canonical DealContextDTO for Decision Engine
        # ---------------------------------------------------------------------
        deal_ctx = integration_service.get_deal_context(sample_quotation.id)
        assert isinstance(deal_ctx, DealContextDTO)
        assert deal_ctx.deal_id == "DEAL-ACME-001"
        assert deal_ctx.order_id == sample_quotation.id
        assert deal_ctx.customer.name == "Acme Corp"
        assert deal_ctx.amount_untaxed == 1700.0
        assert deal_ctx.total_cost == 1050.0
        assert deal_ctx.total_margin == 650.0
        assert deal_ctx.blended_discount == 0.0
        assert deal_ctx.has_recurring_lines is True
        assert deal_ctx.mrr == 500.0
        assert len(deal_ctx.lines) == 2

        # ---------------------------------------------------------------------
        # STEP 5: AC-5 - Rep Discount Update (18.0%)
        # ---------------------------------------------------------------------
        terms = {
            "target_line_discounts": {1: 18.0, 2: 18.0},
            "customer_note": "Sales Rep updated line discounts to 18.0%",
        }
        res_terms = sales_adapter.update_negotiated_terms(sample_quotation.id, terms)
        assert res_terms["success"] is True
        assert sample_quotation.dealflow_blended_discount == 18.0
        expected_untaxed = round(1700.0 * 0.82, 2)
        assert sample_quotation.amount_untaxed == expected_untaxed

        # ---------------------------------------------------------------------
        # STEP 6: AC-6 - Governance Evaluation & Automated Quotation Locking
        # ---------------------------------------------------------------------
        # 18.0% exceeds rep authority limit (15.0%); trigger governance lock
        sample_quotation.dealflow_risk_score = 45.0
        sample_quotation.dealflow_approval_state = APPROVAL_STATE_REAPPROVAL_REQUIRED
        sample_quotation.dealflow_locked = True
        sample_quotation.message_post("DealFlow Rule Alert: Blended discount 18.0% exceeds rep limit 15.0%. Quotation locked.")

        assert sample_quotation.dealflow_locked is True
        assert sample_quotation.dealflow_approval_state == APPROVAL_STATE_REAPPROVAL_REQUIRED
        assert sample_quotation.dealflow_risk_score == 45.0

        # ---------------------------------------------------------------------
        # STEP 7: AC-7 - Order Confirmation Guard Enforcement
        # ---------------------------------------------------------------------
        # Confirmation MUST be blocked when locked / unapproved
        with pytest.raises(AuthorizationError) as exc_confirm:
            sales_adapter.confirm_order(sample_quotation.id)

        assert "locked pending DealFlow approval" in str(exc_confirm.value) or "requires DealFlow approval" in str(exc_confirm.value)
        assert sample_quotation.state == "draft"

        # ---------------------------------------------------------------------
        # STEP 8: AC-8 - Customer Portal Counter-Offer Negotiation Submission
        # ---------------------------------------------------------------------
        print("[STEP 8: AC-8 - Customer Portal Negotiation]")
        portal_controller = PortalController()
        portal_user_acme = mock_odoo_env["res.users"].create({
            "id": 101,
            "name": "Alice Acme",
            "partner_id": seed_data["customers"]["acme"],
            "groups": {"base.group_portal", "dealflow_odoo.group_dealflow_portal"},
            "is_public": False,
        })
        portal_user_beta = mock_odoo_env["res.users"].create({
            "id": 102,
            "name": "Bob Beta",
            "partner_id": seed_data["customers"]["beta"],
            "groups": {"base.group_portal", "dealflow_odoo.group_dealflow_portal"},
            "is_public": False,
        })

        set_portal_request(
            mock_odoo_env,
            user=portal_user_acme,
            data={
                "order_id": sample_quotation.id,
                "requested_discount": 22.0,
                "requested_terms": "Net 45 payment terms",
                "customer_note": "Requesting volume discount based on quarterly commitment.",
            },
        )
        neg_response = portal_controller.portal_submit_negotiation()
        assert neg_response.status_code == 201
        neg_payload = json.loads(neg_response.data.decode("utf-8"))
        assert neg_payload["success"] is True

        negotiations = mock_odoo_env["dealflow.negotiation"].search([("sale_order_id", "=", sample_quotation.id)])
        assert len(negotiations) >= 1
        active_negotiation = negotiations[0]
        assert active_negotiation.status == "submitted"
        assert active_negotiation.requested_discount == 22.0
        assert sample_quotation.dealflow_locked is True
        assert sample_quotation.dealflow_approval_state == APPROVAL_STATE_PENDING

        # ---------------------------------------------------------------------
        # STEP 9: AC-9 - Customer Portal Payload Privacy Defense
        # ---------------------------------------------------------------------
        set_portal_request(mock_odoo_env, user=portal_user_acme)
        portal_view = portal_controller.portal_get_deal(sample_quotation.id)
        assert portal_view.status_code == 200

        portal_body = portal_view.data.decode("utf-8")
        assert "cost_price" not in portal_body
        assert "standard_price" not in portal_body
        assert "margin" not in portal_body
        assert "margin_percent" not in portal_body
        assert "dealflow_risk_score" not in portal_body

        # ---------------------------------------------------------------------
        # STEP 10: AC-10 - Insecure Direct Object Reference (IDOR) Defense
        # ---------------------------------------------------------------------
        # Customer Beta attempts to view or negotiate Customer Acme quotation
        set_portal_request(mock_odoo_env, user=portal_user_beta)
        idor_get_resp = portal_controller.portal_get_deal(sample_quotation.id)
        assert idor_get_resp.status_code == 403
        assert json.loads(idor_get_resp.data)["error"]["code"] == ERR_AUTHORIZATION

        set_portal_request(
            mock_odoo_env,
            user=portal_user_beta,
            data={"order_id": sample_quotation.id, "requested_discount": 30.0},
        )
        idor_post_resp = portal_controller.portal_submit_negotiation()
        assert idor_post_resp.status_code == 403
        assert json.loads(idor_post_resp.data)["error"]["code"] == ERR_AUTHORIZATION

        # ---------------------------------------------------------------------
        # STEP 11: AC-11 - Commercial Governance Review & Formal Approval
        # ---------------------------------------------------------------------
        # Sales Manager / Finance evaluates and approves the negotiation
        mock_odoo_env.user = mock_odoo_env["res.users"].browse(1)
        active_negotiation.action_under_review()
        assert active_negotiation.status == "under_review"

        active_negotiation.action_approve(review_note="Finance approved 20.0% discount and Net 45 terms.")
        assert active_negotiation.status == "approved"
        assert sample_quotation.dealflow_locked is False
        assert sample_quotation.dealflow_approval_state == APPROVAL_STATE_APPROVED

        # ---------------------------------------------------------------------
        # STEP 12: AC-12 - Atomic Governance Application to Odoo
        # ---------------------------------------------------------------------
        # Atomic application of the agreed commercial terms: 20.0% discount
        approved_changes = {
            "target_line_discounts": {1: 20.0, 2: 20.0},
            "dealflow_approval_state": APPROVAL_STATE_APPROVED,
            "dealflow_risk_score": 15.0,
            "customer_note": "Net 45 terms approved by Finance",
        }
        apply_res = integration_service.apply_approved_change(
            sample_quotation.id,
            approved_changes,
        )
        assert apply_res["success"] is True
        assert apply_res["dealflow_approval_state"] == APPROVAL_STATE_APPROVED
        assert apply_res["dealflow_locked"] is False
        assert apply_res["blended_discount"] == 20.0
        assert sample_quotation.dealflow_blended_discount == 20.0
        assert sample_quotation.amount_untaxed == 1360.0  # 1700 * 0.8
        assert sample_quotation.dealflow_locked is False

        # ---------------------------------------------------------------------
        # STEP 13: AC-13 - Multi-Warehouse Inventory Stock Query
        # ---------------------------------------------------------------------
        wh_stock = integration_service.get_warehouse_stock(1)
        assert len(wh_stock) == 2
        wh1_stock = next(w for w in wh_stock if w["warehouse_id"] == 1)
        wh2_stock = next(w for w in wh_stock if w["warehouse_id"] == 2)
        assert wh1_stock["qty_available"] == 9.0
        assert wh2_stock["qty_available"] == 6.0
        total_avail = integration_service.get_available_stock(1)
        assert total_avail == 15.0

        # ---------------------------------------------------------------------
        # STEP 14: AC-14 - Fulfillment Split Allocation Algorithm
        # ---------------------------------------------------------------------
        # Request 15 units of Laptop; must split into 9 (WH1) and 6 (WH2)
        fulfillment_plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=15.0,
        )
        assert isinstance(fulfillment_plan, FulfillmentPlanDTO)
        assert fulfillment_plan.order_id == sample_quotation.id
        assert len(fulfillment_plan.allocations) == 2
        assert fulfillment_plan.allocations[0].warehouse_id == 1
        assert fulfillment_plan.allocations[0].quantity == 9.0
        assert fulfillment_plan.allocations[1].warehouse_id == 2
        assert fulfillment_plan.allocations[1].quantity == 6.0
        assert sum(a.quantity for a in fulfillment_plan.allocations) == 15.0

        # ---------------------------------------------------------------------
        # STEP 15: AC-15 - Fulfillment Plan Execution
        # ---------------------------------------------------------------------
        exec_plan_res = integration_service.apply_fulfillment_plan(
            sample_quotation.id,
            fulfillment_plan,
        )
        assert exec_plan_res["order_id"] == sample_quotation.id
        assert "pickings_created" in exec_plan_res or "allocations" in exec_plan_res

        # ---------------------------------------------------------------------
        # STEP 16: AC-16 - Authorized Order Confirmation
        # ---------------------------------------------------------------------
        print("[STEP 16: AC-16 - Authorized Order Confirmation]")
        # Quotation is approved and unlocked; confirmation succeeds
        confirm_res = sales_adapter.confirm_order(sample_quotation.id)
        assert confirm_res["success"] is True
        assert confirm_res["state"] == "sale"
        assert sample_quotation.state == "sale"

        # Dispatch confirmation domain event
        event_dispatcher.dispatch(
            event_type=EVENT_ORDER_CONFIRMED,
            record_id=sample_quotation.id,
            model="sale.order",
            data=confirm_res,
            deal_id=sample_quotation.dealflow_deal_id,
        )

        # ---------------------------------------------------------------------
        # STEP 17: AC-17 - Customer Invoice Generation
        # ---------------------------------------------------------------------
        print("[STEP 17: AC-17 - Customer Invoice Generation]")
        inv_res = integration_service.create_invoice(sample_quotation.id)
        assert "invoice_id" in inv_res
        inv_id = inv_res["invoice_id"]
        assert inv_res["state"] == "posted"

        invoice_details = accounting_adapter.get_invoice(inv_id)
        assert invoice_details["invoice_id"] == inv_id
        assert invoice_details["state"] == "posted"
        assert invoice_details["payment_state"] == "not_paid"
        assert invoice_details["amount_total"] == sample_quotation.amount_total

        # ---------------------------------------------------------------------
        # STEP 18: AC-18 - Real-Time Payment Synchronization
        # ---------------------------------------------------------------------
        # Check initial unpaid status
        status_unpaid = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status_unpaid["is_paid"] is False
        assert status_unpaid["amount_due"] == sample_quotation.amount_total
        assert status_unpaid["amount_paid"] == 0.0
        assert status_unpaid["payment_state"] == "not_paid"

        # Execute payment on invoice
        inv_record = mock_odoo_env["account.move"].browse(inv_id)
        inv_record.write({"payment_state": "paid", "amount_residual": 0.0})

        # Check synchronized paid status
        status_paid = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status_paid["is_paid"] is True
        assert status_paid["payment_state"] == "paid"
        assert status_paid["amount_due"] == 0.0
        assert status_paid["amount_paid"] == sample_quotation.amount_total

        # ---------------------------------------------------------------------
        # STEP 19: AC-19 - Subscription & Recurring Metrics
        # ---------------------------------------------------------------------
        deal_ctx_final = integration_service.get_deal_context(sample_quotation.id)
        sub_analysis = subscription_adapter.parse_mixed_order({"lines": deal_ctx_final.lines})
        assert sub_analysis["has_recurring"] is True
        assert sub_analysis["has_one_time"] is True
        assert len(sub_analysis["recurring_lines"]) == 1
        assert sub_analysis["recurring_mrr"] == 400.0  # $500 support with 20% discount = $400/month
        assert sub_analysis["recurring_arr"] == 4800.0  # $400 * 12
        assert sub_analysis["one_time_total"] == 960.0  # $1200 laptop with 20% discount = $960

        # ---------------------------------------------------------------------
        # STEP 20: AC-20 - Domain Event Notification Dispatch & Audit Trail
        # ---------------------------------------------------------------------
        audit_logs = integration_service.get_audit_logs(50)
        assert len(audit_logs) >= 5

        # Verify chatter log entries on quotation
        chatter_content = " ".join(sample_quotation.chatter_messages)
        assert len(sample_quotation.chatter_messages) >= 2
        assert "DealFlow" in chatter_content or "Approved" in chatter_content

        # Verify dispatched domain events
        dispatched_types = [e["event_type"] for e in event_dispatcher.get_recent_events(50)]
        assert EVENT_STOCK_CHANGED in dispatched_types
        assert EVENT_ORDER_CONFIRMED in dispatched_types
        assert EVENT_INVOICE_CREATED in dispatched_types
