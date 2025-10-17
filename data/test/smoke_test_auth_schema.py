#!/usr/bin/env python3
"""
Smoke test for Cognito-linked org/user/roles schema.

- Inserts a test user
- Calls create_org_with_owner()
- Verifies:
    * seeded roles: owner/admin/manager/user exist for the org
    * membership: user is in organization_users
    * role mapping: user has the 'owner' role in user_roles
- Rolls back by default so the DB stays clean (use --commit to persist)

Usage:
  export PGHOST=localhost PGPORT=5432 PGDATABASE=mydb PGUSER=myuser PGPASSWORD=mypw
  python smoke_test_auth_schema.py
  python smoke_test_auth_schema.py --commit   # if you want to keep the inserts

Install deps:
  pip install psycopg2-binary
"""

import os
import sys
import uuid
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor

EXPECTED_ROLE_NAMES = {"owner", "admin", "manager", "user"}
from dotenv import load_dotenv

# Load variables from env.dev file
load_dotenv("../../env.dev")

print (f"[info] Using OpenAI key: {'set' if os.getenv('OPENAI_API_KEY') else 'NOT SET'}")
print (f"[info] Using DATABASE_URL: {os.getenv('DATABASE_URL', 'NOT SET')}")

def connect():
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    # Build DSN from PG* envs
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    db   = os.getenv("PGDATABASE", "postgres")
    user = os.getenv("PGUSER", "postgres")
    pwd  = os.getenv("PGPASSWORD", "")
    return psycopg2.connect(host=host, port=port, dbname=db, user=user, password=pwd)

def fetch_one(cur):
    row = cur.fetchone()
    if row is None:
        raise AssertionError("Expected a row, got none.")
    return row

def main(commit: bool):
    org_name = f"Acme Corp SmokeTest {uuid.uuid4()}"
    cognito_sub = f"smoketest-sub-{uuid.uuid4()}"
    email = f"owner+{uuid.uuid4().hex[:8]}@example.com"
    display_name = "Smoke Test Owner"

    conn = connect()
    conn.autocommit = False  # we will rollback by default
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("→ Inserting test user …")
            cur.execute(
                """
                INSERT INTO users (cognito_sub, email, email_verified, display_name)
                VALUES (%s, %s, TRUE, %s)
                RETURNING id
                """,
                (cognito_sub, email, display_name),
            )
            user_id = fetch_one(cur)["id"]
            print(f"   user_id = {user_id}")

            print("→ Creating org with owner via create_org_with_owner() …")
            cur.execute("SELECT create_org_with_owner(%s, %s)", (org_name, user_id))
            org_id = fetch_one(cur)["create_org_with_owner"]
            print(f"   org_id  = {org_id}")

            print("→ Verifying seeded roles exist …")
            cur.execute(
                "SELECT name FROM roles WHERE organization_id = %s ORDER BY name",
                (org_id,),
            )
            role_names = {r["name"] for r in cur.fetchall()}
            missing = EXPECTED_ROLE_NAMES - role_names
            if missing:
                raise AssertionError(f"Seeded roles missing: {missing}; found={role_names}")
            print(f"   roles OK: {sorted(role_names)}")

            print("→ Verifying membership in organization_users …")
            cur.execute(
                """
                SELECT 1
                FROM organization_users
                WHERE organization_id = %s AND user_id = %s
                LIMIT 1
                """,
                (org_id, user_id),
            )
            if cur.fetchone() is None:
                raise AssertionError("User is not present in organization_users for the org.")
            print("   membership OK")

            print("→ Verifying user has 'owner' role in user_roles …")
            cur.execute(
                """
                SELECT r.name
                FROM user_roles ur
                JOIN roles r
                  ON r.organization_id = ur.organization_id
                 AND r.id = ur.role_id
                WHERE ur.organization_id = %s AND ur.user_id = %s
                ORDER BY r.name
                """,
                (org_id, user_id),
            )
            assigned = [row["name"] for row in cur.fetchall()]
            if "owner" not in assigned:
                raise AssertionError(f"Owner role not assigned. Found roles: {assigned}")
            print(f"   assigned roles: {assigned}")

            if commit:
                conn.commit()
                print("✓ Smoke test PASSED and changes COMMITTED.")
            else:
                conn.rollback()
                print("✓ Smoke test PASSED. Changes ROLLED BACK (database left clean).")

            return 0

    except psycopg2.Error as e:
        conn.rollback()
        print("✗ Database error:", e.pgerror or str(e), file=sys.stderr)
        return 1
    except AssertionError as e:
        conn.rollback()
        print("✗ Assertion failed:", str(e), file=sys.stderr)
        return 2
    except Exception as e:
        conn.rollback()
        print("✗ Unexpected error:", str(e), file=sys.stderr)
        return 3
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Smoke test for org/user/roles schema.")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Commit the inserted data instead of rolling back.",
    )
    sys.exit(main(parser.parse_args().commit))
