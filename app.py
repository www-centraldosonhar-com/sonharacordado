# =========================================================
# IMPORTS
# =========================================================

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session
)

from flask_wtf.csrf import (
    CSRFProtect,
    CSRFError
)

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from functools import wraps
from datetime import datetime, timedelta
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import os
import re

from werkzeug.utils import secure_filename

from dotenv import load_dotenv

import psycopg
from psycopg.rows import dict_row
from psycopg.errors import IntegrityError

from supabase import create_client

load_dotenv()

# =========================================================
# SECURITY SETTINGS
# =========================================================

MIN_PASSWORD_LENGTH = 4

# =========================================================
# PATHS
# =========================================================
# Using absolute paths makes the application more reliable
# locally and when running on Render / Gunicorn.

BASE_DIR = os.path.abspath(
    os.path.dirname(__file__)
)

SCHEMA_PATH = os.path.join(
    BASE_DIR,
    "database",
    "schema.sql"
)


# PostgreSQL database (Neon)
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# Supabase Storage
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_BUCKET = os.environ.get(
    "SUPABASE_BUCKET",
    "central-media"
).strip()

APP_TIMEZONE = ZoneInfo("America/Sao_Paulo")


# =========================================================
# FLASK CONFIGURATION
# =========================================================

app = Flask(__name__)


# =========================================================
# AVATAR UPLOAD CONFIGURATION
# =========================================================

AVATAR_FOLDER = os.path.join(
    BASE_DIR,
    "static",
    "avatars"
)

EVENT_IMAGE_FOLDER = os.path.join(
    BASE_DIR,
    "static",
    "event_images"
)

ALLOWED_AVATAR_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp"
}

os.makedirs(
    AVATAR_FOLDER,
    exist_ok=True
)

os.makedirs(
    EVENT_IMAGE_FOLDER,
    exist_ok=True
)


# ---------------------------------------------------------
# SECRET KEY
# ---------------------------------------------------------

secret_key = os.environ.get(
    "SECRET_KEY"
)

# On Render we do not allow the predictable
# development fallback.
if os.environ.get("RENDER") and not secret_key:

    raise RuntimeError(
        "SECRET_KEY environment variable is required."
    )


# Local development may use this fallback.
app.secret_key = (
    secret_key
    or "dev-secret-key"
)


# ---------------------------------------------------------
# SESSION SECURITY
# ---------------------------------------------------------

app.config.update(

    # JavaScript cannot access the session cookie.
    SESSION_COOKIE_HTTPONLY=True,

    # Good protection against common cross-site requests.
    SESSION_COOKIE_SAMESITE="Lax",

    # HTTPS-only cookie when running on Render.
    SESSION_COOKIE_SECURE=bool(
        os.environ.get("RENDER")
    ),

    # Session duration.
    PERMANENT_SESSION_LIFETIME=timedelta(
        hours=8
    )
)


# =========================================================
# CSRF PROTECTION
# =========================================================

csrf = CSRFProtect(app)


# =========================================================
# DATABASE - POSTGRESQL / NEON
# =========================================================

def now_local():
    """
    Returns the current São Paulo time as a naive datetime.

    Database timestamps in this MVP are stored without timezone,
    matching the local time users see in the interface.
    """

    return datetime.now(
        APP_TIMEZONE
    ).replace(
        tzinfo=None
    )


def translate_sql(query):
    """
    Small compatibility layer so the existing MVP queries can
    remain readable while moving from SQLite to PostgreSQL.

    Converts:
      ? placeholders -> %s
      COLLATE NOCASE comparisons -> LOWER(...)
      SQLite datetime/date helpers -> PostgreSQL equivalents
      INSERT OR IGNORE -> ON CONFLICT DO NOTHING
      BEGIN IMMEDIATE -> BEGIN
    """

    query = query.strip()

    if query.upper() == "BEGIN IMMEDIATE":
        return "BEGIN"

    # SQLite current local date/time helpers.
    query = re.sub(
        r"datetime\(\s*'now'\s*,\s*'localtime'\s*\)",
        "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')",
        query,
        flags=re.I
    )

    query = re.sub(
        r"DATE\(\s*'now'\s*,\s*'localtime'\s*\)",
        "((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date)",
        query,
        flags=re.I
    )

    # datetime(column) in SQLite -> native PostgreSQL timestamp column.
    query = re.sub(
        r"datetime\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\)",
        r"\1",
        query,
        flags=re.I
    )

    # Convert qmark placeholders.
    query = query.replace("?", "%s")

    # Case-insensitive equality from SQLite.
    query = re.sub(
        r"([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*%s\s+COLLATE\s+NOCASE",
        r"LOWER(\1) = LOWER(%s)",
        query,
        flags=re.I
    )

    # INSERT OR IGNORE ... VALUES (...) -> ON CONFLICT DO NOTHING
    if re.search(r"^\s*INSERT\s+OR\s+IGNORE\s+INTO", query, flags=re.I):
        query = re.sub(
            r"INSERT\s+OR\s+IGNORE\s+INTO",
            "INSERT INTO",
            query,
            count=1,
            flags=re.I
        )
        query = query.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"

    return query


class DatabaseCursor:
    """
    Thin wrapper around psycopg cursor.
    """

    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, params=None):
        translated = translate_sql(query)
        self._cursor.execute(
            translated,
            params or ()
        )
        return self

    def executemany(self, query, params_seq):
        translated = translate_sql(query)
        self._cursor.executemany(
            translated,
            params_seq
        )
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def rowcount(self):
        return self._cursor.rowcount


class DatabaseConnection:
    """
    Wrapper that keeps the rest of the application close to
    the original SQLite version while using PostgreSQL.
    """

    def __init__(self, connection):
        self._connection = connection

    def cursor(self):
        return DatabaseCursor(
            self._connection.cursor()
        )

    def execute(self, query, params=None):
        cursor = self.cursor()
        cursor.execute(
            query,
            params
        )
        return cursor

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()


def connect_database():
    """
    Opens a PostgreSQL connection to Neon.

    DATABASE_URL must be configured in Render and, for local
    development, in the .env file.
    """

    if not DATABASE_URL:

        raise RuntimeError(
            "DATABASE_URL is not configured. "
            "Add the Neon connection string to your environment."
        )

    connection = psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row,
        connect_timeout=10
    )

    return DatabaseConnection(
        connection
    )


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

def initialize_database():
    """
    Creates all PostgreSQL tables defined in database/schema.sql.
    """

    connection = connect_database()
    cursor = connection.cursor()

    with open(
        SCHEMA_PATH,
        "r",
        encoding="utf-8"
    ) as file:

        script = file.read()

    # The schema contains simple DDL statements separated by ';'.
    for statement in script.split(";"):

        statement = statement.strip()

        if statement:

            cursor.execute(
                statement
            )

    connection.commit()
    connection.close()


# =========================================================
# SIMPLE DATABASE MIGRATIONS
# =========================================================

def run_database_migrations():
    """
    Idempotent PostgreSQL migrations for databases created
    with an older version of the MVP.
    """

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash TEXT
        """
    )

    cursor.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS avatar_path TEXT
        """
    )

    cursor.execute(
        """
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS event_image_path TEXT
        """
    )

    cursor.execute(
        """
        ALTER TABLE event_roles
        ADD COLUMN IF NOT EXISTS description TEXT
        """
    )

    connection.commit()
    connection.close()


# =========================================================
# MEDIA STORAGE - SUPABASE
# =========================================================

def get_supabase_client():
    """
    Creates a server-side Supabase client.

    The service-role key must NEVER be placed in JavaScript,
    HTML, GitHub, or any public file.
    """

    if not SUPABASE_URL or not SUPABASE_KEY:

        return None

    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY
    )


def get_media_content_type(extension):
    """
    Returns an image MIME type from the allowed extension.
    """

    extension = extension.lower()

    if extension in {"jpg", "jpeg"}:
        return "image/jpeg"

    if extension == "png":
        return "image/png"

    if extension == "webp":
        return "image/webp"

    return "application/octet-stream"


def asset_url(value):
    """
    Templates can use this for both:
      - Supabase public URLs
      - local static fallback paths
    """

    if not value:
        return ""

    if value.startswith(
        ("http://", "https://")
    ):
        return value

    return url_for(
        "static",
        filename=value
    )


app.jinja_env.globals[
    "asset_url"
] = asset_url


def upload_media(
    file_storage,
    folder,
    filename
):
    """
    Uploads media to Supabase Storage in production.

    When Supabase environment variables are missing, falls
    back to static/ locally so development remains easy.
    """

    safe_filename = secure_filename(
        filename
    )

    extension = (
        safe_filename
        .rsplit(".", 1)[1]
        .lower()
    )

    supabase = get_supabase_client()

    if supabase:

        object_path = (
            f"{folder}/{safe_filename}"
        )

        file_storage.stream.seek(0)

        file_bytes = (
            file_storage.stream.read()
        )

        supabase.storage.from_(
            SUPABASE_BUCKET
        ).upload(
            path=object_path,
            file=file_bytes,
            file_options={
                "content-type": (
                    get_media_content_type(
                        extension
                    )
                ),
                "cache-control": "3600",
                "upsert": "true"
            }
        )

        public_url = (
            supabase.storage
            .from_(SUPABASE_BUCKET)
            .get_public_url(object_path)
        )

        return public_url

    # Local fallback.
    if folder == "avatars":
        target_folder = AVATAR_FOLDER
    else:
        target_folder = EVENT_IMAGE_FOLDER

    os.makedirs(
        target_folder,
        exist_ok=True
    )

    local_path = os.path.join(
        target_folder,
        safe_filename
    )

    file_storage.stream.seek(0)
    file_storage.save(
        local_path
    )

    return f"{folder}/{safe_filename}"


