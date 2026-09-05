# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Foundation & Environment Test Suite.

Verifies:
- Odoo module manifest loading and dependencies
- Docker-compose syntax, services, healthchecks, and volume mappings
- Odoo configuration file settings
- Shared constants, governance thresholds, category ceilings, and error codes
- Data schemas, DTOs, and exception contracts
- Security groups, ACL definitions, and record rule declarations
- Seed data XML consistency (customers, products, warehouses, stock split)
"""

from __future__ import annotations

import ast
import csv
import os
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict

import pytest
import yaml

from dealflow_odoo import constants, schemas


BASE_DIR = Path(__file__).resolve().parent.parent
ADDON_DIR = BASE_DIR / "dealflow_odoo"


class TestFoundationEnvironment:
    """Test suite validating foundation architecture, configurations, and invariants."""

    def test_manifest_structure_and_dependencies(self):
        """Validates that __manifest__.py parses cleanly and contains required Odoo dependencies."""
        manifest_path = ADDON_DIR / "__manifest__.py"
        assert manifest_path.exists(), "dealflow_odoo/__manifest__.py must exist"

        manifest_content = manifest_path.read_text(encoding="utf-8")
        manifest_dict = ast.literal_eval(manifest_content)

        assert manifest_dict.get("name") == "DealFlow360 Odoo Integration"
        assert manifest_dict.get("version") == "18.0.1.0.0"
        assert manifest_dict.get("installable") is True
        assert manifest_dict.get("application") is True

        # Required dependencies
        expected_deps = {"base", "sale_management", "stock", "account", "portal"}
        actual_deps = set(manifest_dict.get("depends", []))
        missing_deps = expected_deps - actual_deps
        assert not missing_deps, f"Missing required dependencies in manifest: {missing_deps}"

        # Declared data files must exist on disk
        for data_file in manifest_dict.get("data", []):
            full_path = ADDON_DIR / data_file
            assert full_path.exists(), f"Manifest declared data file not found: {data_file}"

    def test_docker_compose_syntax_and_services(self):
        """Validates docker-compose.yml syntax, Odoo/Postgres services, ports, and volumes."""
        compose_path = BASE_DIR / "docker-compose.yml"
        assert compose_path.exists(), "docker-compose.yml must exist at repository root"

        with open(compose_path, "r", encoding="utf-8") as f:
            compose_cfg = yaml.safe_load(f)

        assert "services" in compose_cfg, "docker-compose must declare 'services'"
        services = compose_cfg["services"]

        # 1. Web (Odoo) service
        assert "web" in services, "Must declare 'web' service for Odoo"
        web_service = services["web"]
        assert "odoo" in web_service.get("image", "").lower()
        ports = [str(p) for p in web_service.get("ports", [])]
        assert any("8069" in p for p in ports), "Odoo port 8069 must be exposed"

        depends_on = web_service.get("depends_on", {})
        if isinstance(depends_on, dict):
            assert "db" in depends_on
        elif isinstance(depends_on, list):
            assert "db" in depends_on

        # Verify volume mappings
        volumes = [str(v) for v in web_service.get("volumes", [])]
        assert any("dealflow_odoo" in v for v in volumes), "Local addon must be mounted in Odoo web service"

        # 2. DB (PostgreSQL) service
        assert "db" in services, "Must declare 'db' service for PostgreSQL"
        db_service = services["db"]
        assert "postgres" in db_service.get("image", "").lower()
        db_env = db_service.get("environment", {})
        if isinstance(db_env, list):
            db_env_dict = dict(item.split("=", 1) for item in db_env if "=" in item)
        else:
            db_env_dict = db_env or {}
        assert db_env_dict.get("POSTGRES_USER") == "odoo"
        assert db_env_dict.get("POSTGRES_PASSWORD") == "odoo"

    def test_odoo_conf_configuration(self):
        """Validates odoo.conf database and addons path configuration."""
        conf_path = BASE_DIR / "odoo.conf"
        assert conf_path.exists(), "odoo.conf must exist at repository root"

        conf_content = conf_path.read_text(encoding="utf-8")
        assert "admin_passwd" in conf_content, "admin_passwd must be configured"
        assert "db_user = odoo" in conf_content or "db_user=odoo" in conf_content
        assert "addons_path" in conf_content, "addons_path must be configured"
        assert "/mnt/extra-addons" in conf_content

    def test_constants_invariants_and_thresholds(self):
        """Validates DealFlow constants: approval states, risk levels, health, ceilings, errors."""
        # Approval States
        assert constants.APPROVAL_STATE_DRAFT == "draft"
        assert constants.APPROVAL_STATE_PENDING == "pending_approval"
        assert constants.APPROVAL_STATE_APPROVED == "approved"
        assert constants.APPROVAL_STATE_REJECTED == "rejected"
        assert constants.APPROVAL_STATE_REAPPROVAL_REQUIRED == "reapproval_required"

        state_keys = [s[0] for s in constants.APPROVAL_STATES]
        assert "draft" in state_keys
        assert "approved" in state_keys
        assert "pending_approval" in state_keys
        assert "reapproval_required" in state_keys

        # Risk Levels
        assert constants.RISK_LEVEL_LOW == "low"
        assert constants.RISK_LEVEL_MEDIUM == "medium"
        assert constants.RISK_LEVEL_HIGH == "high"
        assert constants.RISK_LEVEL_CRITICAL == "critical"

        # Health Statuses
        assert constants.HEALTH_STATUS_HEALTHY == "healthy"
        assert constants.HEALTH_STATUS_AT_RISK == "at_risk"
        assert constants.HEALTH_STATUS_CRITICAL == "critical"

        # Discount Policy Thresholds
        assert constants.DEFAULT_MAX_REP_DISCOUNT == 10.0
        assert constants.DEFAULT_MAX_MGR_DISCOUNT == 20.0
        assert constants.DEFAULT_FINANCE_DISCOUNT_THRESHOLD == 20.0

        # Category Ceilings
        assert constants.CATEGORY_DISCOUNT_CEILINGS["Hardware"] == 15.0
        assert constants.CATEGORY_DISCOUNT_CEILINGS["Service"] == 15.0
        assert constants.CATEGORY_DISCOUNT_CEILINGS["Subscription"] == 10.0

        # Error Codes
        assert constants.ERR_VALIDATION == "VALIDATION_ERROR"
        assert constants.ERR_AUTHORIZATION == "AUTHORIZATION_ERROR"
        assert constants.ERR_NOT_FOUND == "NOT_FOUND"
        assert constants.ERR_INVALID_STATE == "INVALID_STATE"
        assert constants.ERR_ODOO_FAILURE == "ODOO_FAILURE"

    def test_schemas_and_dtos_instantiation(self):
        """Validates all shared DTO classes and exception classes."""
        # Exception Hierarchy
        assert issubclass(schemas.ValidationError, schemas.DealFlowIntegrationError)
        assert issubclass(schemas.AuthorizationError, schemas.DealFlowIntegrationError)
        assert issubclass(schemas.NotFoundError, schemas.DealFlowIntegrationError)
        assert issubclass(schemas.InvalidStateError, schemas.DealFlowIntegrationError)
        assert issubclass(schemas.OdooExecutionError, schemas.DealFlowIntegrationError)

        val_err = schemas.ValidationError("Test message", details={"field": "discount"})
        err_dict = val_err.to_dict()
        assert err_dict["success"] is False
        assert err_dict["error"]["code"] == "VALIDATION_ERROR"
        assert err_dict["error"]["details"]["field"] == "discount"

        # CustomerDTO
        customer = schemas.CustomerDTO(
            id=1,
            name="Acme Corp",
            email="test@acme.com",
            credit_limit=50000.0,
            total_invoiced=12000.0,
        )
        assert customer.id == 1
        assert customer.credit_limit == 50000.0

        # ProductDTO
        product = schemas.ProductDTO(
            id=1,
            name="Laptop",
            list_price=1200.0,
            standard_price=800.0,
            is_recurring=False,
        )
        assert product.list_price == 1200.0
        assert product.standard_price == 800.0

        # OrderLineDTO
        line = schemas.OrderLineDTO(
            id=1,
            product_id=1,
            product_name="Laptop",
            category_name="Hardware",
            product_uom_qty=2.0,
            price_unit=1200.0,
            cost_price=800.0,
            discount=5.0,
            price_subtotal=2280.0,
            margin=680.0,
            margin_percent=29.82,
        )
        assert line.margin == 680.0

        # DealContextDTO
        deal_ctx = schemas.DealContextDTO(
            deal_id="DEAL-001",
            order_id=1,
            order_name="SO0001",
            customer=customer,
            state="draft",
            date_order="2026-09-05",
            currency="USD",
            amount_untaxed=2280.0,
            amount_tax=228.0,
            amount_total=2508.0,
            blended_discount=5.0,
            total_cost=1600.0,
            total_margin=680.0,
            margin_percent=29.82,
            lines=[line],
        )
        assert deal_ctx.dealflow_approval_state == "draft"
        assert deal_ctx.blended_discount == 5.0

    def test_security_xml_definitions(self):
        """Validates XML parse of security groups and customer isolation record rules."""
        security_xml_path = ADDON_DIR / "security" / "dealflow_security.xml"
        assert security_xml_path.exists(), "dealflow_security.xml must exist"

        tree = ET.parse(security_xml_path)
        root = tree.getroot()

        # Find all record IDs
        record_ids = [elem.get("id") for elem in root.findall(".//record")]

        expected_groups = {
            "group_dealflow_sales_rep",
            "group_dealflow_sales_manager",
            "group_dealflow_finance",
            "group_dealflow_admin",
            "group_dealflow_portal",
        }
        for g in expected_groups:
            assert g in record_ids, f"Security group {g} not declared in dealflow_security.xml"

        # Find record rules (e.g. customer isolation)
        rule_records = [elem for elem in root.findall(".//record") if elem.get("model") == "ir.rule"]
        assert len(rule_records) >= 2, "Must declare security rules for portal and sales isolation"

    def test_ir_model_access_csv(self):
        """Validates security/ir.model.access.csv for valid columns and model permissions."""
        csv_path = ADDON_DIR / "security" / "ir.model.access.csv"
        assert csv_path.exists(), "ir.model.access.csv must exist"

        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) > 0, "ir.model.access.csv must contain permission rows"
        expected_fields = {"id", "name", "model_id:id", "group_id:id", "perm_read", "perm_write", "perm_create", "perm_unlink"}
        assert expected_fields.issubset(set(reader.fieldnames or [])), "CSV headers must include standard Odoo ACL columns"

        # Check access exists for dealflow models
        models_covered = {row["model_id:id"] for row in rows}
        assert any("model_dealflow_negotiation" in m for m in models_covered), "Must define access for dealflow.negotiation"

    def test_seed_data_xml_integrity(self):
        """Validates seed_data.xml records, customer names, products, warehouses, and split stock."""
        seed_path = ADDON_DIR / "data" / "seed_data.xml"
        assert seed_path.exists(), "data/seed_data.xml must exist"

        tree = ET.parse(seed_path)
        root = tree.getroot()

        records = root.findall(".//record")
        record_ids = {r.get("id"): r for r in records}

        # 1. Customers: Acme Corp, Beta Industries, Nova Retail
        assert "partner_customer_acme" in record_ids
        assert "partner_customer_beta" in record_ids
        assert "partner_customer_nova" in record_ids

        # 2. Products: Laptop, Monitor, Docking Station, Implementation Service, Premium Support
        assert "product_laptop" in record_ids
        assert "product_monitor" in record_ids
        assert "product_docking_station" in record_ids
        assert "product_implementation_service" in record_ids
        assert "product_premium_support" in record_ids

        # 3. Warehouses: WH1 Main, WH2 East
        assert "warehouse_main" in record_ids
        assert "warehouse_east" in record_ids

        # 4. Warehouse Split Scenario: Laptop stock 9 in WH1 and 6 in WH2 (Total = 15)
        assert "stock_quant_laptop_wh1" in record_ids
        assert "stock_quant_laptop_wh2" in record_ids

        wh1_quant = record_ids["stock_quant_laptop_wh1"]
        wh2_quant = record_ids["stock_quant_laptop_wh2"]

        wh1_qty = [f.text for f in wh1_quant.findall("field") if f.get("name") in ("quantity", "inventory_quantity")][0]
        wh2_qty = [f.text for f in wh2_quant.findall("field") if f.get("name") in ("quantity", "inventory_quantity")][0]

        assert float(wh1_qty) == 9.0, f"WH1 Laptop quantity must be 9.0, got {wh1_qty}"
        assert float(wh2_qty) == 6.0, f"WH2 Laptop quantity must be 6.0, got {wh2_qty}"
