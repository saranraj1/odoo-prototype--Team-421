# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — User Roles & Permission Matrix Extension.

Inherits standard Odoo `res.users` to enforce the 5 core roles defined in
Problem Statement Section 4 (User Roles & Permission Matrix) & Section 6.1 (User Entity):

Roles:
1. Sales Rep: Internal workspace, no approval power, no portal access.
2. Sales Manager: Internal workspace, Level 1 approval (up to 20%), deal health dashboard.
3. Finance / Operations: Internal workspace, Level 2 approval (>20%), warehouse split & subscription reconciliation.
4. Customer (Portal User): External portal, restricted view, requests changes / counters discount.
5. Admin: Platform-wide configuration, rules, products, warehouses, pricing policies.
"""

from typing import Any, Dict, Optional
import logging

_logger = logging.getLogger("dealflow.res_users")

try:
    from odoo import api, fields, models
except ImportError:
    class _MockFields:
        @staticmethod
        def Char(*args: Any, **kwargs: Any) -> Any: return None
        @staticmethod
        def Boolean(*args: Any, **kwargs: Any) -> Any: return False
        @staticmethod
        def Selection(*args: Any, **kwargs: Any) -> Any: return None

    class _MockModels:
        Model = object

    class _MockApi:
        @staticmethod
        def depends(*args: Any) -> Any:
            def decorator(f): return f
            return decorator
        @staticmethod
        def model(f): return f

    models = _MockModels()  # type: ignore[assignment]
    fields = _MockFields()  # type: ignore[assignment]
    api = _MockApi()        # type: ignore[assignment]


DEALFLOW_ROLES = [
    ("rep", "Sales Rep"),
    ("manager", "Sales Manager / Approver"),
    ("finance", "Finance / Operations User"),
    ("portal", "Customer (Portal User)"),
    ("admin", "Admin"),
]


class ResUsers(models.Model):  # type: ignore[misc]
    """Extension of native Odoo res.users for DealFlow360 role governance."""

    _inherit = "res.users"

    dealflow_role = fields.Selection(
        selection=DEALFLOW_ROLES,
        string="DealFlow Role",
        default="rep",
        index=True,
        required=True,
        help=(
            "Platform role determining approval capabilities and workspace/portal access:\n"
            "- Sales Rep: Builds quotes, no approval rights, internal only\n"
            "- Sales Manager: Level 1 approvals (up to 20%), health monitor\n"
            "- Finance / Ops: Level 2 approvals (>20%), inventory splits, billing\n"
            "- Customer (Portal User): Restricted portal view, negotiation submission\n"
            "- Admin: Master catalog, discount tiers, warehouses, full access"
        ),
    )

    dealflow_can_approve_l1 = fields.Boolean(
        string="Can Approve Level 1",
        compute="_compute_dealflow_permissions",
        store=True,
        help="Eligible for Level 1 commercial discount approvals (Sales Manager & Finance).",
    )

    dealflow_can_approve_l2 = fields.Boolean(
        string="Can Approve Level 2",
        compute="_compute_dealflow_permissions",
        store=True,
        help="Eligible for Level 2 high-risk / deep-discount approvals (Finance only).",
    )

    dealflow_has_portal_access = fields.Boolean(
        string="Portal Access",
        compute="_compute_dealflow_permissions",
        store=True,
        help="Customer portal user isolated strictly to customer-facing views.",
    )

    dealflow_has_backend_access = fields.Boolean(
        string="Internal Workspace Access",
        compute="_compute_dealflow_permissions",
        store=True,
        help="Internal enterprise user with access to sales workspace and backend.",
    )

    @api.depends("dealflow_role")
    def _compute_dealflow_permissions(self) -> None:
        """Derive permission flags directly from assigned role according to PS Section 4."""
        for user in self:
            role = user.dealflow_role or "rep"
            if role == "portal":
                user.dealflow_can_approve_l1 = False
                user.dealflow_can_approve_l2 = False
                user.dealflow_has_portal_access = True
                user.dealflow_has_backend_access = False
            elif role == "manager":
                user.dealflow_can_approve_l1 = True
                user.dealflow_can_approve_l2 = False
                user.dealflow_has_portal_access = False
                user.dealflow_has_backend_access = True
            elif role == "finance":
                user.dealflow_can_approve_l1 = True
                user.dealflow_can_approve_l2 = True
                user.dealflow_has_portal_access = False
                user.dealflow_has_backend_access = True
            elif role == "admin":
                user.dealflow_can_approve_l1 = True
                user.dealflow_can_approve_l2 = True
                user.dealflow_has_portal_access = False
                user.dealflow_has_backend_access = True
            else:  # rep
                user.dealflow_can_approve_l1 = False
                user.dealflow_can_approve_l2 = False
                user.dealflow_has_portal_access = False
                user.dealflow_has_backend_access = True

    def check_can_approve(self, level: int = 1) -> bool:
        """Check whether this user has permission to approve at Level 1 or Level 2."""
        self.ensure_one()
        if level == 1:
            return bool(self.dealflow_can_approve_l1)
        elif level >= 2:
            return bool(self.dealflow_can_approve_l2)
        return False

    def is_portal_user(self) -> bool:
        """True if user is an external customer portal user."""
        self.ensure_one()
        return bool(self.dealflow_has_portal_access or self.dealflow_role == "portal")

    def _sync_dealflow_groups(self) -> None:
        """Synchronize Odoo security groups with the DealFlow role."""
        group_portal_ref = "dealflow_odoo.group_dealflow_portal"
        group_rep_ref = "dealflow_odoo.group_dealflow_sales_rep"
        group_mgr_ref = "dealflow_odoo.group_dealflow_sales_manager"
        group_fin_ref = "dealflow_odoo.group_dealflow_finance"
        group_admin_ref = "dealflow_odoo.group_dealflow_admin"

        for user in self:
            role = user.dealflow_role
            if not role or not hasattr(self.env, "ref"):
                continue
            try:
                if role == "portal":
                    grp = self.env.ref(group_portal_ref, raise_if_not_found=False)
                    if grp and grp not in user.groups_id:
                        user.write({"groups_id": [(4, grp.id)]})
                elif role == "manager":
                    grp = self.env.ref(group_mgr_ref, raise_if_not_found=False)
                    if grp and grp not in user.groups_id:
                        user.write({"groups_id": [(4, grp.id)]})
                elif role == "finance":
                    grp = self.env.ref(group_fin_ref, raise_if_not_found=False)
                    if grp and grp not in user.groups_id:
                        user.write({"groups_id": [(4, grp.id)]})
                elif role == "admin":
                    grp = self.env.ref(group_admin_ref, raise_if_not_found=False)
                    if grp and grp not in user.groups_id:
                        user.write({"groups_id": [(4, grp.id)]})
                elif role == "rep":
                    grp = self.env.ref(group_rep_ref, raise_if_not_found=False)
                    if grp and grp not in user.groups_id:
                        user.write({"groups_id": [(4, grp.id)]})
            except Exception as exc:
                _logger.debug("Security group sync skipped: %s", exc)

    def _sync_to_db_bridge(self) -> None:
        """Non-blocking dual-write of user role & permissions into PostgreSQL Decision Engine."""
        try:
            from dealflow_odoo.services.dealflow_repository_bridge import DealFlowRepositoryBridge
            bridge = DealFlowRepositoryBridge()
            if not bridge.is_enabled:
                return

            for user in self:
                bridge.sync_user_from_odoo({
                    "odoo_user_id": user.id,
                    "name": user.name,
                    "email": user.email or f"user{user.id}@dealflow.internal",
                    "role": (user.dealflow_role or "rep").upper(),
                    "can_approve_level1": user.dealflow_can_approve_l1,
                    "can_approve_level2": user.dealflow_can_approve_l2,
                    "has_portal_access": user.dealflow_has_portal_access,
                    "company_id": user.company_id.id if hasattr(user, "company_id") and user.company_id else 1,
                })
        except Exception as exc:
            _logger.debug("User sync to Decision Engine DB skipped: %s", exc)
