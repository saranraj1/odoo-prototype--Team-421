# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Addon — Package Initialiser.

Bootstraps the Python path so the sibling db/ and repositories/ packages
(the DealFlow360 Decision Engine) are importable from inside the Odoo process.
"""

import logging
import os
import sys

_logger = logging.getLogger(__name__)


def _setup_dealflow_pythonpath() -> None:
    """Prepend the DealFlow360 workspace root to sys.path.

    Path resolution (relative to this file):
        dealflow_odoo/__init__.py
        -> dealflow_odoo/          (addon root)
        -> dealflow_odoo-main/     (module clone root)
        -> d:\\odoo-prototype--Team-421\\  (workspace root)

    An env-var override DEALFLOW_WORKSPACE_ROOT takes precedence.
    """
    try:
        this_dir = os.path.dirname(os.path.abspath(__file__))   # dealflow_odoo/
        module_root = os.path.dirname(this_dir)                  # dealflow_odoo-main/
        workspace_root = os.path.dirname(module_root)            # workspace root

        env_override = os.getenv("DEALFLOW_WORKSPACE_ROOT")
        if env_override and os.path.isdir(env_override):
            workspace_root = env_override

        if workspace_root not in sys.path:
            sys.path.insert(0, workspace_root)
            _logger.info(
                "[DealFlow360] Workspace root '%s' added to sys.path for Decision Engine access.",
                workspace_root,
            )
    except Exception as exc:  # pragma: no cover
        _logger.warning("[DealFlow360] sys.path bootstrap failed: %s", exc)


_setup_dealflow_pythonpath()

from . import models
from . import services
from . import controllers
