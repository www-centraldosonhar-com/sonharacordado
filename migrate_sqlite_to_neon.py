"""
One-time migration from the old local SQLite database to Neon PostgreSQL.

This version:
- Migrates only columns that exist in BOTH databases.
- Ignores obsolete SQLite-only columns safely.
- Preserves IDs.
- Uses ON CONFLICT (id) DO UPDATE.
- Resets PostgreSQL SERIAL sequences.
- Rolls back the whole migration if an unexpected error happens.

Usage:
    python migrate_sqlite_to_neon.py
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

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    ""
).strip()

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


def get_sqlite_columns(sqlite_connection, table):
    rows = sqlite_connection.execute(
        f"PRAGMA table_info({q(table)})"
    ).fetchall()

    return [
        row["name"]
        for row in rows
    ]


def get_postgres_columns(pg, table):
    pg.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,)
    )

    return [
        row["column_name"]
        for row in pg.fetchall()
    ]


def migrate_table(sqlite_connection, pg, table):
    sqlite_columns = get_sqlite_columns(
        sqlite_connection,
        table
    )

    postgres_columns = get_postgres_columns(
        pg,
        table
    )

    if not sqlite_columns:
        print(
            f"{table}: tabela não encontrada no SQLite."
        )
        return 0

    if not postgres_columns:
        print(
            f"{table}: tabela não encontrada no Neon."
        )
        return 0

    common_columns = [
        column
        for column in sqlite_columns
        if column in postgres_columns
    ]

    ignored_columns = [
        column
        for column in sqlite_columns
        if column not in postgres_columns
    ]

    if ignored_columns:
        print(
            f"{table}: ignorando colunas antigas -> "
            + ", ".join(ignored_columns)
        )

    if not common_columns:
        print(
            f"{table}: nenhuma coluna compatível."
        )
        return 0

    rows = sqlite_connection.execute(
        f"""
        SELECT *
        FROM {q(table)}
        ORDER BY id
        """
    ).fetchall()

    if not rows:
        print(
            f"{table}: 0 registros"
        )
        return 0

    column_sql = ", ".join(
        q(column)
        for column in common_columns
    )

    placeholders = ", ".join(
        ["%s"] * len(common_columns)
    )

    update_columns = [
        column
        for column in common_columns
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
            for column in common_columns
        )
        for row in rows
    ]

    pg.executemany(
        query,
        values
    )

    print(
        f"{table}: {len(rows)} registros migrados"
    )

    return len(rows)


def reset_sequence(pg, table):
    pg.execute(
        """
        SELECT
            pg_get_serial_sequence(
                %s,
                'id'
            ) AS sequence_name
        """,
        (table,)
    )

    row = pg.fetchone()

    if (
        not row
        or not row["sequence_name"]
    ):
        return

    sequence_name = row["sequence_name"]

    pg.execute(
        f"""
        SELECT
            COALESCE(
                MAX(id),
                0
            ) AS max_id
        FROM {q(table)}
        """
    )

    max_row = pg.fetchone()
    max_id = (
        max_row["max_id"]
        if max_row
        else 0
    )

    if max_id > 0:
        pg.execute(
            """
            SELECT setval(
                %s,
                %s,
                true
            )
            """,
            (
                sequence_name,
                max_id
            )
        )
    else:
        pg.execute(
            """
            SELECT setval(
                %s,
                1,
                false
            )
            """,
            (sequence_name,)
        )


def print_postgres_counts(pg):
    print(
        "\n----------------------------------------"
    )
    print(
        "RESUMO NO NEON"
    )
    print(
        "----------------------------------------"
    )

    for table in TABLES:
        pg.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM {q(table)}
            """
        )

        row = pg.fetchone()

        print(
            f"{table}: "
            f"{row['total'] if row else 0}"
        )


def main():
    print(
        "========================================"
    )
    print(
        "CENTRAL DO SONHAR"
    )
    print(
        "SQLite -> Neon PostgreSQL"
    )
    print(
        "========================================"
    )

    if not SQLITE_PATH.exists():
        raise SystemExit(
            "database.db não encontrado em:\n"
            f"{SQLITE_PATH}"
        )

    if not DATABASE_URL:
        raise SystemExit(
            "DATABASE_URL não encontrada.\n"
            "Confira seu arquivo .env."
        )

    sqlite_connection = sqlite3.connect(
        SQLITE_PATH
    )

    sqlite_connection.row_factory = sqlite3.Row

    postgres_connection = psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )

    total_migrated = 0

    try:
        with postgres_connection.cursor() as pg:
            print(
                "\nMigrando dados...\n"
            )

            for table in TABLES:
                total_migrated += migrate_table(
                    sqlite_connection,
                    pg,
                    table
                )

            print(
                "\nAtualizando sequências..."
            )

            for table in TABLES:
                reset_sequence(
                    pg,
                    table
                )

            print_postgres_counts(
                pg
            )

        postgres_connection.commit()

        print(
            "\n========================================"
        )
        print(
            "MIGRAÇÃO CONCLUÍDA COM SUCESSO ✅"
        )
        print(
            f"Registros processados: {total_migrated}"
        )
        print(
            "========================================"
        )

    except Exception:
        postgres_connection.rollback()

        print(
            "\n========================================"
        )
        print(
            "MIGRAÇÃO CANCELADA ❌"
        )
        print(
            "Nenhuma alteração desta tentativa "
            "foi confirmada no Neon."
        )
        print(
            "========================================"
        )

        raise

    finally:
        sqlite_connection.close()
        postgres_connection.close()


if __name__ == "__main__":
    main()
