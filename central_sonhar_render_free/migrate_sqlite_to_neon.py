"""
One-time migration from the old local SQLite database to Neon PostgreSQL.

Usage:
    1. Put your old database.db in the project root.
    2. Configure DATABASE_URL in .env.
    3. Run:
           python migrate_sqlite_to_neon.py

Run this only once against an empty Neon database.
"""

from pathlib import Path
import os
import sqlite3

from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
SQLITE_PATH = BASE_DIR / "database.db"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

TABLES = [
    "projects",
    "users",
    "roles",
    "events",
    "event_roles",
    "confirmations",
    "tasks",
    "task_users",
    "announcements",
    "notifications",
]


def q(identifier):
    return '"' + identifier.replace('"', '""') + '"'


def main():

    if not SQLITE_PATH.exists():
        raise SystemExit(
            f"SQLite file not found: {SQLITE_PATH}"
        )

    if not DATABASE_URL:
        raise SystemExit(
            "DATABASE_URL is missing."
        )

    sqlite_connection = sqlite3.connect(
        SQLITE_PATH
    )
    sqlite_connection.row_factory = sqlite3.Row

    postgres_connection = psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )

    try:

        with postgres_connection.cursor() as pg:

            for table in TABLES:

                rows = sqlite_connection.execute(
                    f"SELECT * FROM {q(table)} ORDER BY id"
                ).fetchall()

                if not rows:
                    print(
                        f"{table}: 0 rows"
                    )
                    continue

                columns = rows[0].keys()

                column_sql = ", ".join(
                    q(column)
                    for column in columns
                )

                placeholders = ", ".join(
                    ["%s"] * len(columns)
                )

                update_columns = [
                    column
                    for column in columns
                    if column != "id"
                ]

                if update_columns:

                    update_sql = ", ".join(
                        f"{q(column)} = EXCLUDED.{q(column)}"
                        for column in update_columns
                    )

                    conflict_sql = (
                        "ON CONFLICT (id) DO UPDATE SET "
                        + update_sql
                    )

                else:

                    conflict_sql = (
                        "ON CONFLICT (id) DO NOTHING"
                    )

                query = (
                    f"INSERT INTO {q(table)} "
                    f"({column_sql}) "
                    f"VALUES ({placeholders}) "
                    f"{conflict_sql}"
                )

                values = [
                    tuple(
                        row[column]
                        for column in columns
                    )
                    for row in rows
                ]

                pg.executemany(
                    query,
                    values
                )

                print(
                    f"{table}: {len(rows)} rows"
                )

            # Reset SERIAL sequences after preserving SQLite IDs.
            for table in TABLES:

                pg.execute(
                    """
                    SELECT pg_get_serial_sequence(%s, 'id')
                    AS sequence_name
                    """,
                    (table,)
                )

                sequence = pg.fetchone()

                if (
                    sequence
                    and sequence["sequence_name"]
                ):

                    pg.execute(
                        f"""
                        SELECT setval(
                            %s,
                            COALESCE(
                                (SELECT MAX(id) FROM {q(table)}),
                                1
                            ),
                            true
                        )
                        """,
                        (
                            sequence[
                                "sequence_name"
                            ],
                        )
                    )

        postgres_connection.commit()

        print(
            "\nMigration finished successfully."
        )

    except Exception:

        postgres_connection.rollback()
        raise

    finally:

        sqlite_connection.close()
        postgres_connection.close()


if __name__ == "__main__":
    main()