def allowed_avatar_file(filename):
    """
    Checks whether an uploaded avatar uses
    one of the allowed image extensions.
    """

    return (
        "." in filename
        and filename.rsplit(
            ".",
            1
        )[1].lower()
        in ALLOWED_AVATAR_EXTENSIONS
    )


def allowed_event_image_file(filename):
    """
    Checks whether an uploaded event cover uses
    one of the allowed image extensions.
    """

    return allowed_avatar_file(
        filename
    )


# =========================================================
# FORM HELPERS
# =========================================================

def form_text(field_name):
    """
    Safely gets a text field from a POST form.

    Missing fields become an empty string
    instead of raising BadRequestKeyError.
    """

    return request.form.get(
        field_name,
        ""
    ).strip()


# =========================================================
# DATE / TIME HELPERS
# =========================================================

def parse_datetime(value):
    """
    Accepts either PostgreSQL datetime objects
    or ISO date/time strings.

    Returns None when invalid.
    """

    if not value:
        return None

    if isinstance(
        value,
        datetime
    ):

        return value

    if isinstance(
        value,
        str
    ):

        try:

            return datetime.fromisoformat(
                value
            )

        except ValueError:

            return None

    return None


def format_datetime(value):
    """
    Formats PostgreSQL datetime objects or
    ISO date/time strings as:

        13/08/2026 às 15:30
    """

    if not value:
        return ""

    if isinstance(
        value,
        datetime
    ):

        date = value

    elif isinstance(
        value,
        str
    ):

        try:

            date = datetime.fromisoformat(
                value
            )

        except ValueError:

            return value

    else:

        return str(
            value
        )

    return date.strftime(
        "%d/%m/%Y às %H:%M"
    )


# Allows templates to use:
#
# {{ value | datetime_br }}

app.jinja_env.filters[
    "datetime_br"
] = format_datetime


def format_datetime_local(value):
    """
    Formats PostgreSQL datetime objects or ISO strings for
    HTML <input type="datetime-local"> values.

    Example:
        2026-08-14T13:30
    """

    if not value:
        return ""

    if isinstance(value, datetime):

        date = value

    elif isinstance(value, str):

        try:

            date = datetime.fromisoformat(
                value
            )

        except ValueError:

            return value.replace(
                " ",
                "T"
            )

    else:

        return str(
            value
        )

    return date.strftime(
        "%Y-%m-%dT%H:%M"
    )


app.jinja_env.filters[
    "datetime_local"
] = format_datetime_local




# =========================================================
# VALIDATION HELPERS
# =========================================================

def is_valid_username(value):
    """
    Username must not contain spaces.
    """

    if not value:
        return False

    return " " not in value

def is_valid_url(value):
    """
    Accepts normal HTTP/HTTPS URLs.
    """

    if not value:
        return False

    try:

        parsed = urlparse(
            value
        )

        return (
            parsed.scheme in [
                "http",
                "https"
            ]
            and bool(parsed.netloc)
        )

    except ValueError:

        return False


def is_valid_email(value):
    """
    Very small email validation suitable for our MVP.

    We intentionally avoid complex email validation.
    """

    if not value:
        return True

    pattern = (
        r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )

    return bool(
        re.match(
            pattern,
            value
        )
    )

# =========================================================
# AUTHORIZATION DECORATORS
# =========================================================

def login_required(view_function):
    """
    Protects routes that require authentication.

    Besides checking the session, it confirms that
    the user still exists and is still active.
    """

    @wraps(view_function)
    def wrapped_view(*args, **kwargs):

        user_id = session.get(
            "user_id"
        )

        if not user_id:

            return redirect(
                url_for("login")
            )

        connection = connect_database()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                users.id,
                users.name,
                users.user_type,
                users.active,

                projects.name AS project

            FROM users

            JOIN projects
                ON users.project_id =
                   projects.id

            WHERE users.id = ?
            """,
            (
                user_id,
            )
        )

        user = cursor.fetchone()

        connection.close()

        # User was deleted or deactivated.
        if (
            user is None
            or user["active"] == 0
        ):

            session.clear()

            flash(
                "Your account is no longer active."
            )

            return redirect(
                url_for("login")
            )

        # Refresh session information.
        session["user_name"] = (
            user["name"]
        )

        session["project"] = (
            user["project"]
        )

        session["user_type"] = (
            user["user_type"]
        )

        return view_function(
            *args,
            **kwargs
        )

    return wrapped_view


def admin_required(view_function):
    """
    Protects Admin routes.

    The database is checked instead of trusting
    only the user_type stored in the session.
    """

    @wraps(view_function)
    def wrapped_view(*args, **kwargs):

        user_id = session.get(
            "user_id"
        )

        if not user_id:

            return redirect(
                url_for("login")
            )

        connection = connect_database()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                users.id,
                users.name,
                users.user_type,
                users.active,

                projects.name AS project

            FROM users

            JOIN projects
                ON users.project_id =
                   projects.id

            WHERE users.id = ?
            """,
            (
                user_id,
            )
        )

        user = cursor.fetchone()

        connection.close()

        if (
            user is None
            or user["active"] == 0
        ):

            session.clear()

            flash(
                "Your account is no longer active."
            )

            return redirect(
                url_for("login")
            )

        # Keep the session synchronized.
        session["user_name"] = (
            user["name"]
        )

        session["project"] = (
            user["project"]
        )

        session["user_type"] = (
            user["user_type"]
        )

        if user["user_type"] != "admin":

            flash(
                "Você precisa ser administrador para acessar esta área."
            )

            return redirect(
                url_for("home")
            )

        return view_function(
            *args,
            **kwargs
        )

    return wrapped_view

# =========================================================
# NOTIFICATIONS
# =========================================================

def create_notification(
    message,
    notification_type,
    related_entity_type=None,
    related_entity_id=None,
    user_id=None
):
    """
    Creates an internal notification.
    """

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO notifications (
            user_id,
            notification_type,
            message,
            related_entity_type,
            related_entity_id,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            notification_type,
            message,
            related_entity_type,
            related_entity_id,
            now_local().isoformat()
        )
    )

    connection.commit()
    connection.close()


# =========================================================
# INITIAL DATA
# =========================================================

def seed_projects():
    """
    Creates the initial ONG projects.
    """

    connection = connect_database()
    cursor = connection.cursor()

    projects = [
        ("APS",),
        ("PPF",),
        ("SJ",)
    ]

    cursor.executemany(
        """
        INSERT OR IGNORE INTO projects (
            name
        )
        VALUES (?)
        """,
        projects
    )

    connection.commit()
    connection.close()


def seed_roles():
    """
    Creates common media roles.
    """

    connection = connect_database()
    cursor = connection.cursor()

    roles = [
        ("Photography",),
        ("Filmmaker",),
        ("Content Creator",)
    ]

    cursor.executemany(
        """
        INSERT OR IGNORE INTO roles (
            name
        )
        VALUES (?)
        """,
        roles
    )

    connection.commit()
    connection.close()


