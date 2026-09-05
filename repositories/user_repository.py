# -*- coding: utf-8 -*-
"""
User Repository
Author: DealFlow360 Team
Purpose: Manages persistence, role queries, and approval permissions for internal & portal users.
Conforms to Problem Statement Section 4 (Permission Matrix) & Section 6.1 (User Entity).
"""

from typing import Optional, List, Dict, Any
import uuid
from db.contracts import UserDTO
from db.connection import get_db_cursor


class UserRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def create_user(
        self,
        odoo_user_id: int,
        name: str,
        email: str,
        role: str = "REP",
        can_approve_level1: bool = False,
        can_approve_level2: bool = False,
        has_portal_access: bool = False,
        company_id: int = 1,
    ) -> UserDTO:
        """Create or update an app_user record with assigned role and permissions."""
        user_id = str(uuid.uuid4())
        # Automatically derive permissions from role if not explicitly set
        if role == "MANAGER":
            can_approve_level1 = True
        elif role == "FINANCE":
            can_approve_level1 = True
            can_approve_level2 = True
        elif role == "PORTAL":
            has_portal_access = True
            can_approve_level1 = False
            can_approve_level2 = False

        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO app_user (
                       id, odoo_user_id, name, email, role,
                       can_approve_level1, can_approve_level2, has_portal_access, company_id
                   )
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (odoo_user_id) DO UPDATE
                   SET name = EXCLUDED.name,
                       email = EXCLUDED.email,
                       role = EXCLUDED.role,
                       can_approve_level1 = EXCLUDED.can_approve_level1,
                       can_approve_level2 = EXCLUDED.can_approve_level2,
                       has_portal_access = EXCLUDED.has_portal_access,
                       updated_at = CURRENT_TIMESTAMP
                   RETURNING id, created_at, updated_at""",
                (user_id, odoo_user_id, name, email, role.upper(),
                 can_approve_level1, can_approve_level2, has_portal_access, company_id)
            )
            row = cur.fetchone()
            actual_id = str(row['id']) if row else user_id
            created_at = row['created_at'] if row else None
            updated_at = row['updated_at'] if row else None

        return UserDTO(
            id=actual_id,
            odoo_user_id=odoo_user_id,
            name=name,
            email=email,
            role=role.upper(),
            can_approve_level1=can_approve_level1,
            can_approve_level2=can_approve_level2,
            has_portal_access=has_portal_access,
            company_id=company_id,
            active=True,
            created_at=created_at,
            updated_at=updated_at,
        )

    def get_by_odoo_id(self, odoo_user_id: int) -> Optional[UserDTO]:
        """Fetch user record by Odoo UID."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_user_id, name, email, role,
                          can_approve_level1, can_approve_level2, has_portal_access,
                          company_id, active, created_at, updated_at
                   FROM app_user WHERE odoo_user_id = %s""",
                (odoo_user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return UserDTO(
                id=str(row['id']),
                odoo_user_id=row['odoo_user_id'],
                name=row['name'],
                email=row['email'],
                role=row['role'],
                can_approve_level1=row['can_approve_level1'],
                can_approve_level2=row['can_approve_level2'],
                has_portal_access=row['has_portal_access'],
                company_id=row['company_id'],
                active=row['active'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )

    def get_by_id(self, user_id: str) -> Optional[UserDTO]:
        """Fetch user record by UUID."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_user_id, name, email, role,
                          can_approve_level1, can_approve_level2, has_portal_access,
                          company_id, active, created_at, updated_at
                   FROM app_user WHERE id = %s""",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return UserDTO(
                id=str(row['id']),
                odoo_user_id=row['odoo_user_id'],
                name=row['name'],
                email=row['email'],
                role=row['role'],
                can_approve_level1=row['can_approve_level1'],
                can_approve_level2=row['can_approve_level2'],
                has_portal_access=row['has_portal_access'],
                company_id=row['company_id'],
                active=row['active'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )

    def list_by_role(self, role: str, company_id: int = 1) -> List[UserDTO]:
        """List active users matching a specific role."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_user_id, name, email, role,
                          can_approve_level1, can_approve_level2, has_portal_access,
                          company_id, active, created_at, updated_at
                   FROM app_user
                   WHERE role = %s AND company_id = %s AND active = TRUE
                   ORDER BY name ASC""",
                (role.upper(), company_id)
            )
            rows = cur.fetchall() or []
            return [
                UserDTO(
                    id=str(r['id']),
                    odoo_user_id=r['odoo_user_id'],
                    name=r['name'],
                    email=r['email'],
                    role=r['role'],
                    can_approve_level1=r['can_approve_level1'],
                    can_approve_level2=r['can_approve_level2'],
                    has_portal_access=r['has_portal_access'],
                    company_id=r['company_id'],
                    active=r['active'],
                    created_at=r['created_at'],
                    updated_at=r['updated_at'],
                )
                for r in rows
            ]

    def list_approvers_for_level(self, level: int = 1, company_id: int = 1) -> List[UserDTO]:
        """List active approver users qualified for Level 1 or Level 2 approvals."""
        condition = "can_approve_level1 = TRUE" if level == 1 else "can_approve_level2 = TRUE"
        with get_db_cursor() as cur:
            cur.execute(
                f"""SELECT id, odoo_user_id, name, email, role,
                           can_approve_level1, can_approve_level2, has_portal_access,
                           company_id, active, created_at, updated_at
                    FROM app_user
                    WHERE {condition} AND company_id = %s AND active = TRUE
                    ORDER BY name ASC""",
                (company_id,)
            )
            rows = cur.fetchall() or []
            return [
                UserDTO(
                    id=str(r['id']),
                    odoo_user_id=r['odoo_user_id'],
                    name=r['name'],
                    email=r['email'],
                    role=r['role'],
                    can_approve_level1=r['can_approve_level1'],
                    can_approve_level2=r['can_approve_level2'],
                    has_portal_access=r['has_portal_access'],
                    company_id=r['company_id'],
                    active=r['active'],
                    created_at=r['created_at'],
                    updated_at=r['updated_at'],
                )
                for r in rows
            ]
