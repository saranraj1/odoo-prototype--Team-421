"""DealFlow360 Odoo Integration — Account Move Extension.

Inherits standard Odoo `account.move` to add DealFlow commercial tracking fields
for financial traceability and recurring subscription invoice classification.
"""

from typing import Any

try:
    from odoo import api, fields, models
except ImportError:
    # Graceful fallback for standalone linting, test suites, or microservices
    # running outside an active Odoo server daemon.
    class _MockFields:
        @staticmethod
        def Char(*args: Any, **kwargs: Any) -> Any:
            return None

        @staticmethod
        def Boolean(*args: Any, **kwargs: Any) -> Any:
            return False

    class _MockModels:
        Model = object

    class _MockApi:
        pass

    models = _MockModels()  # type: ignore[assignment]
    fields = _MockFields()  # type: ignore[assignment]
    api = _MockApi()        # type: ignore[assignment]


class AccountMove(models.Model):  # type: ignore[misc]
    """Extension of native Odoo account.move for DealFlow360."""

    _inherit = "account.move"

    dealflow_deal_id = fields.Char(
        string="DealFlow Deal ID",
        index=True,
        copy=False,
        help="External DealFlow Deal ID associated with this invoice / credit note.",
    )

    dealflow_is_recurring = fields.Boolean(
        string="Recurring Subscription Invoice",
        default=False,
        index=True,
        copy=False,
        help="Indicates whether this invoice was generated for a recurring subscription product or renewal.",
    )
