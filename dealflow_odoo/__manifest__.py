# -*- coding: utf-8 -*-
{
    'name': 'DealFlow360 Odoo Integration',
    'version': '18.0.1.0.0',
    'category': 'Sales/Sales',
    'summary': 'Intelligent deal governance and transactional execution engine',
    'description': """
DealFlow360 — Intelligent Deal Governance & Transactional Execution Engine
==========================================================================
* Continuous deal governance and real-time risk scoring
* Multi-tier discount governance and automated approval workflows
* Customer-facing negotiation portal on live quotations
* Multi-warehouse fulfillment splitting and inventory allocation
* Hybrid billing orchestration (one-time sales + recurring subscriptions)
* Audit logging and event dispatching
    """,
    'author': 'DealFlow360 Team',
    'website': 'https://dealflow360.example.com',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'sale_management',
        'stock',
        'account',
        'portal',
    ],
    'data': [
        'security/dealflow_security.xml',
        'security/ir.model.access.csv',
        'data/seed_data.xml',
        'views/sale_order_views.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}
