# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Sales & Transaction Integration Adapter.

Provides high-level transactional methods for reading customer/product/order data,
evaluating deal context, applying atomic governance decisions, updating negotiated terms,
and safely confirming orders in Odoo with structured error handling.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

try:
    from odoo import _
except ImportError:
    def _(text): return text

from dealflow_odoo.schemas import (
    DealFlowIntegrationError,
    OdooAccessDenied,
    OdooAccessError,
    OdooMissingError,
    OdooUserError,
    OdooValidationError,
)
UserError = OdooUserError


def _translate_odoo_exception(exc: Exception) -> Exception:
    if isinstance(exc, DealFlowIntegrationError):
        return exc
    if isinstance(exc, OdooValidationError):
        return ValidationError(str(exc))
    if isinstance(exc, (OdooAccessError, OdooAccessDenied)):
        return AuthorizationError(str(exc))
    if isinstance(exc, OdooMissingError):
        return NotFoundError(str(exc))
    if isinstance(exc, OdooUserError):
        msg = str(exc)
        if any(w in msg.lower() for w in ["state", "status", "lock", "draft", "confirm", "approve", "cancel"]):
            return InvalidStateError(msg)
        return OdooExecutionError(msg)
    return OdooExecutionError(str(exc))

try:
    from ..constants import (
        APPROVAL_STATE_APPROVED,
        APPROVAL_STATE_PENDING,
        CATEGORY_DISCOUNT_CEILINGS,
        DEFAULT_FINANCE_DISCOUNT_THRESHOLD,
        DEFAULT_MAX_MGR_DISCOUNT,
        DEFAULT_MAX_REP_DISCOUNT,
        HEALTH_STATUS_AT_RISK,
        HEALTH_STATUS_CRITICAL,
        HEALTH_STATUS_HEALTHY,
    )
    from ..schemas import (
        AuthorizationError,
        CustomerDTO,
        DealContextDTO,
        InvalidStateError,
        NotFoundError,
        OdooExecutionError,
        OrderLineDTO,
        ProductDTO,
        ValidationError,
    )
except (ImportError, ValueError):
    from dealflow_odoo.constants import (
        APPROVAL_STATE_APPROVED,
        APPROVAL_STATE_PENDING,
        CATEGORY_DISCOUNT_CEILINGS,
        DEFAULT_FINANCE_DISCOUNT_THRESHOLD,
        DEFAULT_MAX_MGR_DISCOUNT,
        DEFAULT_MAX_REP_DISCOUNT,
        HEALTH_STATUS_AT_RISK,
        HEALTH_STATUS_CRITICAL,
        HEALTH_STATUS_HEALTHY,
    )
    from dealflow_odoo.schemas import (
        AuthorizationError,
        CustomerDTO,
        DealContextDTO,
        InvalidStateError,
        NotFoundError,
        OdooExecutionError,
        OrderLineDTO,
        ProductDTO,
        ValidationError,
    )

_logger = logging.getLogger(__name__)