def seed_initial_admin():
    """
    Ensures that the initial development Admin exists.

    Local development password:
        dev12345

    On Render you should define:

        SEED_ADMIN_PASSWORD

    as an Environment Variable.
    """

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # GET PPF PROJECT
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM projects

        WHERE name = ?
        """,
        (
            "PPF",
        )
    )

    project = cursor.fetchone()

    if project is None:

        connection.close()

        return

    # -----------------------------------------------------
    # GET ADMIN PASSWORD
    # -----------------------------------------------------

    seed_password = os.environ.get(
        "SEED_ADMIN_PASSWORD"
    )

    if not seed_password:

        # Local-only fallback.
        if not os.environ.get("RENDER"):

            seed_password = "dev12345"

        else:

            raise RuntimeError(
                "SEED_ADMIN_PASSWORD must be configured "
                "on Render for the initial Admin."
            )

    # -----------------------------------------------------
    # FIND MIKIO
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            password_hash

        FROM users

        WHERE name = ? COLLATE NOCASE
        AND project_id = ?
        """,
        (
            "Mikio",
            project["id"]
        )
    )

    existing_user = cursor.fetchone()

    # -----------------------------------------------------
    # CREATE ADMIN
    # -----------------------------------------------------

    if existing_user is None:

        cursor.execute(
            """
            INSERT INTO users (
                name,
                project_id,
                user_type,
                password_hash
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                "Mikio",
                project["id"],
                "admin",
                generate_password_hash(
                    seed_password
                )
            )
        )

    # -----------------------------------------------------
    # MIGRATE OLD ADMIN WITHOUT PASSWORD
    # -----------------------------------------------------

    elif not existing_user[
        "password_hash"
    ]:

        cursor.execute(
            """
            UPDATE users

            SET
                password_hash = ?,
                user_type = 'admin'

            WHERE id = ?
            """,
            (
                generate_password_hash(
                    seed_password
                ),
                existing_user["id"]
            )
        )

    connection.commit()
    connection.close()


# =========================================================
# LOGIN
# =========================================================

@app.route(
    "/login",
    methods=["GET", "POST"]
)
def login():
    """
    Authenticates users using:

    - name
    - project
    - password
    """

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # LOAD PROJECTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            name

        FROM projects

        ORDER BY name
        """
    )

    projects = cursor.fetchall()

    # -----------------------------------------------------
    # PROCESS LOGIN
    # -----------------------------------------------------

    if request.method == "POST":

        name = form_text(
            "name"
        )

        project_name = form_text(
            "project"
        )

        password = request.form.get(
            "password",
            ""
        )

        if (
            not name
            or not project_name
            or not password
        ):

            connection.close()

            flash(
                "Preencha todos os campos para entrar."
            )

            return redirect(
                url_for("login")
            )

        # -------------------------------------------------
        # FIND USER
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                users.id,
                users.name,
                users.password_hash,
                users.user_type,

                projects.name AS project

            FROM users

            JOIN projects
                ON users.project_id =
                   projects.id

            WHERE users.name = ?
                COLLATE NOCASE

            AND projects.name = ?
                COLLATE NOCASE

            AND users.active = 1
            """,
            (
                name,
                project_name
            )
        )

        user = cursor.fetchone()

        connection.close()

        # -------------------------------------------------
        # INVALID LOGIN
        # -------------------------------------------------

        if (
            user is None
            or not user["password_hash"]
            or not check_password_hash(
                user["password_hash"],
                password
            )
        ):

            flash(
                "Usuário, projeto ou senha incorretos."
            )

            return redirect(
                url_for("login")
            )

        # -------------------------------------------------
        # RESET OLD SESSION
        # -------------------------------------------------

        session.clear()

        session["user_id"] = (
            user["id"]
        )

        session["user_name"] = (
            user["name"]
        )

        session["project"] = (
            user["project"]
        )

        session["user_type"] = (
            user["user_type"]
        )

        session.permanent = True

        return redirect(
            url_for("home")
        )

    connection.close()

    return render_template(
        "login.html",
        projects=projects
    )


# =========================================================
# LOGOUT
# =========================================================

@app.route("/logout")
@login_required
def logout():

    session.clear()

    return redirect(
        url_for("login")
    )


# =========================================================
# HOME
# =========================================================

@app.route("/")
@login_required
def home():

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # CURRENT USER
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            users.id,
            users.name,
            users.avatar_path,
            projects.name AS project
        FROM users
        JOIN projects
            ON users.project_id = projects.id
        WHERE users.id = ?
        """,
        (session["user_id"],)
    )

    current_user = cursor.fetchone()


    # -----------------------------------------------------
    # CONFIRMED VOLUNTEERS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            users.name,
            users.avatar_path,

            projects.name AS project,

            roles.name AS role,

            events.name AS event_name

        FROM confirmations

        JOIN users
            ON confirmations.user_id =
               users.id

        JOIN projects
            ON users.project_id =
               projects.id

        JOIN event_roles
            ON confirmations.event_role_id =
               event_roles.id

        JOIN roles
            ON event_roles.role_id =
               roles.id

        JOIN events
            ON event_roles.event_id =
               events.id

        WHERE confirmations.status =
            'confirmed'

        ORDER BY
            events.event_date,
            users.name
        """
    )

    confirmations = cursor.fetchall()

    # -----------------------------------------------------
    # MY CONFIRMATIONS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            confirmations.id,

            roles.name AS role,

            events.name AS event_name,

            CASE
                WHEN datetime(
                    events.confirmation_deadline
                )
                >= datetime(
                    'now',
                    'localtime'
                )

                THEN 1
                ELSE 0
            END AS cancellation_open

        FROM confirmations

        JOIN event_roles
            ON confirmations.event_role_id =
               event_roles.id

        JOIN roles
            ON event_roles.role_id =
               roles.id

        JOIN events
            ON event_roles.event_id =
               events.id

        WHERE confirmations.user_id = ?
        AND confirmations.status =
            'confirmed'

        ORDER BY
            events.event_date,
            roles.name
        """,
        (
            session["user_id"],
        )
    )

    my_confirmations = cursor.fetchall()

    # -----------------------------------------------------
    # NEXT EVENT
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            events.id,
            events.name,
            events.event_date,
            events.event_time,
            events.location,
            events.sympla_link,
            events.event_image_path,

            projects.name AS project

        FROM events

        LEFT JOIN projects
            ON events.project_id =
               projects.id

        WHERE events.active = 1

        AND events.event_date
            >= DATE(
                'now',
                'localtime'
            )

        ORDER BY
            events.event_date ASC,
            events.event_time ASC

        LIMIT 1
        """
    )

    next_event = cursor.fetchone()

    # -----------------------------------------------------
    # NEXT EVENT ROLES
    # -----------------------------------------------------

    event_roles = []

    if next_event:

        cursor.execute(
            """
            SELECT
                event_roles.id,

                roles.name,

                event_roles.vacancy_limit,
                event_roles.description,

                COUNT(
                    confirmations.id
                ) AS confirmed_count,

                CASE
                    WHEN datetime(
                        events.confirmation_deadline
                    )
                    >= datetime(
                        'now',
                        'localtime'
                    )

                    THEN 1
                    ELSE 0
                END AS confirmation_open

            FROM event_roles

            JOIN roles
                ON event_roles.role_id =
                   roles.id

            JOIN events
                ON event_roles.event_id =
                   events.id

            LEFT JOIN confirmations
                ON confirmations.event_role_id =
                   event_roles.id

                AND confirmations.status =
                    'confirmed'

            WHERE event_roles.event_id = ?

            AND event_roles.active = 1

            AND events.active = 1

            GROUP BY
                event_roles.id,
                roles.name,
                event_roles.vacancy_limit,
                event_roles.description,
                events.confirmation_deadline

            ORDER BY roles.name
            """,
            (
                next_event["id"],
            )
        )

        event_roles = cursor.fetchall()

    # -----------------------------------------------------
    # AVAILABLE TASKS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            tasks.id,
            tasks.title,
            tasks.description,
            tasks.deadline,
            tasks.priority,
            tasks.status,
            tasks.volunteer_limit,

            COUNT(
                task_users.id
            ) AS volunteer_count,

            CASE
                WHEN datetime(
                    tasks.deadline
                )
                < datetime(
                    'now',
                    'localtime'
                )

                THEN 1
                ELSE 0
            END AS overdue

        FROM tasks

        LEFT JOIN task_users
            ON task_users.task_id =
               tasks.id

            AND task_users.status =
                'active'

        WHERE tasks.active = 1

        AND tasks.status !=
            'completed'

        GROUP BY
            tasks.id,
            tasks.title,
            tasks.description,
            tasks.deadline,
            tasks.priority,
            tasks.status,
            tasks.volunteer_limit

        ORDER BY
            CASE tasks.priority
                WHEN 'urgent' THEN 1
                WHEN 'important' THEN 2
                ELSE 3
            END,

            tasks.deadline ASC
        """
    )

    tasks = cursor.fetchall()

    # -----------------------------------------------------
    # MY TASKS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            task_users.id AS participation_id,
            task_users.delivery_link,
            task_users.submitted_at,

            tasks.id AS task_id,
            tasks.title,
            tasks.description,
            tasks.deadline,
            tasks.priority,
            tasks.status

        FROM task_users

        JOIN tasks
            ON task_users.task_id =
               tasks.id

        WHERE task_users.user_id = ?

        AND task_users.status =
            'active'

        AND tasks.active = 1

        ORDER BY
            tasks.deadline ASC
        """,
        (
            session["user_id"],
        )
    )

    my_tasks = cursor.fetchall()

    # -----------------------------------------------------
    # ANNOUNCEMENTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            announcements.id,
            announcements.title,
            announcements.message,
            announcements.priority,
            announcements.created_at,

            users.name AS created_by_name

        FROM announcements

        JOIN users
            ON announcements.created_by =
               users.id

        WHERE announcements.active = 1

        ORDER BY
            CASE announcements.priority
                WHEN 'urgent' THEN 1
                WHEN 'important' THEN 2
                ELSE 3
            END,

            announcements.created_at DESC
        """
    )

    announcements = cursor.fetchall()

    connection.close()

    return render_template(
        "index.html",
        current_user=current_user,

        confirmations=confirmations,

        my_confirmations=(
            my_confirmations
        ),

        next_event=next_event,

        event_roles=event_roles,

        tasks=tasks,

        my_tasks=my_tasks,

        announcements=announcements
    )


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@app.route("/admin")
@admin_required
def admin():

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # EVENTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            events.id,
            events.name,
            events.project_id,
            events.event_type,
            events.event_date,
            events.event_time,
            events.location,
            events.confirmation_deadline,
            events.sympla_link,
            events.event_image_path,
            events.active,

            projects.name AS project

        FROM events

        LEFT JOIN projects
            ON events.project_id =
               projects.id

        ORDER BY
            events.event_date ASC
        """
    )

    events = cursor.fetchall()

    # -----------------------------------------------------
    # PROJECTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            name

        FROM projects

        ORDER BY name
        """
    )

    projects = cursor.fetchall()

    # -----------------------------------------------------
    # ROLES
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            name

        FROM roles

        ORDER BY name
        """
    )

    roles = cursor.fetchall()

    # -----------------------------------------------------
    # CONFIRMED VOLUNTEERS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            users.name,

            projects.name AS project,

            roles.name AS role,

            events.name AS event_name

        FROM confirmations

        JOIN users
            ON confirmations.user_id =
               users.id

        JOIN projects
            ON users.project_id =
               projects.id

        JOIN event_roles
            ON confirmations.event_role_id =
               event_roles.id

        JOIN roles
            ON event_roles.role_id =
               roles.id

        JOIN events
            ON event_roles.event_id =
               events.id

        WHERE confirmations.status =
            'confirmed'

        ORDER BY
            events.event_date,
            roles.name,
            users.name
        """
    )

    confirmed_volunteers = (
        cursor.fetchall()
    )

    # -----------------------------------------------------
    # EVENT ROLES
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            event_roles.id,
            event_roles.active,

            events.name AS event_name,
            events.event_date,

            roles.name AS role_name,

            event_roles.vacancy_limit,
            event_roles.description,

            COUNT(
                confirmations.id
            ) AS confirmed_count,

            (
                event_roles.vacancy_limit
                -
                COUNT(
                    confirmations.id
                )
            ) AS remaining_count

        FROM event_roles

        JOIN events
            ON event_roles.event_id =
               events.id

        JOIN roles
            ON event_roles.role_id =
               roles.id

        LEFT JOIN confirmations
            ON confirmations.event_role_id =
               event_roles.id

            AND confirmations.status =
                'confirmed'

        GROUP BY
            event_roles.id,
            event_roles.active,
            events.name,
            events.event_date,
            roles.name,
            event_roles.vacancy_limit,
            event_roles.description

        ORDER BY
            events.event_date,
            roles.name
        """
    )

    event_role_summary = cursor.fetchall()

    # -----------------------------------------------------
    # TASKS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            tasks.id,
            tasks.title,
            tasks.description,
            tasks.event_id,
            tasks.deadline,
            tasks.priority,
            tasks.status,
            tasks.volunteer_limit,
            tasks.active,
            tasks.created_at,

            events.name AS event_name,

            CASE
                WHEN datetime(tasks.deadline)
                    < datetime(
                        'now',
                        'localtime'
                    )

                AND tasks.status !=
                    'completed'

                THEN 1

                ELSE 0
            END AS overdue

        FROM tasks

        LEFT JOIN events
            ON tasks.event_id =
               events.id

        ORDER BY
            tasks.active DESC,
            tasks.deadline ASC
        """
    )

    tasks = cursor.fetchall()

    # -----------------------------------------------------
    # TASK PARTICIPANTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            task_users.task_id,
            task_users.delivery_link,
            task_users.submitted_at,

            users.name AS volunteer_name,

            projects.name AS project

        FROM task_users

        JOIN users
            ON task_users.user_id =
               users.id

        JOIN projects
            ON users.project_id =
               projects.id

        WHERE task_users.status =
            'active'

        ORDER BY
            task_users.task_id,
            users.name
        """
    )

    task_participants = (
        cursor.fetchall()
    )

    # -----------------------------------------------------
    # NOTIFICATIONS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            notification_type,
            message,
            related_entity_type,
            related_entity_id,
            read,
            created_at

        FROM notifications

        ORDER BY
            read ASC,
            created_at DESC

        LIMIT 100
        """
    )

    notifications = cursor.fetchall()

    cursor.execute(
        """
        SELECT
            COUNT(*) AS unread_count

        FROM notifications

        WHERE read = 0
        """
    )

    unread_notifications = (
        cursor.fetchone()[
            "unread_count"
        ]
    )

    # -----------------------------------------------------
    # USERS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            users.id,
            users.name,
            users.email,
            users.avatar_path,
            users.user_type,
            users.active,
            users.project_id,

            projects.name AS project

        FROM users

        JOIN projects
            ON users.project_id =
               projects.id

        ORDER BY
            users.active DESC,
            users.name
        """
    )

    users = cursor.fetchall()

    # -----------------------------------------------------
    # ANNOUNCEMENTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            announcements.id,
            announcements.title,
            announcements.message,
            announcements.priority,
            announcements.active,
            announcements.created_at,

            users.name AS created_by_name

        FROM announcements

        JOIN users
            ON announcements.created_by =
               users.id

        ORDER BY
            announcements.active DESC,
            announcements.created_at DESC
        """
    )

    announcements = cursor.fetchall()

    connection.close()

    return render_template(
        "admin.html",

        events=events,

        projects=projects,

        roles=roles,

        confirmed_volunteers=(
            confirmed_volunteers
        ),

        event_role_summary=(
            event_role_summary
        ),

        tasks=tasks,

        task_participants=(
            task_participants
        ),

        notifications=notifications,

        unread_notifications=(
            unread_notifications
        ),

        users=users,

        announcements=announcements
    )