class SalesAdapter:
    """Sales & Transaction Integration Adapter for DealFlow360.

    Encapsulates all sales order read/write operations, DealFlow governance hooks,
    customer negotiation adjustments, and confirmation workflows against Odoo.
    """

    def __init__(self, env: Optional[Any] = None) -> None:
        """Initialize adapter with an optional Odoo Environment instance.

        Args:
            env: Active Odoo Environment (api.Environment).
        """
        self.env = env

    def _resolve_env(self, env: Optional[Any] = None) -> Any:
        """Resolve the active Odoo environment or raise a ValidationError."""
        resolved = env or self.env
        if resolved is None:
            raise ValidationError(
                "No active Odoo Environment provided to SalesAdapter. "
                "Pass 'env' in constructor or method invocation."
            )
        return resolved

    def get_customer(self, partner_id: int, env: Optional[Any] = None) -> CustomerDTO:
        """Retrieve customer master data and map to CustomerDTO.

        Args:
            partner_id: ID of the customer (res.partner).
            env: Optional Odoo Environment override.

        Returns:
            CustomerDTO populated with customer details.

        Raises:
            ValidationError: If partner_id is not a positive integer.
            NotFoundError: If partner does not exist.
        """
        if not isinstance(partner_id, int) or partner_id <= 0:
            raise ValidationError(f"Invalid partner_id '{partner_id}'. Must be a positive integer.")

        active_env = self._resolve_env(env)
        try:
            partner = active_env["res.partner"].browse(partner_id)
            if not partner.exists():
                raise NotFoundError(
                    f"Customer with ID {partner_id} not found.",
                    {"partner_id": partner_id},
                )

            country_name = partner.country_id.name if partner.country_id else None
            phone = partner.phone or getattr(partner, "mobile", None)
            credit_limit = float(getattr(partner, "credit_limit", 0.0) or 0.0)
            total_invoiced = float(getattr(partner, "total_invoiced", 0.0) or 0.0)

            return CustomerDTO(
                id=partner.id,
                name=partner.name or "",
                email=partner.email,
                phone=phone,
                credit_limit=credit_limit,
                total_invoiced=total_invoiced,
                is_company=bool(partner.is_company),
                street=partner.street,
                city=partner.city,
                country=country_name,
            )
        except (ValidationError, NotFoundError, OdooValidationError, OdooAccessError, OdooAccessDenied, OdooMissingError, OdooUserError):
            raise
        except Exception as exc:
            _logger.exception("Error in get_customer for partner_id %s: %s", partner_id, exc)
            raise OdooExecutionError(f"Failed to retrieve customer {partner_id}: {exc}", {"partner_id": partner_id})

    def get_product(self, product_id: int, env: Optional[Any] = None) -> ProductDTO:
        """Retrieve product data and map to ProductDTO.

        Args:
            product_id: ID of the product (product.product).
            env: Optional Odoo Environment override.

        Returns:
            ProductDTO populated with pricing, cost, category, and recurring attributes.

        Raises:
            ValidationError: If product_id is not a positive integer.
            NotFoundError: If product does not exist.
        """
        if not isinstance(product_id, int) or product_id <= 0:
            raise ValidationError(f"Invalid product_id '{product_id}'. Must be a positive integer.")

        active_env = self._resolve_env(env)
        try:
            product = active_env["product.product"].browse(product_id)
            if not product.exists():
                raise NotFoundError(
                    f"Product with ID {product_id} not found.",
                    {"product_id": product_id},
                )

            cat_id = product.categ_id.id if product.categ_id else 1
            cat_name = product.categ_id.name if product.categ_id else "All"

            # Detect recurring revenue suitability
            prod_name = (product.name or "").lower()
            combined_desc = f"{prod_name} {cat_name.lower()}"
            is_recurring = bool(
                getattr(product, "dealflow_is_recurring", False)
                or any(t in combined_desc for t in ("recurring", "subscription", "monthly", "annual", "saas"))
            )
            recurring_interval = None
            if is_recurring:
                if "annual" in combined_desc or "year" in combined_desc:
                    recurring_interval = "year"
                else:
                    recurring_interval = "month"

            return ProductDTO(
                id=product.id,
                name=product.name or "",
                default_code=product.default_code,
                list_price=float(product.list_price or 0.0),
                standard_price=float(product.standard_price or 0.0),
                category_id=cat_id,
                category_name=cat_name,
                type=product.type or "consu",
                is_recurring=is_recurring,
                recurring_interval=recurring_interval,
            )
        except (ValidationError, NotFoundError, OdooValidationError, OdooAccessError, OdooAccessDenied, OdooMissingError, OdooUserError):
            raise
        except Exception as exc:
            _logger.exception("Error in get_product for product_id %s: %s", product_id, exc)
            raise OdooExecutionError(f"Failed to retrieve product {product_id}: {exc}", {"product_id": product_id})

    def get_order(self, order_id: int, env: Optional[Any] = None) -> Dict[str, Any]:
        """Retrieve raw dictionary representation of a sale order including DealFlow fields.

        Args:
            order_id: ID of the sale.order record.
            env: Optional Odoo Environment override.

        Returns:
            Dict containing order details, governance status, and lines.

        Raises:
            ValidationError: If order_id is invalid.
            NotFoundError: If order does not exist.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")

        active_env = self._resolve_env(env)
        try:
            order = active_env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found.",
                    {"order_id": order_id},
                )

            lines_data: List[Dict[str, Any]] = []
            for line in order.order_line:
                if line.display_type:
                    continue
                product = line.product_id
                lines_data.append({
                    "id": line.id,
                    "product_id": product.id if product else None,
                    "product_name": product.name if product else (line.name or ""),
                    "product_uom_qty": float(line.product_uom_qty or 0.0),
                    "price_unit": float(line.price_unit or 0.0),
                    "discount": float(line.discount or 0.0),
                    "price_subtotal": float(line.price_subtotal or 0.0),
                    "dealflow_approved_discount": float(getattr(line, "dealflow_approved_discount", 0.0) or 0.0),
                    "dealflow_is_recurring": bool(getattr(line, "dealflow_is_recurring", False)),
                    "dealflow_recurring_interval": getattr(line, "dealflow_recurring_interval", None),
                    "dealflow_cost_price": float(getattr(line, "dealflow_cost_price", 0.0) or 0.0),
                    "dealflow_margin": float(getattr(line, "dealflow_margin", 0.0) or 0.0),
                })

            return {
                "id": order.id,
                "name": order.name,
                "partner_id": order.partner_id.id if order.partner_id else None,
                "partner_name": order.partner_id.name if order.partner_id else None,
                "state": order.state,
                "date_order": str(order.date_order) if order.date_order else None,
                "currency": order.currency_id.name if order.currency_id else "USD",
                "amount_untaxed": float(order.amount_untaxed or 0.0),
                "amount_tax": float(order.amount_tax or 0.0),
                "amount_total": float(order.amount_total or 0.0),
                "dealflow_deal_id": order.dealflow_deal_id,
                "dealflow_risk_score": float(order.dealflow_risk_score or 0.0),
                "dealflow_approval_state": order.dealflow_approval_state,
                "dealflow_health_status": order.dealflow_health_status,
                "dealflow_last_evaluated_at": str(order.dealflow_last_evaluated_at) if order.dealflow_last_evaluated_at else None,
                "dealflow_locked": bool(order.dealflow_locked),
                "dealflow_blended_discount": float(order.dealflow_blended_discount or 0.0),
                "lines": lines_data,
            }
        except (ValidationError, NotFoundError, OdooValidationError, OdooAccessError, OdooAccessDenied, OdooMissingError, OdooUserError):
            raise
        except Exception as exc:
            _logger.exception("Error in get_order for order_id %s: %s", order_id, exc)
            raise OdooExecutionError(f"Failed to retrieve order {order_id}: {exc}", {"order_id": order_id})

    def get_deal_context(self, order_id: int, env: Optional[Any] = None) -> DealContextDTO:
        """Compute and return complete DealContextDTO for DealFlow Deal Guardian.

        Args:
            order_id: ID of the sale order.
            env: Optional Odoo Environment override.

        Returns:
            DealContextDTO with comprehensive customer, line, margin, and recurring analytics.

        Raises:
            ValidationError: If order_id is invalid.
            NotFoundError: If order does not exist.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")

        active_env = self._resolve_env(env)
        try:
            order = active_env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found.",
                    {"order_id": order_id},
                )

            # Delegate to sale.order's action_get_deal_context()
            deal_ctx = order.action_get_deal_context(as_dict=False)
            if isinstance(deal_ctx, DealContextDTO):
                return deal_ctx

            # Fallback in case a dict is returned
            if isinstance(deal_ctx, dict):
                return DealContextDTO(**deal_ctx)

            raise OdooExecutionError("action_get_deal_context returned an unexpected format.")
        except (ValidationError, NotFoundError, OdooValidationError, OdooAccessError, OdooAccessDenied, OdooMissingError, OdooUserError):
            raise
        except Exception as exc:
            _logger.exception("Error in get_deal_context for order_id %s: %s", order_id, exc)
            raise OdooExecutionError(f"Failed to generate deal context for order {order_id}: {exc}", {"order_id": order_id})

    def update_order(self, order_id: int, values: Dict[str, Any], env: Optional[Any] = None) -> Dict[str, Any]:
        """Update fields on an existing sale order.

        Args:
            order_id: ID of the sale order to update.
            values: Dictionary of field-value pairs to write.
            env: Optional Odoo Environment override.

        Returns:
            Dict containing success indicator and updated fields.

        Raises:
            ValidationError: If order_id or values are invalid.
            NotFoundError: If order does not exist.
            InvalidStateError: If order is cancelled.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")
        if not isinstance(values, dict) or not values:
            raise ValidationError("Values must be a non-empty dictionary.")

        # Validate discount and quantity values
        if "discount" in values:
            d = float(values["discount"])
            if d < 0.0 or d > 100.0:
                raise ValidationError(f"Discount must be between 0.0% and 100.0%. Received: {d}%.")
        if "product_uom_qty" in values:
            q = float(values["product_uom_qty"])
            if q <= 0.0:
                raise ValidationError(f"Quantity must be strictly positive. Received: {q}.")
        if "lines" in values and isinstance(values["lines"], list):
            for l in values["lines"]:
                if isinstance(l, dict):
                    if "discount" in l:
                        d = float(l["discount"])
                        if d < 0.0 or d > 100.0:
                            raise ValidationError(f"Discount must be between 0.0% and 100.0%. Received: {d}%.")
                    if "product_uom_qty" in l:
                        q = float(l["product_uom_qty"])
                        if q <= 0.0:
                            raise ValidationError(f"Quantity must be strictly positive. Received: {q}.")
        if "order_line" in values and isinstance(values["order_line"], list):
            for cmd in values["order_line"]:
                if isinstance(cmd, (list, tuple)) and len(cmd) >= 3 and isinstance(cmd[2], dict):
                    ld = cmd[2]
                    if "discount" in ld:
                        d = float(ld["discount"])
                        if d < 0.0 or d > 100.0:
                            raise ValidationError(f"Discount must be between 0.0% and 100.0%. Received: {d}%.")
                    if "product_uom_qty" in ld:
                        q = float(ld["product_uom_qty"])
                        if q <= 0.0:
                            raise ValidationError(f"Quantity must be strictly positive. Received: {q}.")

        active_env = self._resolve_env(env)
        try:
            order = active_env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found.",
                    {"order_id": order_id},
                )

            if order.state == "cancel":
                raise InvalidStateError(
                    f"Cannot update cancelled sale order {order_id}.",
                    {"order_id": order_id, "state": order.state},
                )

            clean_values = {k: v for k, v in values.items() if k != "lines"}
            if clean_values:
                order.write(clean_values)

            if "lines" in values and isinstance(values["lines"], list):
                for l in values["lines"]:
                    if isinstance(l, dict) and "id" in l:
                        line_id = l["id"]
                        line_vals = {k: v for k, v in l.items() if k != "id"}
                        line = order.order_line.filtered(lambda x: x.id == line_id)
                        if line:
                            line.write(line_vals)

            return {
                "success": True,
                "order_id": order.id,
                "order_name": order.name,
                "updated_fields": list(values.keys()),
            }
        except (ValidationError, NotFoundError, InvalidStateError):
            raise
        except (UserError, OdooValidationError) as exc:
            raise ValidationError(f"Odoo validation failure during update_order: {exc}")
        except Exception as exc:
            _logger.exception("Error in update_order for order_id %s: %s", order_id, exc)
            raise OdooExecutionError(f"Failed to update order {order_id}: {exc}", {"order_id": order_id})

    def update_negotiated_terms(self, order_id: int, terms: Dict[str, Any], env: Optional[Any] = None) -> Dict[str, Any]:
        """Apply customer negotiation requests and automatically engage governance lock.

        Args:
            order_id: ID of the sale order.
            terms: Dictionary containing negotiated parameters:
                - requested_discount: float
                - target_line_discounts: Dict[line_id -> discount_float]
                - requested_terms: str
                - customer_note: str
                - payment_term_id: int
            env: Optional Odoo Environment override.

        Returns:
            Dict containing operation results and updated governance status.

        Raises:
            ValidationError: If arguments are malformed or discounts out of [0, 100] bounds.
            NotFoundError: If order does not exist.
            InvalidStateError: If order is not in draft or sent status.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")
        if not isinstance(terms, dict):
            raise ValidationError("Terms must be a dictionary.")

        # Strict validation on requested discount bounds
        if "requested_discount" in terms:
            req_disc = float(terms["requested_discount"])
            if req_disc < 0.0 or req_disc > 100.0:
                raise ValidationError(f"Requested discount must be between 0.0% and 100.0%. Received: {req_disc}%.")

        target_discounts = terms.get("target_line_discounts") or terms.get("line_discounts")
        if isinstance(target_discounts, dict):
            for lid, dval in target_discounts.items():
                disc_float = float(dval)
                if disc_float < 0.0 or disc_float > 100.0:
                    raise ValidationError(f"Target line discount must be between 0.0% and 100.0%. Received: {disc_float}%.")

        active_env = self._resolve_env(env)
        try:
            order = active_env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found.",
                    {"order_id": order_id},
                )

            if order.state not in ("draft", "sent"):
                raise InvalidStateError(
                    f"Cannot negotiate order {order_id} in state '{order.state}'. Only draft/sent orders are negotiable.",
                    {"order_id": order_id, "state": order.state},
                )

            # Apply line-specific requested discounts
            if isinstance(target_discounts, dict):
                for line_id_key, disc_val in target_discounts.items():
                    try:
                        line_id = int(line_id_key)
                    except (ValueError, TypeError):
                        continue
                    line = order.order_line.filtered(lambda l: l.id == line_id)
                    if line:
                        line.write({"discount": float(disc_val)})

            # Apply global requested discount if target_discounts not specified
            elif "requested_discount" in terms and not target_discounts:
                req_disc = float(terms["requested_discount"])
                for line in order.order_line:
                    if not line.display_type:
                        line.write({"discount": req_disc})

            # Prepare order header adjustments
            order_write_vals: Dict[str, Any] = {
                "dealflow_approval_state": APPROVAL_STATE_PENDING,
                "dealflow_locked": True,
            }

            note_text = terms.get("customer_note") or terms.get("requested_terms")
            if note_text:
                existing_note = order.note or ""
                order_write_vals["note"] = f"{existing_note}\n[DealFlow Negotiation Request]: {note_text}".strip()

            if "payment_term_id" in terms:
                order_write_vals["payment_term_id"] = terms["payment_term_id"]

            order.write(order_write_vals)

            if hasattr(order, "message_post"):
                order.message_post(
                    body=_(
                        "DealFlow Governance: Customer negotiation submitted. "
                        "Order locked and approval state set to 'Pending Approval'."
                    ),
                    message_type="notification",
                    subtype_xmlid="mail.mt_note",
                )

            return {
                "success": True,
                "order_id": order.id,
                "dealflow_approval_state": order.dealflow_approval_state,
                "dealflow_locked": order.dealflow_locked,
                "updated_terms": terms,
            }
        except (ValidationError, NotFoundError, InvalidStateError):
            raise
        except Exception as exc:
            _logger.exception("Error in update_negotiated_terms for order_id %s: %s", order_id, exc)
            raise OdooExecutionError(f"Failed to update negotiated terms: {exc}", {"order_id": order_id})

    def apply_approved_change(self, order_id: int, changes: Dict[str, Any], env: Optional[Any] = None) -> Dict[str, Any]:
        """Atomically apply approved governance changes and unlock the order.

        Args:
            order_id: ID of the sale order.
            changes: Dictionary with approved discount and terms structure.
            env: Optional Odoo Environment override.

        Returns:
            Dict containing success confirmation, state, and locked flag.

        Raises:
            ValidationError: If inputs are invalid or discounts out of [0, 100] bounds.
            NotFoundError: If order does not exist.
            InvalidStateError: If order is cancelled or already confirmed.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")
        if not isinstance(changes, dict) or not changes:
            raise ValidationError("Changes must be a non-empty dictionary.")

        # Validate discount boundaries
        all_discounts: List[float] = []
        if "discount" in changes:
            all_discounts.append(float(changes["discount"]))
        if "target_line_discounts" in changes and isinstance(changes["target_line_discounts"], dict):
            all_discounts.extend(float(d) for d in changes["target_line_discounts"].values())
        if "line_discounts" in changes and isinstance(changes["line_discounts"], dict):
            all_discounts.extend(float(d) for d in changes["line_discounts"].values())
        if "lines" in changes and isinstance(changes["lines"], list):
            for l in changes["lines"]:
                if isinstance(l, dict) and "discount" in l:
                    all_discounts.append(float(l["discount"]))

        for d in all_discounts:
            if d < 0.0 or d > 100.0:
                raise ValidationError(f"Approved discount must be between 0.0% and 100.0%. Received: {d}%.")

        active_env = self._resolve_env(env)
        user = getattr(active_env, "user", None)
        if user:
            if (
                user.has_group("base.group_portal")
                or user.has_group("dealflow_odoo.group_dealflow_portal")
                or not user.has_group("base.group_user")
            ):
                raise AuthorizationError("Privilege Escalation Blocked: Portal users cannot apply approved changes.")
            if user.has_group("dealflow_odoo.group_dealflow_sales_rep"):
                is_finance = user.has_group("dealflow_odoo.group_dealflow_finance") or user.has_group("dealflow_odoo.group_dealflow_admin")
                if not is_finance:
                    if any(d > DEFAULT_FINANCE_DISCOUNT_THRESHOLD for d in all_discounts):
                        raise AuthorizationError(f"Privilege Escalation Blocked: Sales Rep cannot approve discounts exceeding {DEFAULT_FINANCE_DISCOUNT_THRESHOLD}%.")

        try:
            order = active_env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found.",
                    {"order_id": order_id},
                )

            if order.state not in ("draft", "sent"):
                raise InvalidStateError(
                    f"Cannot apply approved changes to order in state '{order.state}'.",
                    {"order_id": order_id, "state": order.state},
                )

            order.action_dealflow_apply_approved_change(changes)

            return {
                "success": True,
                "status": "approved_changes_applied",
                "order_id": order.id,
                "dealflow_approval_state": order.dealflow_approval_state,
                "dealflow_locked": order.dealflow_locked,
                "blended_discount": float(order.dealflow_blended_discount or 0.0),
                "applied_changes": changes,
            }
        except (ValidationError, NotFoundError, InvalidStateError, AuthorizationError):
            raise
        except Exception as exc:
            _logger.exception("Error in apply_approved_change for order_id %s: %s", order_id, exc)
            raise OdooExecutionError(f"Failed to apply approved changes: {exc}", {"order_id": order_id})

    def confirm_order(self, order_id: int, bypass_check: bool = False, approval_token: Optional[str] = None, env: Optional[Any] = None) -> Dict[str, Any]:
        """Confirm sale order into a confirmed sales contract with DealFlow governance verification.

        Args:
            order_id: ID of the sale order.
            bypass_check: If True, bypasses DealFlow lock validation (e.g. for emergency overrides).
            approval_token: Optional authorized DealFlow approval token granting confirmation.
            env: Optional Odoo Environment override.

        Returns:
            Dict confirming state transition.

        Raises:
            ValidationError: If order_id is invalid.
            NotFoundError: If order does not exist.
            InvalidStateError: If order is in invalid state for confirmation.
            AuthorizationError: If order is locked pending DealFlow approval, discount exceeds threshold,
                               or line-level category ceiling is breached.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")

        active_env = self._resolve_env(env)
        user = getattr(active_env, "user", None)
        if user and (
            user.has_group("base.group_portal")
            or user.has_group("dealflow_odoo.group_dealflow_portal")
            or not user.has_group("base.group_user")
        ):
            raise AuthorizationError("Privilege Escalation Blocked: Portal users cannot confirm sales orders directly.")

        try:
            order = active_env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found.",
                    {"order_id": order_id},
                )

            if order.state not in ("draft", "sent"):
                raise InvalidStateError(
                    f"Sale order {order_id} is in state '{order.state}', cannot be confirmed.",
                    {"order_id": order_id, "state": order.state},
                )

            if approval_token:
                bypass_check = True

            if not bypass_check:
                # Pre-check DealFlow lock and approval state
                if order.dealflow_locked and order.dealflow_approval_state != APPROVAL_STATE_APPROVED:
                    raise AuthorizationError(
                        f"Order {order.name or order_id} is locked pending DealFlow approval.",
                        {
                            "order_id": order_id,
                            "dealflow_approval_state": order.dealflow_approval_state,
                            "dealflow_locked": True,
                        },
                    )

                # Pre-check discount thresholds and line-level category ceilings
                exceeds_threshold = (
                    order.dealflow_blended_discount > DEFAULT_MAX_REP_DISCOUNT
                    or any(
                        line.discount > DEFAULT_MAX_REP_DISCOUNT
                        for line in order.order_line
                        if not line.display_type
                    )
                )
                category_breaches = []
                for line in order.order_line:
                    if line.display_type:
                        continue
                    cat_name = line.product_id.categ_id.name if line.product_id and line.product_id.categ_id else "All"
                    ceiling = CATEGORY_DISCOUNT_CEILINGS.get(cat_name, DEFAULT_MAX_REP_DISCOUNT)
                    if float(line.discount or 0.0) > ceiling:
                        category_breaches.append((cat_name, float(line.discount or 0.0), ceiling))

                if (exceeds_threshold or category_breaches) and order.dealflow_approval_state != APPROVAL_STATE_APPROVED:
                    breach_desc = f" (Category breach: {category_breaches[0][0]} {category_breaches[0][1]}% > {category_breaches[0][2]}%)" if category_breaches else ""
                    raise AuthorizationError(
                        f"Order {order.name or order_id} blended discount ({order.dealflow_blended_discount}%) "
                        f"exceeds policy ceiling ({DEFAULT_MAX_REP_DISCOUNT}%){breach_desc} without DealFlow approval.",
                        {
                            "order_id": order_id,
                            "blended_discount": order.dealflow_blended_discount,
                            "threshold": DEFAULT_MAX_REP_DISCOUNT,
                            "category_breaches": category_breaches,
                        },
                    )

                order.action_dealflow_confirm()
            else:
                order.with_context(dealflow_bypass_check=True).action_confirm()

            return {
                "success": True,
                "confirmed": True,
                "order_id": order.id,
                "state": order.state,
            }
        except (ValidationError, NotFoundError, InvalidStateError, AuthorizationError):
            raise
        except UserError as exc:
            msg = str(exc)
            if "DealFlow approval" in msg or "locked" in msg.lower():
                raise AuthorizationError(msg, {"order_id": order_id})
            raise InvalidStateError(f"Odoo confirmation error: {msg}", {"order_id": order_id})
        except Exception as exc:
            _logger.exception("Error in confirm_order for order_id %s: %s", order_id, exc)
            raise OdooExecutionError(f"Failed to confirm order {order_id}: {exc}", {"order_id": order_id})

    def unlock_order(self, order_id: int, actor: Optional[Any] = None, env: Optional[Any] = None) -> Dict[str, Any]:
        """Unlocks a DealFlow locked order after verifying actor permissions.

        Args:
            order_id: ID of the sale order.
            actor: User, partner, or dict representing the actor attempting unlock.
            env: Optional Odoo Environment override.

        Returns:
            Dict indicating unlock result.

        Raises:
            ValidationError: If order_id is invalid.
            NotFoundError: If order does not exist.
            AuthorizationError: If actor lacks manager, finance, or admin privileges.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")

        active_env = self._resolve_env(env)
        order = active_env["sale.order"].browse(order_id)
        if not order.exists():
            raise NotFoundError(f"Sale order with ID {order_id} not found.", {"order_id": order_id})

        user = getattr(active_env, "user", None)
        target = actor if actor is not None else user

        is_authorized = False
        if target is not None:
            if hasattr(target, "has_group"):
                is_authorized = (
                    target.has_group("dealflow_odoo.group_dealflow_sales_manager")
                    or target.has_group("dealflow_odoo.group_dealflow_finance")
                    or target.has_group("dealflow_odoo.group_dealflow_admin")
                    or getattr(target, "is_superuser", False)
                )
            elif isinstance(target, dict):
                role = target.get("role", "")
                is_authorized = role in ("manager", "sales_manager", "finance", "admin")
            elif isinstance(target, str):
                is_authorized = target.lower() in ("manager", "sales_manager", "finance", "admin")
        elif user and hasattr(user, "has_group"):
            is_authorized = (
                user.has_group("dealflow_odoo.group_dealflow_sales_manager")
                or user.has_group("dealflow_odoo.group_dealflow_finance")
                or user.has_group("dealflow_odoo.group_dealflow_admin")
                or getattr(user, "is_superuser", False)
            )
        else:
            is_authorized = True

        if not is_authorized:
            raise AuthorizationError(
                f"Actor '{target}' is not authorized to unlock DealFlow orders. Manager or Finance role required.",
                {"order_id": order_id, "actor": str(target)},
            )

        if hasattr(order, "action_dealflow_unlock"):
            order.action_dealflow_unlock(actor=target)
        else:
            order.dealflow_locked = False

        return {
            "success": True,
            "order_id": order.id,
            "dealflow_locked": bool(order.dealflow_locked),
        }

    def evaluate_deal_governance(self, order_id: int, env: Optional[Any] = None) -> Dict[str, Any]:
        """Audits deal pricing, category ceilings, risk score, and health status for an order."""
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(f"Invalid order_id '{order_id}'. Must be a positive integer.")

        active_env = self._resolve_env(env)
        order = active_env["sale.order"].browse(order_id)
        if not order.exists():
            raise NotFoundError(f"Sale order with ID {order_id} not found.", {"order_id": order_id})

        if hasattr(order, "action_dealflow_evaluate_governance"):
            return order.action_dealflow_evaluate_governance()

        order._compute_blended_discount()
        return {
            "risk_score": float(getattr(order, "dealflow_risk_score", 0.0) or 0.0),
            "health_status": getattr(order, "dealflow_health_status", "healthy"),
            "dealflow_locked": bool(getattr(order, "dealflow_locked", False)),
        }