# =========================================================
# ADMIN - UPDATE USER AVATAR
# =========================================================

@app.route(
    "/admin/users/<int:user_id>/avatar",
    methods=["POST"]
)
@admin_required
def update_user_avatar(user_id):

    avatar = request.files.get(
        "avatar"
    )

    if (
        avatar is None
        or avatar.filename == ""
    ):

        flash(
            "Please select an image."
        )

        return redirect(
            url_for("admin")
        )

    if not allowed_avatar_file(
        avatar.filename
    ):

        flash(
            "Invalid image format."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            avatar_path

        FROM users

        WHERE id = ?
        """,
        (
            user_id,
        )
    )

    user = cursor.fetchone()

    if user is None:

        connection.close()

        flash(
            "Usuário não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    extension = (
        avatar.filename
        .rsplit(".", 1)[1]
        .lower()
    )

    filename = (
        f"user_{user_id}.{extension}"
    )

    avatar_path = upload_media(
        avatar,
        "avatars",
        filename
    )

    cursor.execute(
        """
        UPDATE users

        SET avatar_path = ?

        WHERE id = ?
        """,
        (
            avatar_path,
            user_id
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Avatar updated successfully!"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - CREATE USER
# =========================================================

@app.route(
    "/admin/users/create",
    methods=["POST"]
)
@admin_required
def create_user():

    name = form_text(
        "name"
    )

    project_id = form_text(
        "project_id"
    )

    email = form_text(
        "email"
    )

    user_type = form_text(
        "user_type"
    )

    password = request.form.get(
        "password",
        ""
    )

    # -----------------------------------------------------
    # REQUIRED FIELDS
    # -----------------------------------------------------

    if (
        not name
        or not project_id
        or not user_type
        or not password
    ):

        flash(
            "Preencha todos os campos obrigatórios do usuário."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # USERNAME
    # -----------------------------------------------------

    if not is_valid_username(name):

        flash(
            "Username cannot contain spaces."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # PASSWORD
    # -----------------------------------------------------

    if len(password) < MIN_PASSWORD_LENGTH:

        flash(
            f"Password must contain at least "
            f"{MIN_PASSWORD_LENGTH} characters."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # USER TYPE
    # -----------------------------------------------------

    if user_type not in [
        "volunteer",
        "admin"
    ]:

        flash(
            "Tipo de usuário inválido."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # EMAIL
    # -----------------------------------------------------

    if email and not is_valid_email(
        email
    ):

        flash(
            "E-mail inválido."
        )

        return redirect(
            url_for("admin")
        )

    email = (
        email
        or None
    )

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # PROJECT EXISTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM projects

        WHERE id = ?
        """,
        (
            project_id,
        )
    )

    if cursor.fetchone() is None:

        connection.close()

        flash(
            "Projeto não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # DUPLICATE USER
    # -----------------------------------------------------
    # Username is unique inside the same project.

    cursor.execute(
        """
        SELECT id

        FROM users

        WHERE name = ?
            COLLATE NOCASE

        AND project_id = ?
        """,
        (
            name,
            project_id
        )
    )

    if cursor.fetchone():

        connection.close()

        flash(
            "This username already exists in this project."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # CREATE USER
    # -----------------------------------------------------

    cursor.execute(
        """
        INSERT INTO users (
            name,
            project_id,
            email,
            user_type,
            password_hash
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            name,
            project_id,
            email,
            user_type,
            generate_password_hash(
                password
            )
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Usuário criado com sucesso!"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - UPDATE USER
# =========================================================

@app.route(
    "/admin/users/<int:user_id>/update",
    methods=["POST"]
)
@admin_required
def update_user(user_id):

    name = form_text(
        "name"
    )

    project_id = form_text(
        "project_id"
    )

    email = form_text(
        "email"
    )

    user_type = form_text(
        "user_type"
    )

    new_password = request.form.get(
        "password",
        ""
    )

    # -----------------------------------------------------
    # REQUIRED FIELDS
    # -----------------------------------------------------

    if (
        not name
        or not project_id
        or not user_type
    ):

        flash(
            "Preencha todos os campos obrigatórios do usuário."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # USERNAME
    # -----------------------------------------------------

    if not is_valid_username(name):

        flash(
            "Username cannot contain spaces."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # USER TYPE
    # -----------------------------------------------------

    if user_type not in [
        "volunteer",
        "admin"
    ]:

        flash(
            "Tipo de usuário inválido."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # EMAIL
    # -----------------------------------------------------

    if email and not is_valid_email(
        email
    ):

        flash(
            "E-mail inválido."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # OPTIONAL PASSWORD CHANGE
    # -----------------------------------------------------

    if (
        new_password
        and len(new_password) < MIN_PASSWORD_LENGTH
    ):

        flash(
            f"New password must contain at least "
            f"{MIN_PASSWORD_LENGTH} characters."
        )

        return redirect(
            url_for("admin")
        )

    email = (
        email
        or None
    )

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # CURRENT USER
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            user_type,
            active

        FROM users

        WHERE id = ?
        """,
        (
            user_id,
        )
    )

    current_user = cursor.fetchone()

    if current_user is None:

        connection.close()

        flash(
            "Usuário não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # PROJECT EXISTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM projects

        WHERE id = ?
        """,
        (
            project_id,
        )
    )

    if cursor.fetchone() is None:

        connection.close()

        flash(
            "Projeto não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # DUPLICATE USER
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM users

        WHERE name = ?
            COLLATE NOCASE

        AND project_id = ?

        AND id != ?
        """,
        (
            name,
            project_id,
            user_id
        )
    )

    if cursor.fetchone():

        connection.close()

        flash(
            "Another user with this username already exists "
            "in this project."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # PROTECT LAST ADMIN
    # -----------------------------------------------------

    if (
        current_user["user_type"] == "admin"
        and current_user["active"] == 1
        and user_type != "admin"
    ):

        cursor.execute(
            """
            SELECT
                COUNT(*) AS admin_count

            FROM users

            WHERE user_type = 'admin'
            AND active = 1
            """
        )

        admin_count = (
            cursor.fetchone()[
                "admin_count"
            ]
        )

        if admin_count <= 1:

            connection.close()

            flash(
                "A Central precisa ter pelo menos um administrador ativo."
            )

            return redirect(
                url_for("admin")
            )

    # -----------------------------------------------------
    # UPDATE USER
    # -----------------------------------------------------

    if new_password:

        cursor.execute(
            """
            UPDATE users

            SET
                name = ?,
                project_id = ?,
                email = ?,
                user_type = ?,
                password_hash = ?

            WHERE id = ?
            """,
            (
                name,
                project_id,
                email,
                user_type,
                generate_password_hash(
                    new_password
                ),
                user_id
            )
        )

    else:

        cursor.execute(
            """
            UPDATE users

            SET
                name = ?,
                project_id = ?,
                email = ?,
                user_type = ?

            WHERE id = ?
            """,
            (
                name,
                project_id,
                email,
                user_type,
                user_id
            )
        )

    connection.commit()
    connection.close()

    flash(
        "Usuário atualizado com sucesso!"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - DEACTIVATE USER
# =========================================================

@app.route(
    "/admin/users/<int:user_id>/deactivate",
    methods=["POST"]
)
@admin_required
def deactivate_user(user_id):

    # Admin cannot deactivate themselves.
    if user_id == session["user_id"]:

        flash(
            "Você não pode desativar a própria conta."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            active,
            user_type

        FROM users

        WHERE id = ?
        """,
        (
            user_id,
        )
    )

    user = cursor.fetchone()

    if user is None:

        connection.close()

        flash(
            "Usuário não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    if user["active"] == 0:

        connection.close()

        flash(
            "Esse usuário já está inativo."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # PROTECT LAST ADMIN
    # -----------------------------------------------------

    if user["user_type"] == "admin":

        cursor.execute(
            """
            SELECT
                COUNT(*) AS admin_count

            FROM users

            WHERE user_type =
                'admin'

            AND active = 1
            """
        )

        admin_count = (
            cursor.fetchone()[
                "admin_count"
            ]
        )

        if admin_count <= 1:

            connection.close()

            flash(
                "A Central precisa ter pelo menos um administrador ativo."
            )

            return redirect(
                url_for("admin")
            )

    cursor.execute(
        """
        UPDATE users

        SET active = 0

        WHERE id = ?
        """,
        (
            user_id,
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Usuário desativado com sucesso."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - REACTIVATE USER
# =========================================================

@app.route(
    "/admin/users/<int:user_id>/reactivate",
    methods=["POST"]
)
@admin_required
def reactivate_user(user_id):

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            active

        FROM users

        WHERE id = ?
        """,
        (
            user_id,
        )
    )

    user = cursor.fetchone()

    if user is None:

        connection.close()

        flash(
            "Usuário não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    if user["active"] == 1:

        connection.close()

        flash(
            "Esse usuário já está ativo."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE users

        SET active = 1

        WHERE id = ?
        """,
        (
            user_id,
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Usuário reativado com sucesso."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - CREATE EVENT
# =========================================================

@app.route(
    "/admin/events/create",
    methods=["POST"]
)
@admin_required
def create_event():

    name = form_text(
        "name"
    )

    project_id = form_text(
        "project_id"
    )

    event_date = form_text(
        "event_date"
    )

    event_time = form_text(
        "event_time"
    )

    location = form_text(
        "location"
    )

    confirmation_deadline = form_text(
        "confirmation_deadline"
    )

    sympla_link = form_text(
        "sympla_link"
    )

    event_type = form_text(
        "event_type"
    )

    project_id = (
        project_id
        or None
    )

    sympla_link = (
        sympla_link
        or None
    )

    if (
        not name
        or not event_date
        or not event_time
        or not location
        or not confirmation_deadline
    ):

        flash(
            "Preencha todos os campos obrigatórios do evento."
        )

        return redirect(
            url_for("admin")
        )

    if event_type not in [
        "specific",
        "general"
    ]:

        flash(
            "Tipo de evento inválido."
        )

        return redirect(
            url_for("admin")
        )

    event_datetime = parse_datetime(
        f"{event_date}T{event_time}"
    )

    deadline_datetime = parse_datetime(
        confirmation_deadline
    )

    if (
        event_datetime is None
        or deadline_datetime is None
    ):

        flash(
            "Data do evento ou prazo de confirmação inválido."
        )

        return redirect(
            url_for("admin")
        )

    if (
        deadline_datetime
        >= event_datetime
    ):

        flash(
            "O prazo de confirmação precisa terminar antes do evento."
        )

        return redirect(
            url_for("admin")
        )

    if (
        sympla_link
        and not is_valid_url(
            sympla_link
        )
    ):

        flash(
            "Link do Sympla inválido."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # PROJECT VALIDATION
    # -----------------------------------------------------

    if project_id:

        cursor.execute(
            """
            SELECT id

            FROM projects

            WHERE id = ?
            """,
            (
                project_id,
            )
        )

        if cursor.fetchone() is None:

            connection.close()

            flash(
                "O projeto selecionado não existe."
            )

            return redirect(
                url_for("admin")
            )

    try:

        cursor.execute(
            """
            INSERT INTO events (
                name,
                project_id,
                event_date,
                event_time,
                location,
                confirmation_deadline,
                sympla_link,
                event_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                project_id,
                event_date,
                event_time,
                location,
                confirmation_deadline,
                sympla_link,
                event_type
            )
        )

        connection.commit()

        flash(
            "Evento criado com sucesso!"
        )

    except IntegrityError:

        connection.rollback()

        flash(
            "Já existe um evento com esse nome nessa data."
        )

    finally:

        connection.close()

    return redirect(
        url_for("admin")
    )



# =========================================================
# ADMIN - UPDATE EVENT IMAGE
# =========================================================

@app.route(
    "/admin/events/<int:event_id>/image",
    methods=["POST"]
)
@admin_required
def update_event_image(event_id):
    """
    Uploads or replaces the cover image of an event.
    """

    event_image = request.files.get(
        "event_image"
    )

    if (
        event_image is None
        or event_image.filename == ""
    ):

        flash(
            "Selecione uma imagem para o evento."
        )

        return redirect(
            url_for("admin")
        )

    if not allowed_event_image_file(
        event_image.filename
    ):

        flash(
            "Formato inválido. Use PNG, JPG, JPEG ou WEBP."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            event_image_path

        FROM events

        WHERE id = ?
        """,
        (
            event_id,
        )
    )

    event = cursor.fetchone()

    if event is None:

        connection.close()

        flash(
            "Evento não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    extension = (
        event_image.filename
        .rsplit(".", 1)[1]
        .lower()
    )

    filename = (
        f"event_{event_id}.{extension}"
    )

    event_image_path = upload_media(
        event_image,
        "event_images",
        filename
    )

    cursor.execute(
        """
        UPDATE events

        SET event_image_path = ?

        WHERE id = ?
        """,
        (
            event_image_path,
            event_id
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Capa do evento atualizada com sucesso! 📸"
    )

    return redirect(
        url_for("admin")
    )

# =========================================================
# ADMIN - UPDATE EVENT
# =========================================================

@app.route(
    "/admin/events/<int:event_id>/update",
    methods=["POST"]
)
@admin_required
def update_event(event_id):

    name = form_text(
        "name"
    )

    project_id = form_text(
        "project_id"
    )

    event_type = form_text(
        "event_type"
    )

    event_date = form_text(
        "event_date"
    )

    event_time = form_text(
        "event_time"
    )

    location = form_text(
        "location"
    )

    confirmation_deadline = form_text(
        "confirmation_deadline"
    )

    sympla_link = form_text(
        "sympla_link"
    )

    project_id = (
        project_id
        or None
    )

    sympla_link = (
        sympla_link
        or None
    )

    if (
        not name
        or not event_date
        or not event_time
        or not location
        or not confirmation_deadline
    ):

        flash(
            "Preencha todos os campos obrigatórios do evento."
        )

        return redirect(
            url_for("admin")
        )

    if event_type not in [
        "specific",
        "general"
    ]:

        flash(
            "Tipo de evento inválido."
        )

        return redirect(
            url_for("admin")
        )

    event_datetime = parse_datetime(
        f"{event_date}T{event_time}"
    )

    deadline_datetime = parse_datetime(
        confirmation_deadline
    )

    if (
        event_datetime is None
        or deadline_datetime is None
    ):

        flash(
            "Data do evento ou prazo inválido."
        )

        return redirect(
            url_for("admin")
        )

    if deadline_datetime >= event_datetime:

        flash(
            "O prazo de confirmação precisa terminar antes do evento."
        )

        return redirect(
            url_for("admin")
        )

    if (
        sympla_link
        and not is_valid_url(
            sympla_link
        )
    ):

        flash(
            "Link do Sympla inválido."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id

        FROM events

        WHERE id = ?
        """,
        (
            event_id,
        )
    )

    if cursor.fetchone() is None:

        connection.close()

        flash(
            "Evento não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    if project_id:

        cursor.execute(
            """
            SELECT id

            FROM projects

            WHERE id = ?
            """,
            (
                project_id,
            )
        )

        if cursor.fetchone() is None:

            connection.close()

            flash(
                "O projeto selecionado não existe."
            )

            return redirect(
                url_for("admin")
            )

    try:

        cursor.execute(
            """
            UPDATE events

            SET
                name = ?,
                project_id = ?,
                event_type = ?,
                event_date = ?,
                event_time = ?,
                location = ?,
                confirmation_deadline = ?,
                sympla_link = ?

            WHERE id = ?
            """,
            (
                name,
                project_id,
                event_type,
                event_date,
                event_time,
                location,
                confirmation_deadline,
                sympla_link,
                event_id
            )
        )

        connection.commit()

        flash(
            "Evento atualizado com sucesso!"
        )

    except IntegrityError:

        connection.rollback()

        flash(
            "Já existe outro evento com esse nome nessa data."
        )

    finally:

        connection.close()

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - EVENT ACTIVE STATUS
# =========================================================

@app.route(
    "/admin/events/<int:event_id>/deactivate",
    methods=["POST"]
)
@admin_required
def deactivate_event(event_id):

    return set_event_active_status(
        event_id,
        0
    )


@app.route(
    "/admin/events/<int:event_id>/reactivate",
    methods=["POST"]
)
@admin_required
def reactivate_event(event_id):

    return set_event_active_status(
        event_id,
        1
    )


def set_event_active_status(
    event_id,
    active
):

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            active

        FROM events

        WHERE id = ?
        """,
        (
            event_id,
        )
    )

    event = cursor.fetchone()

    if event is None:

        connection.close()

        flash(
            "Evento não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE events

        SET active = ?

        WHERE id = ?
        """,
        (
            active,
            event_id
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Status do evento atualizado com sucesso."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - CREATE EVENT ROLE
# =========================================================

@app.route(
    "/admin/event-roles/create",
    methods=["POST"]
)
@admin_required
def create_event_role():

    event_id = form_text(
        "event_id"
    )

    role_id = form_text(
        "role_id"
    )

    vacancy_limit = form_text(
        "vacancy_limit"
    )

    description = form_text(
        "description"
    )

    if (
        not event_id
        or not role_id
        or not vacancy_limit
    ):

        flash(
            "Preencha todos os campos da função."
        )

        return redirect(
            url_for("admin")
        )

    try:

        vacancy_limit = int(
            vacancy_limit
        )

    except ValueError:

        flash(
            "A quantidade de vagas precisa ser um número."
        )

        return redirect(
            url_for("admin")
        )

    if vacancy_limit < 1:

        flash(
            "É necessário abrir pelo menos 1 vaga."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # EVENT EXISTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM events

        WHERE id = ?
        """,
        (
            event_id,
        )
    )

    if cursor.fetchone() is None:

        connection.close()

        flash(
            "Evento não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # ROLE EXISTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM roles

        WHERE id = ?
        """,
        (
            role_id,
        )
    )

    if cursor.fetchone() is None:

        connection.close()

        flash(
            "Função não encontrada."
        )

        return redirect(
            url_for("admin")
        )

    try:

        cursor.execute(
            """
            INSERT INTO event_roles (
                event_id,
                role_id,
                vacancy_limit,
                description
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                event_id,
                role_id,
                vacancy_limit,
                description or None
            )
        )

        connection.commit()

        flash(
            "Função adicionada ao evento com sucesso!"
        )

    except IntegrityError:

        connection.rollback()

        flash(
            "Essa função já existe neste evento."
        )

    finally:

        connection.close()

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - UPDATE EVENT ROLE
# =========================================================

@app.route(
    "/admin/event-roles/<int:event_role_id>/update",
    methods=["POST"]
)
@admin_required
def update_event_role(event_role_id):

    vacancy_limit = form_text(
        "vacancy_limit"
    )

    description = form_text(
        "description"
    )

    try:

        vacancy_limit = int(
            vacancy_limit
        )

    except ValueError:

        flash(
            "A quantidade de vagas precisa ser um número."
        )

        return redirect(
            url_for("admin")
        )

    if vacancy_limit < 1:

        flash(
            "É necessário abrir pelo menos 1 vaga."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            event_roles.id,

            COUNT(
                confirmations.id
            ) AS confirmed_count

        FROM event_roles

        LEFT JOIN confirmations
            ON confirmations.event_role_id =
               event_roles.id

            AND confirmations.status =
                'confirmed'

        WHERE event_roles.id = ?

        GROUP BY
            event_roles.id
        """,
        (
            event_role_id,
        )
    )

    event_role = cursor.fetchone()

    if event_role is None:

        connection.close()

        flash(
            "Função do evento não encontrada."
        )

        return redirect(
            url_for("admin")
        )

    if (
        vacancy_limit
        < event_role["confirmed_count"]
    ):

        connection.close()

        flash(
            "O limite de vagas não pode ser menor que o número de voluntários confirmados."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE event_roles

        SET
            vacancy_limit = ?,
            description = ?

        WHERE id = ?
        """,
        (
            vacancy_limit,
            description or None,
            event_role_id
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Quantidade de vagas atualizada com sucesso!"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - EVENT ROLE ACTIVE STATUS
# =========================================================

@app.route(
    "/admin/event-roles/<int:event_role_id>/deactivate",
    methods=["POST"]
)
@admin_required
def deactivate_event_role(
    event_role_id
):

    return set_event_role_active_status(
        event_role_id,
        0
    )


@app.route(
    "/admin/event-roles/<int:event_role_id>/reactivate",
    methods=["POST"]
)
@admin_required
def reactivate_event_role(
    event_role_id
):

    return set_event_role_active_status(
        event_role_id,
        1
    )


def set_event_role_active_status(
    event_role_id,
    active
):

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id

        FROM event_roles

        WHERE id = ?
        """,
        (
            event_role_id,
        )
    )

    if cursor.fetchone() is None:

        connection.close()

        flash(
            "Função do evento não encontrada."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE event_roles

        SET active = ?

        WHERE id = ?
        """,
        (
            active,
            event_role_id
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Status da função atualizado com sucesso."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# CONFIRM EVENT ROLE
# =========================================================

@app.route(
    "/confirm/<int:event_role_id>",
    methods=["POST"]
)
@login_required
def confirm(event_role_id):

    user_id = session["user_id"]

    connection = connect_database()

    # BEGIN IMMEDIATE helps reduce the chance of two
    # volunteers taking the final vacancy simultaneously.
    connection.execute(
        "BEGIN IMMEDIATE"
    )

    cursor = connection.cursor()

    try:

        # -------------------------------------------------
        # PREVIOUS CONFIRMATION
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                status

            FROM confirmations

            WHERE user_id = ?
            AND event_role_id = ?
            """,
            (
                user_id,
                event_role_id
            )
        )

        confirmation = cursor.fetchone()

        if (
            confirmation
            and confirmation["status"]
            == "confirmed"
        ):

            connection.rollback()
            connection.close()

            flash(
                "Você já está confirmado nesta função."
            )

            return redirect(
                url_for("home")
            )

        # -------------------------------------------------
        # ROLE + EVENT
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                event_roles.id,
                event_roles.vacancy_limit,
                event_roles.active,

                events.active AS event_active,
                events.confirmation_deadline,
                events.name AS event_name,

                roles.name AS role_name,

                COUNT(
                    confirmations.id
                ) AS confirmed_count

            FROM event_roles

            JOIN events
                ON event_roles.event_id =
                   events.id

            JOIN roles
                ON event_roles.role_id =
                   roles.id

            LEFT JOIN confirmations
                ON confirmations.event_role_id =
                   event_roles.id

                AND confirmations.status =
                    'confirmed'

            WHERE event_roles.id = ?

            GROUP BY
                event_roles.id,
                event_roles.vacancy_limit,
                event_roles.active,
                events.active,
                events.confirmation_deadline,
                events.name,
                roles.name
            """,
            (
                event_role_id,
            )
        )

        event_role = cursor.fetchone()

        if event_role is None:

            connection.rollback()
            connection.close()

            flash(
                "Função não encontrada."
            )

            return redirect(
                url_for("home")
            )

        if (
            event_role["active"] == 0
            or event_role["event_active"] == 0
        ):

            connection.rollback()
            connection.close()

            flash(
                "Essa função não está mais disponível."
            )

            return redirect(
                url_for("home")
            )

        deadline = parse_datetime(
            event_role[
                "confirmation_deadline"
            ]
        )

        if (
            deadline is None
            or now_local() > deadline
        ):

            connection.rollback()
            connection.close()

            flash(
                "O prazo para confirmação já terminou."
            )

            return redirect(
                url_for("home")
            )

        if (
            event_role["confirmed_count"]
            >= event_role["vacancy_limit"]
        ):

            connection.rollback()
            connection.close()

            flash(
                "Essa função já está com a equipe completa."
            )

            return redirect(
                url_for("home")
            )

        # -------------------------------------------------
        # RESTORE
        # -------------------------------------------------

        if confirmation:

            cursor.execute(
                """
                UPDATE confirmations

                SET
                    status = 'confirmed',
                    cancellation_reason = NULL,
                    cancelled_at = NULL

                WHERE id = ?
                """,
                (
                    confirmation["id"],
                )
            )

        # -------------------------------------------------
        # FIRST CONFIRMATION
        # -------------------------------------------------

        else:

            cursor.execute(
                """
                INSERT INTO confirmations (
                    user_id,
                    event_role_id
                )
                VALUES (?, ?)
                """,
                (
                    user_id,
                    event_role_id
                )
            )

        connection.commit()

        role_name = (
            event_role["role_name"]
        )

        event_name = (
            event_role["event_name"]
        )

    except Exception:

        connection.rollback()
        connection.close()

        raise

    connection.close()

    create_notification(
        message=(
            f'{session["user_name"]} confirmed '
            f'{role_name} for {event_name}.'
        ),
        notification_type=(
            "event_confirmation_created"
        ),
        related_entity_type=(
            "event_role"
        ),
        related_entity_id=(
            event_role_id
        )
    )

    flash(
        "Presença confirmada! ❤️"
    )

    return redirect(
        url_for("home")
    )


# =========================================================
# CANCEL EVENT CONFIRMATION
# =========================================================

@app.route(
    "/confirmations/<int:confirmation_id>/cancel",
    methods=["POST"]
)
@login_required
def cancel_confirmation(
    confirmation_id
):

    cancellation_reason = form_text(
        "cancellation_reason"
    )

    if not cancellation_reason:

        flash(
            "Conte o motivo do cancelamento."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            confirmations.id,
            confirmations.status,

            events.confirmation_deadline,
            events.name AS event_name,

            roles.name AS role_name

        FROM confirmations

        JOIN event_roles
            ON confirmations.event_role_id =
               event_roles.id

        JOIN events
            ON event_roles.event_id =
               events.id

        JOIN roles
            ON event_roles.role_id =
               roles.id

        WHERE confirmations.id = ?

        AND confirmations.user_id = ?
        """,
        (
            confirmation_id,
            session["user_id"]
        )
    )

    confirmation = cursor.fetchone()

    if confirmation is None:

        connection.close()

        flash(
            "Confirmação não encontrada."
        )

        return redirect(
            url_for("home")
        )

    if confirmation["status"] != "confirmed":

        connection.close()

        flash(
            "Essa confirmação não está mais ativa."
        )

        return redirect(
            url_for("home")
        )

    deadline = parse_datetime(
        confirmation[
            "confirmation_deadline"
        ]
    )

    if (
        deadline is None
        or now_local() > deadline
    ):

        connection.close()

        flash(
            "The cancellation deadline has passed. "
            "Please contact the coordination team."
        )

        return redirect(
            url_for("home")
        )

    cursor.execute(
        """
        UPDATE confirmations

        SET
            status = 'cancelled',
            cancellation_reason = ?,
            cancelled_at = ?

        WHERE id = ?
        AND user_id = ?
        """,
        (
            cancellation_reason,
            now_local().isoformat(),
            confirmation_id,
            session["user_id"]
        )
    )

    connection.commit()
    connection.close()

    create_notification(
        message=(
            f'{session["user_name"]} cancelled '
            f'{confirmation["role_name"]} for '
            f'{confirmation["event_name"]}.'
        ),
        notification_type=(
            "confirmation_cancelled"
        ),
        related_entity_type=(
            "confirmation"
        ),
        related_entity_id=(
            confirmation_id
        )
    )

    flash(
        "Confirmação cancelada com sucesso."
    )

    return redirect(
        url_for("home")
    )


# =========================================================
# ADMIN - CREATE TASK
# =========================================================

@app.route(
    "/admin/tasks/create",
    methods=["POST"]
)
@admin_required
def create_task():

    title = form_text(
        "title"
    )

    description = form_text(
        "description"
    )

    event_id = form_text(
        "event_id"
    )

    deadline = form_text(
        "deadline"
    )

    priority = form_text(
        "priority"
    )

    volunteer_limit = form_text(
        "volunteer_limit"
    )

    event_id = (
        event_id
        or None
    )

    if (
        not title
        or not deadline
        or not priority
    ):

        flash(
            "Preencha todos os campos obrigatórios da missão."
        )

        return redirect(
            url_for("admin")
        )

    if priority not in [
        "normal",
        "important",
        "urgent"
    ]:

        flash(
            "Prioridade da missão inválida."
        )

        return redirect(
            url_for("admin")
        )

    try:

        volunteer_limit = int(
            volunteer_limit
        )

    except ValueError:

        flash(
            "A quantidade de voluntários precisa ser um número."
        )

        return redirect(
            url_for("admin")
        )

    if volunteer_limit < 1:

        flash(
            "A missão precisa de pelo menos uma pessoa."
        )

        return redirect(
            url_for("admin")
        )

    deadline_datetime = parse_datetime(
        deadline
    )

    if deadline_datetime is None:

        flash(
            "Prazo da missão inválido."
        )

        return redirect(
            url_for("admin")
        )

    if deadline_datetime <= now_local():

        flash(
            "O prazo da missão precisa estar no futuro."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    if event_id:

        cursor.execute(
            """
            SELECT id

            FROM events

            WHERE id = ?
            """,
            (
                event_id,
            )
        )

        if cursor.fetchone() is None:

            connection.close()

            flash(
                "O evento selecionado não existe."
            )

            return redirect(
                url_for("admin")
            )

    cursor.execute(
        """
        INSERT INTO tasks (
            title,
            description,
            event_id,
            deadline,
            priority,
            volunteer_limit,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            title,
            description,
            event_id,
            deadline,
            priority,
            volunteer_limit,
            now_local().isoformat()
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Missão criada com sucesso! 🚀"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - UPDATE TASK
# =========================================================

@app.route(
    "/admin/tasks/<int:task_id>/update",
    methods=["POST"]
)
@admin_required
def update_task(task_id):

    title = form_text(
        "title"
    )

    description = form_text(
        "description"
    )

    event_id = form_text(
        "event_id"
    )

    deadline = form_text(
        "deadline"
    )

    priority = form_text(
        "priority"
    )

    volunteer_limit = form_text(
        "volunteer_limit"
    )

    event_id = (
        event_id
        or None
    )

    if (
        not title
        or not deadline
        or not priority
    ):

        flash(
            "Preencha todos os campos obrigatórios da missão."
        )

        return redirect(
            url_for("admin")
        )

    if priority not in [
        "normal",
        "important",
        "urgent"
    ]:

        flash(
            "Prioridade da missão inválida."
        )

        return redirect(
            url_for("admin")
        )

    try:

        volunteer_limit = int(
            volunteer_limit
        )

    except ValueError:

        flash(
            "A quantidade de voluntários precisa ser um número."
        )

        return redirect(
            url_for("admin")
        )

    if volunteer_limit < 1:

        flash(
            "A missão precisa de pelo menos uma pessoa."
        )

        return redirect(
            url_for("admin")
        )

    deadline_datetime = parse_datetime(
        deadline
    )

    if deadline_datetime is None:

        flash(
            "Prazo da missão inválido."
        )

        return redirect(
            url_for("admin")
        )

    if deadline_datetime <= now_local():

        flash(
            "O prazo da missão precisa estar no futuro."
        )

        return redirect(
            url_for("admin")
        )   

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # TASK EXISTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM tasks

        WHERE id = ?
        """,
        (
            task_id,
        )
    )

    if cursor.fetchone() is None:

        connection.close()

        flash(
            "Missão não encontrada."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # EVENT EXISTS
    # -----------------------------------------------------

    if event_id:

        cursor.execute(
            """
            SELECT id

            FROM events

            WHERE id = ?
            """,
            (
                event_id,
            )
        )

        if cursor.fetchone() is None:

            connection.close()

            flash(
                "O evento selecionado não existe."
            )

            return redirect(
                url_for("admin")
            )

    # -----------------------------------------------------
    # PARTICIPANT COUNT
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            COUNT(*) AS volunteer_count

        FROM task_users

        WHERE task_id = ?

        AND status =
            'active'
        """,
        (
            task_id,
        )
    )

    volunteer_count = (
        cursor.fetchone()[
            "volunteer_count"
        ]
    )

    if volunteer_limit < volunteer_count:

        connection.close()

        flash(
            "Volunteer limit cannot be lower "
            "than active volunteers."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE tasks

        SET
            title = ?,
            description = ?,
            event_id = ?,
            deadline = ?,
            priority = ?,
            volunteer_limit = ?

        WHERE id = ?
        """,
        (
            title,
            description,
            event_id,
            deadline,
            priority,
            volunteer_limit,
            task_id
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Missão atualizada com sucesso!"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - TASK STATUS
# =========================================================

@app.route(
    "/admin/tasks/<int:task_id>/status",
    methods=["POST"]
)
@admin_required
def update_task_status(task_id):

    status = form_text(
        "status"
    )

    if status not in [
        "open",
        "in_progress",
        "completed"
    ]:

        flash(
            "Status da missão inválido."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE tasks

        SET status = ?

        WHERE id = ?
        """,
        (
            status,
            task_id
        )
    )

    if cursor.rowcount == 0:

        connection.close()

        flash(
            "Missão não encontrada."
        )

        return redirect(
            url_for("admin")
        )

    connection.commit()
    connection.close()

    flash(
        "Andamento da missão atualizado com sucesso."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - TASK ACTIVE STATUS
# =========================================================

@app.route(
    "/admin/tasks/<int:task_id>/deactivate",
    methods=["POST"]
)
@admin_required
def deactivate_task(task_id):

    return set_task_active_status(
        task_id,
        0
    )


@app.route(
    "/admin/tasks/<int:task_id>/reactivate",
    methods=["POST"]
)
@admin_required
def reactivate_task(task_id):

    return set_task_active_status(
        task_id,
        1
    )


def set_task_active_status(
    task_id,
    active
):

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE tasks

        SET active = ?

        WHERE id = ?
        """,
        (
            active,
            task_id
        )
    )

    if cursor.rowcount == 0:

        connection.close()

        flash(
            "Missão não encontrada."
        )

        return redirect(
            url_for("admin")
        )

    connection.commit()
    connection.close()

    flash(
        "Andamento da missão atualizado com sucesso."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# JOIN TASK
# =========================================================

@app.route(
    "/tasks/<int:task_id>/join",
    methods=["POST"]
)
@login_required
def join_task(task_id):

    user_id = session["user_id"]

    connection = connect_database()

    connection.execute(
        "BEGIN IMMEDIATE"
    )

    cursor = connection.cursor()

    try:

        # -------------------------------------------------
        # EXISTING PARTICIPATION
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                status

            FROM task_users

            WHERE task_id = ?
            AND user_id = ?
            """,
            (
                task_id,
                user_id
            )
        )

        participation = cursor.fetchone()

        if (
            participation
            and participation["status"]
            == "active"
        ):

            connection.rollback()
            connection.close()

            flash(
                "Você já está ajudando nessa missão."
            )

            return redirect(
                url_for("home")
            )

        # -------------------------------------------------
        # TASK INFORMATION
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                tasks.id,
                tasks.title,
                tasks.deadline,
                tasks.status,
                tasks.active,
                tasks.volunteer_limit,

                COUNT(
                    task_users.id
                ) AS volunteer_count

            FROM tasks

            LEFT JOIN task_users
                ON task_users.task_id =
                   tasks.id

                AND task_users.status =
                    'active'

            WHERE tasks.id = ?

            GROUP BY
                tasks.id,
                tasks.title,
                tasks.deadline,
                tasks.status,
                tasks.active,
                tasks.volunteer_limit
            """,
            (
                task_id,
            )
        )

        task = cursor.fetchone()

        if task is None:

            connection.rollback()
            connection.close()

            flash(
                "Missão não encontrada."
            )

            return redirect(
                url_for("home")
            )

        if task["active"] == 0:

            connection.rollback()
            connection.close()

            flash(
                "Essa missão não está mais ativa."
            )

            return redirect(
                url_for("home")
            )

        if task["status"] == "completed":

            connection.rollback()
            connection.close()

            flash(
                "Essa missão já foi concluída."
            )

            return redirect(
                url_for("home")
            )

        deadline = parse_datetime(
            task["deadline"]
        )

        if (
            deadline
            and now_local() > deadline
        ):

            connection.rollback()
            connection.close()

            flash(
                "O prazo dessa missão já terminou."
            )

            return redirect(
                url_for("home")
            )

        if (
            task["volunteer_count"]
            >= task["volunteer_limit"]
        ):

            connection.rollback()
            connection.close()

            flash(
                "Essa missão já encontrou todas as pessoas de que precisava."
            )

            return redirect(
                url_for("home")
            )

        # -------------------------------------------------
        # RESTORE PARTICIPATION
        # -------------------------------------------------

        if participation:

            cursor.execute(
                """
                UPDATE task_users

                SET
                    status = 'active',
                    joined_at = ?

                WHERE id = ?
                """,
                (
                    now_local().isoformat(),
                    participation["id"]
                )
            )

        # -------------------------------------------------
        # NEW PARTICIPATION
        # -------------------------------------------------

        else:

            cursor.execute(
                """
                INSERT INTO task_users (
                    task_id,
                    user_id,
                    joined_at
                )
                VALUES (?, ?, ?)
                """,
                (
                    task_id,
                    user_id,
                    now_local().isoformat()
                )
            )

        connection.commit()

        task_title = (
            task["title"]
        )

    except Exception:

        connection.rollback()
        connection.close()

        raise

    connection.close()

    create_notification(
        message=(
            f'{session["user_name"]} joined '
            f'the task "{task_title}".'
        ),
        notification_type=(
            "task_joined"
        ),
        related_entity_type="task",
        related_entity_id=task_id
    )

    flash(
        "Boa! Você entrou nessa missão. 🚀"
    )

    return redirect(
        url_for("home")
    )


# =========================================================
# LEAVE TASK
# =========================================================

@app.route(
    "/tasks/<int:participation_id>/leave",
    methods=["POST"]
)
@login_required
def leave_task(participation_id):

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            task_users.id,
            task_users.status,

            tasks.status AS task_status,
            tasks.title AS task_title

        FROM task_users

        JOIN tasks
            ON task_users.task_id =
               tasks.id

        WHERE task_users.id = ?

        AND task_users.user_id = ?
        """,
        (
            participation_id,
            session["user_id"]
        )
    )

    participation = cursor.fetchone()

    if participation is None:

        connection.close()

        flash(
            "Participação na missão não encontrada."
        )

        return redirect(
            url_for("home")
        )

    if participation["task_status"] == "completed":

        connection.close()

        flash(
            "Não é possível sair de uma missão já concluída."
        )

        return redirect(
            url_for("home")
        )

    if participation["status"] != "active":

        connection.close()

        flash(
            "Você não está mais participando dessa missão."
        )

        return redirect(
            url_for("home")
        )

    cursor.execute(
        """
        UPDATE task_users

        SET status = 'cancelled'

        WHERE id = ?
        AND user_id = ?
        """,
        (
            participation_id,
            session["user_id"]
        )
    )

    connection.commit()
    connection.close()

    create_notification(
        message=(
            f'{session["user_name"]} left '
            f'the task '
            f'"{participation["task_title"]}".'
        ),
        notification_type=(
            "task_left"
        ),
        related_entity_type=(
            "task_participation"
        ),
        related_entity_id=(
            participation_id
        )
    )

    flash(
        "Você saiu da missão."
    )

    return redirect(
        url_for("home")
    )


# =========================================================
# SUBMIT TASK DELIVERY
# =========================================================

@app.route(
    "/tasks/<int:participation_id>/submit",
    methods=["POST"]
)
@login_required
def submit_task_delivery(
    participation_id
):

    delivery_link = form_text(
        "delivery_link"
    )

    if not delivery_link:

        flash(
            "Cole o link da sua entrega."
        )

        return redirect(
            url_for("home")
        )

    if not is_valid_url(
        delivery_link
    ):

        flash(
            "Informe um link válido para a entrega."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            task_users.id,
            task_users.status,

            tasks.status AS task_status,
            tasks.title AS task_title

        FROM task_users

        JOIN tasks
            ON task_users.task_id =
               tasks.id

        WHERE task_users.id = ?

        AND task_users.user_id = ?
        """,
        (
            participation_id,
            session["user_id"]
        )
    )

    participation = cursor.fetchone()

    if participation is None:

        connection.close()

        flash(
            "Participação na missão não encontrada."
        )

        return redirect(
            url_for("home")
        )

    if participation["status"] != "active":

        connection.close()

        flash(
            "Você não está mais participando dessa missão."
        )

        return redirect(
            url_for("home")
        )

    if participation["task_status"] == "completed":

        connection.close()

        flash(
            "Essa missão já foi concluída."
        )

        return redirect(
            url_for("home")
        )

    cursor.execute(
        """
        UPDATE task_users

        SET
            delivery_link = ?,
            submitted_at = ?

        WHERE id = ?
        AND user_id = ?
        """,
        (
            delivery_link,
            now_local().isoformat(),
            participation_id,
            session["user_id"]
        )
    )

    connection.commit()
    connection.close()

    create_notification(
        message=(
            f'{session["user_name"]} submitted '
            f'a delivery for '
            f'"{participation["task_title"]}".'
        ),
        notification_type=(
            "task_delivery_submitted"
        ),
        related_entity_type=(
            "task_participation"
        ),
        related_entity_id=(
            participation_id
        )
    )

    flash(
        "Entrega enviada com sucesso! ✨"
    )

    return redirect(
        url_for("home")
    )


# =========================================================
# ADMIN - CREATE ANNOUNCEMENT
# =========================================================

@app.route(
    "/admin/announcements/create",
    methods=["POST"]
)
@admin_required
def create_announcement():

    title = form_text(
        "title"
    )

    message = form_text(
        "message"
    )

    priority = form_text(
        "priority"
    )

    if not title or not message:

        flash(
            "Título e mensagem são obrigatórios."
        )

        return redirect(
            url_for("admin")
        )

    if priority not in [
        "normal",
        "important",
        "urgent"
    ]:

        flash(
            "Prioridade do comunicado inválida."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO announcements (
            title,
            message,
            priority,
            created_by,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            title,
            message,
            priority,
            session["user_id"],
            now_local().isoformat()
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Comunicado publicado no mural! 📢"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - UPDATE ANNOUNCEMENT
# =========================================================

@app.route(
    "/admin/announcements/<int:announcement_id>/update",
    methods=["POST"]
)
@admin_required
def update_announcement(
    announcement_id
):

    title = form_text(
        "title"
    )

    message = form_text(
        "message"
    )

    priority = form_text(
        "priority"
    )

    if not title or not message:

        flash(
            "Título e mensagem são obrigatórios."
        )

        return redirect(
            url_for("admin")
        )

    if priority not in [
        "normal",
        "important",
        "urgent"
    ]:

        flash(
            "Prioridade do comunicado inválida."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE announcements

        SET
            title = ?,
            message = ?,
            priority = ?

        WHERE id = ?
        """,
        (
            title,
            message,
            priority,
            announcement_id
        )
    )

    if cursor.rowcount == 0:

        connection.close()

        flash(
            "Comunicado não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    connection.commit()
    connection.close()

    flash(
        "Comunicado atualizado com sucesso!"
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ANNOUNCEMENT ACTIVE STATUS
# =========================================================

@app.route(
    "/admin/announcements/<int:announcement_id>/deactivate",
    methods=["POST"]
)
@admin_required
def deactivate_announcement(
    announcement_id
):

    return set_announcement_status(
        announcement_id,
        0
    )


@app.route(
    "/admin/announcements/<int:announcement_id>/reactivate",
    methods=["POST"]
)
@admin_required
def reactivate_announcement(
    announcement_id
):

    return set_announcement_status(
        announcement_id,
        1
    )


def set_announcement_status(
    announcement_id,
    active
):

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE announcements

        SET active = ?

        WHERE id = ?
        """,
        (
            active,
            announcement_id
        )
    )

    if cursor.rowcount == 0:

        connection.close()

        flash(
            "Comunicado não encontrado."
        )

        return redirect(
            url_for("admin")
        )

    connection.commit()
    connection.close()

    flash(
        "Status do comunicado atualizado com sucesso."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# NOTIFICATION - MARK READ
# =========================================================

@app.route(
    "/admin/notifications/<int:notification_id>/read",
    methods=["POST"]
)
@admin_required
def mark_notification_as_read(
    notification_id
):

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE notifications

        SET read = 1

        WHERE id = ?
        """,
        (
            notification_id,
        )
    )

    if cursor.rowcount == 0:

        connection.close()

        flash(
            "Notificação não encontrada."
        )

        return redirect(
            url_for("admin")
        )

    connection.commit()
    connection.close()

    return redirect(
        url_for("admin")
    )


# =========================================================
# NOTIFICATION - MARK ALL READ
# =========================================================

@app.route(
    "/admin/notifications/read-all",
    methods=["POST"]
)
@admin_required
def mark_all_notifications_as_read():

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE notifications

        SET read = 1

        WHERE read = 0
        """
    )

    connection.commit()
    connection.close()

    return redirect(
        url_for("admin")
    )


# =========================================================
# ERROR HANDLERS
# =========================================================

@app.errorhandler(404)
def page_not_found(error):

    return render_template(
        "404.html"
    ), 404


@app.errorhandler(500)
def internal_server_error(error):

    return render_template(
        "500.html"
    ), 500


@app.errorhandler(CSRFError)
def handle_csrf_error(error):
    """
    Handles invalid or expired CSRF tokens.
    """

    flash(
        "Your session expired or the request was invalid. "
        "Please try again."
    )

    if "user_id" in session:

        return redirect(
            url_for("home")
        )

    return redirect(
        url_for("login")
    )


# =========================================================
# APPLICATION INITIALIZATION
# =========================================================

initialize_database()

run_database_migrations()

seed_projects()

seed_roles()

seed_initial_admin()


# =========================================================
# LOCAL DEVELOPMENT
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )