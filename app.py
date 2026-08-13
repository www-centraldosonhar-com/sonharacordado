from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session
)

import sqlite3
from datetime import datetime

import os


# =========================================================
# FLASK CONFIGURATION
# =========================================================

app = Flask(__name__)

# Development key used by Flask sessions.
# Later this will be moved to an environment variable.
app.secret_key = os.environ.get(
    "SECRET_KEY",
    "dev-secret-key"
)


# =========================================================
# DATABASE
# =========================================================

def connect_database():
    """
    Opens a SQLite connection.

    sqlite3.Row allows access like:

        user["name"]

    instead of:

        user[1]
    """

    connection = sqlite3.connect("database.db")
    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():
    """
    Executes database/schema.sql.

    CREATE TABLE IF NOT EXISTS statements
    create tables that do not exist yet.
    """

    connection = connect_database()

    with open(
        "database/schema.sql",
        "r",
        encoding="utf-8"
    ) as file:
        connection.executescript(
            file.read()
        )

    connection.close()

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

    Parameters:
        message:
            Text shown in the notification.

        notification_type:
            Category of notification.

        related_entity_type:
            Optional type of related object.
            Example:
                "task"
                "confirmation"

        related_entity_id:
            Optional id of that object.

        user_id:
            Optional specific recipient.

            If None, the notification is considered
            a general/admin notification for now.
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
            datetime.now().isoformat()
        )
    )

    connection.commit()
    connection.close()

# =========================================================
# DATE / TIME FORMATTERS
# =========================================================

def format_datetime(value):
    """
    Converts an ISO datetime string into a
    more readable Brazilian format.

    Example:

        2026-08-13T12:35:42.123456

    becomes:

        13/08/2026 às 12:35
    """

    if not value:
        return ""

    date = datetime.fromisoformat(value)

    return date.strftime(
        "%d/%m/%Y às %H:%M"
    )


# ---------------------------------------------------------
# JINJA FILTER
# ---------------------------------------------------------
# Allows HTML templates to use:
#
# {{ value | datetime_br }}

app.jinja_env.filters[
    "datetime_br"
] = format_datetime


# =========================================================
# DEVELOPMENT SEEDS
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
        INSERT OR IGNORE INTO projects (name)
        VALUES (?)
        """,
        projects
    )

    connection.commit()
    connection.close()


def seed_users():
    """
    Creates development users.

    Uses a manual existence check because SQLite
    UNIQUE constraints with NULL values can behave
    differently than expected.
    """

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # GET PROJECT IDS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id
        FROM projects
        WHERE name = ?
        """,
        ("PPF",)
    )
    ppf = cursor.fetchone()

    cursor.execute(
        """
        SELECT id
        FROM projects
        WHERE name = ?
        """,
        ("APS",)
    )
    aps = cursor.fetchone()

    cursor.execute(
        """
        SELECT id
        FROM projects
        WHERE name = ?
        """,
        ("SJ",)
    )
    sj = cursor.fetchone()

    users = [
        ("Mikio", ppf["id"], "admin"),
        ("Mariana", aps["id"], "volunteer"),
        ("Gi Lino", sj["id"], "volunteer")
    ]

    # -----------------------------------------------------
    # INSERT USERS ONLY IF THEY DO NOT EXIST
    # -----------------------------------------------------

    for name, project_id, user_type in users:

        cursor.execute(
            """
            SELECT id
            FROM users

            WHERE name = ? COLLATE NOCASE
            AND project_id = ?
            """,
            (
                name,
                project_id
            )
        )

        existing_user = cursor.fetchone()

        if existing_user is None:

            cursor.execute(
                """
                INSERT INTO users (
                    name,
                    last_name,
                    project_id,
                    user_type
                )
                VALUES (?, ?, ?, ?)
                """,
                (
                    name,
                    None,
                    project_id,
                    user_type
                )
            )

    connection.commit()
    connection.close()


def seed_roles():
    """
    Creates development role types.
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
        INSERT OR IGNORE INTO roles (name)
        VALUES (?)
        """,
        roles
    )

    connection.commit()
    connection.close()


def seed_events():
    """
    Creates the initial development event.
    """

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM projects
        WHERE name = ?
        """,
        ("APS",)
    )

    aps = cursor.fetchone()

    cursor.execute(
        """
        INSERT OR IGNORE INTO events (
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
            "APS - Dia da Bondade",
            aps["id"],
            "2026-08-15",
            "08:00",
            "Local do evento",
            "2026-08-13 23:59",
            None,
            "specific"
        )
    )

    connection.commit()
    connection.close()


def seed_event_roles():
    """
    Creates development vacancies for the event.

    Photography -> 2
    Filmmaker   -> 1
    """

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # GET EVENT
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id
        FROM events
        WHERE name = ?
        """,
        ("APS - Dia da Bondade",)
    )

    event = cursor.fetchone()

    # -----------------------------------------------------
    # GET ROLES
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id
        FROM roles
        WHERE name = ?
        """,
        ("Photography",)
    )

    photography = cursor.fetchone()

    cursor.execute(
        """
        SELECT id
        FROM roles
        WHERE name = ?
        """,
        ("Filmmaker",)
    )

    filmmaker = cursor.fetchone()

    # -----------------------------------------------------
    # CREATE EVENT ROLES
    # -----------------------------------------------------

    cursor.execute(
        """
        INSERT OR IGNORE INTO event_roles (
            event_id,
            role_id,
            vacancy_limit
        )
        VALUES (?, ?, ?)
        """,
        (
            event["id"],
            photography["id"],
            2
        )
    )

    cursor.execute(
        """
        INSERT OR IGNORE INTO event_roles (
            event_id,
            role_id,
            vacancy_limit
        )
        VALUES (?, ?, ?)
        """,
        (
            event["id"],
            filmmaker["id"],
            1
        )
    )

    connection.commit()
    connection.close()


# =========================================================
# AUTHENTICATION
# =========================================================

@app.route(
    "/login",
    methods=["GET", "POST"]
)
def login():
    """
    GET:
        Displays the login page.

    POST:
        Validates name + project and creates session.
    """

    connection = connect_database()
    cursor = connection.cursor()

    # Projects are needed by login.html.
    cursor.execute(
        """
        SELECT *
        FROM projects
        ORDER BY name
        """
    )

    projects = cursor.fetchall()

    if request.method == "POST":

        name = request.form[
            "name"
        ].strip()

        project_name = request.form[
            "project"
        ].strip()

        # -------------------------------------------------
        # FIND ACTIVE USER
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                users.id,
                users.name,
                users.user_type,
                projects.name AS project

            FROM users

            JOIN projects
                ON users.project_id = projects.id

            WHERE users.name = ? COLLATE NOCASE
            AND projects.name = ? COLLATE NOCASE
            AND users.active = 1
            """,
            (
                name,
                project_name
            )
        )

        user = cursor.fetchone()

        if user is None:

            connection.close()

            flash(
                "User not found."
            )

            return redirect(
                url_for("login")
            )

        # -------------------------------------------------
        # CREATE SESSION
        # -------------------------------------------------

        session["user_id"] = user["id"]
        session["user_name"] = user["name"]
        session["project"] = user["project"]
        session["user_type"] = user["user_type"]

        connection.close()

        return redirect(
            url_for("home")
        )

    connection.close()

    return render_template(
        "login.html",
        projects=projects
    )


@app.route("/logout")
def logout():
    """
    Clears the logged user session.
    """

    session.clear()

    return redirect(
        url_for("login")
    )


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@app.route("/admin")
def admin():
    """
    Displays administrative information.
    """

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # LOAD EVENTS
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
            events.active,

            projects.name AS project

        FROM events

        LEFT JOIN projects
            ON events.project_id = projects.id

        ORDER BY events.event_date ASC
        """
    )

    events = cursor.fetchall()

    # -----------------------------------------------------
    # LOAD CONFIRMED VOLUNTEERS
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
            ON confirmations.user_id = users.id

        JOIN projects
            ON users.project_id = projects.id

        JOIN event_roles
            ON confirmations.event_role_id = event_roles.id

        JOIN roles
            ON event_roles.role_id = roles.id

        JOIN events
            ON event_roles.event_id = events.id

        WHERE confirmations.status = 'confirmed'

        ORDER BY
            events.event_date,
            roles.name,
            users.name
        """
    )

    confirmed_volunteers = cursor.fetchall()

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
    # LOAD ROLES
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
    # LOAD EVENT ROLE SUMMARY
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

            COUNT(
                confirmations.id
            ) AS confirmed_count,

            (
                event_roles.vacancy_limit
                - COUNT(confirmations.id)
            ) AS remaining_count

        FROM event_roles

        JOIN events
            ON event_roles.event_id = events.id

        JOIN roles
            ON event_roles.role_id = roles.id

        LEFT JOIN confirmations
            ON confirmations.event_role_id = event_roles.id
            AND confirmations.status = 'confirmed'

        WHERE events.active = 1

        GROUP BY
            event_roles.id,
            event_roles.active,
            events.name,
            events.event_date,
            roles.name,
            event_roles.vacancy_limit

        ORDER BY
            events.event_date ASC,
            roles.name ASC
        """
    )

    event_role_summary = cursor.fetchall()

    # -----------------------------------------------------
    # LOAD TASKS
    # -----------------------------------------------------
    # delivery_link is NOT stored in tasks.
    # Delivery belongs to task_users because every
    # volunteer may submit a different link.

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
            tasks.created_at,

            events.name AS event_name,

            CASE
                WHEN datetime(tasks.deadline)
                    < datetime('now', 'localtime')
                    AND tasks.status != 'completed'

                THEN 1

                ELSE 0

            END AS overdue

        FROM tasks

        LEFT JOIN events
            ON tasks.event_id = events.id

        WHERE tasks.active = 1

        ORDER BY
            tasks.deadline ASC
        """
    )

    tasks = cursor.fetchall()

    # -----------------------------------------------------
    # LOAD TASK PARTICIPANTS + DELIVERIES
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            task_users.task_id,
            task_users.delivery_link,
            task_users.submitted_at,

            tasks.title AS task_title,

            users.name AS volunteer_name,

            projects.name AS project

        FROM task_users

        JOIN tasks
            ON task_users.task_id = tasks.id

        JOIN users
            ON task_users.user_id = users.id

        JOIN projects
            ON users.project_id = projects.id

        WHERE task_users.status = 'active'

        ORDER BY
            tasks.title,
            users.name
        """
    )

    task_participants = cursor.fetchall()

    # -----------------------------------------------------
    # LOAD NOTIFICATIONS
    # -----------------------------------------------------
    # Loads the most recent internal notifications.
    #
    # Unread notifications appear first.
    # Inside each group, newest notifications appear first.

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
        """
    )

    notifications = cursor.fetchall()    

    # -----------------------------------------------------
    # COUNT UNREAD NOTIFICATIONS
    # -----------------------------------------------------
    # Counts how many notifications are still unread.
    #
    # read = 0  -> unread
    # read = 1  -> read

    cursor.execute(
        """
        SELECT
            COUNT(*) AS unread_count

        FROM notifications

        WHERE read = 0
        """
    )

    unread_notifications = cursor.fetchone()["unread_count"]    

    # -----------------------------------------------------
    # LOAD USERS
    # -----------------------------------------------------
    # Loads users so the Admin Dashboard can display
    # and manage them.

    cursor.execute(
        """
        SELECT
            users.id,
            users.name,
            users.last_name,
            users.email,
            users.user_type,
            users.active,

            projects.name AS project

        FROM users

        JOIN projects
            ON users.project_id = projects.id

        ORDER BY
            users.name,
            users.last_name
        """
    )

    users = cursor.fetchall()


    connection.close()

    return render_template(
        "admin.html",
        events=events,
        confirmed_volunteers=confirmed_volunteers,
        projects=projects,
        roles=roles,
        event_role_summary=event_role_summary,
        tasks=tasks,
        task_participants=task_participants,
        notifications=notifications,
        unread_notifications=unread_notifications,
        users=users
    )


# =========================================================
# ADMIN - CREATE EVENT
# =========================================================

@app.route(
    "/admin/events/create",
    methods=["POST"]
)
def create_event():

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # FORM DATA
    # -----------------------------------------------------

    name = request.form[
        "name"
    ].strip()

    project_id = request.form[
        "project_id"
    ].strip()

    event_date = request.form[
        "event_date"
    ].strip()

    event_time = request.form[
        "event_time"
    ].strip()

    location = request.form[
        "location"
    ].strip()

    confirmation_deadline = request.form[
        "confirmation_deadline"
    ].strip()

    sympla_link = request.form[
        "sympla_link"
    ].strip()

    event_type = request.form[
        "event_type"
    ].strip()

    if project_id == "":
        project_id = None

    if sympla_link == "":
        sympla_link = None

    if (
        not name
        or not event_date
        or not event_time
        or not location
        or not confirmation_deadline
    ):

        flash(
            "Please fill in all required fields."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

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
            "Event created successfully!"
        )

    except sqlite3.IntegrityError:

        flash(
            "An event with this name "
            "and date already exists."
        )

    connection.close()

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
def update_event(event_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    name = request.form[
        "name"
    ].strip()

    project_id = request.form[
        "project_id"
    ].strip()

    event_type = request.form[
        "event_type"
    ].strip()

    event_date = request.form[
        "event_date"
    ].strip()

    event_time = request.form[
        "event_time"
    ].strip()

    location = request.form[
        "location"
    ].strip()

    confirmation_deadline = request.form[
        "confirmation_deadline"
    ].strip()

    sympla_link = request.form[
        "sympla_link"
    ].strip()

    if project_id == "":
        project_id = None

    if sympla_link == "":
        sympla_link = None

    if (
        not name
        or not event_date
        or not event_time
        or not location
        or not confirmation_deadline
    ):

        flash(
            "Please fill in all required fields."
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
        (event_id,)
    )

    event = cursor.fetchone()

    if event is None:

        connection.close()

        flash(
            "Event not found."
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
            "Event updated successfully!"
        )

    except sqlite3.IntegrityError:

        flash(
            "Another event with this "
            "name and date already exists."
        )

    connection.close()

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - EVENT STATUS
# =========================================================

@app.route(
    "/admin/events/<int:event_id>/deactivate",
    methods=["POST"]
)
def deactivate_event(event_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, active
        FROM events
        WHERE id = ?
        """,
        (event_id,)
    )

    event = cursor.fetchone()

    if event is None:

        connection.close()

        flash(
            "Event not found."
        )

        return redirect(
            url_for("admin")
        )

    if event["active"] == 0:

        connection.close()

        flash(
            "This event is already inactive."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE events
        SET active = 0
        WHERE id = ?
        """,
        (event_id,)
    )

    connection.commit()
    connection.close()

    flash(
        "Event deactivated successfully."
    )

    return redirect(
        url_for("admin")
    )


@app.route(
    "/admin/events/<int:event_id>/reactivate",
    methods=["POST"]
)
def reactivate_event(event_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, active
        FROM events
        WHERE id = ?
        """,
        (event_id,)
    )

    event = cursor.fetchone()

    if event is None:

        connection.close()

        flash(
            "Event not found."
        )

        return redirect(
            url_for("admin")
        )

    if event["active"] == 1:

        connection.close()

        flash(
            "This event is already active."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE events
        SET active = 1
        WHERE id = ?
        """,
        (event_id,)
    )

    connection.commit()
    connection.close()

    flash(
        "Event reactivated successfully."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - EVENT ROLES
# =========================================================

@app.route(
    "/admin/event-roles/create",
    methods=["POST"]
)
def create_event_role():

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    event_id = request.form[
        "event_id"
    ]

    role_id = request.form[
        "role_id"
    ]

    vacancy_limit = request.form[
        "vacancy_limit"
    ]

    try:

        vacancy_limit = int(
            vacancy_limit
        )

    except ValueError:

        flash(
            "Vacancy limit must be a number."
        )

        return redirect(
            url_for("admin")
        )

    if vacancy_limit < 1:

        flash(
            "Vacancy limit must be at least 1."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            INSERT INTO event_roles (
                event_id,
                role_id,
                vacancy_limit
            )
            VALUES (?, ?, ?)
            """,
            (
                event_id,
                role_id,
                vacancy_limit
            )
        )

        connection.commit()

        flash(
            "Event role created successfully!"
        )

    except sqlite3.IntegrityError:

        flash(
            "This role already exists "
            "for this event."
        )

    connection.close()

    return redirect(
        url_for("admin")
    )


@app.route(
    "/admin/event-roles/<int:event_role_id>/update",
    methods=["POST"]
)
def update_event_role(event_role_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    vacancy_limit = request.form[
        "vacancy_limit"
    ]

    try:

        vacancy_limit = int(
            vacancy_limit
        )

    except ValueError:

        flash(
            "Vacancy limit must be a number."
        )

        return redirect(
            url_for("admin")
        )

    if vacancy_limit < 1:

        flash(
            "Vacancy limit must be at least 1."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    # Count current confirmations.
    cursor.execute(
        """
        SELECT
            event_roles.id,

            COUNT(
                confirmations.id
            ) AS confirmed_count

        FROM event_roles

        LEFT JOIN confirmations
            ON confirmations.event_role_id = event_roles.id
            AND confirmations.status = 'confirmed'

        WHERE event_roles.id = ?

        GROUP BY event_roles.id
        """,
        (event_role_id,)
    )

    event_role = cursor.fetchone()

    if event_role is None:

        connection.close()

        flash(
            "Event role not found."
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
            "Vacancy limit cannot be lower "
            "than the number of confirmed volunteers."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE event_roles

        SET vacancy_limit = ?

        WHERE id = ?
        """,
        (
            vacancy_limit,
            event_role_id
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Vacancy limit updated successfully!"
    )

    return redirect(
        url_for("admin")
    )


@app.route(
    "/admin/event-roles/<int:event_role_id>/deactivate",
    methods=["POST"]
)
def deactivate_event_role(event_role_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, active
        FROM event_roles
        WHERE id = ?
        """,
        (event_role_id,)
    )

    event_role = cursor.fetchone()

    if event_role is None:

        connection.close()

        flash(
            "Event role not found."
        )

        return redirect(
            url_for("admin")
        )

    if event_role["active"] == 0:

        connection.close()

        flash(
            "This event role is already inactive."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE event_roles

        SET active = 0

        WHERE id = ?
        """,
        (event_role_id,)
    )

    connection.commit()
    connection.close()

    flash(
        "Event role deactivated successfully."
    )

    return redirect(
        url_for("admin")
    )


@app.route(
    "/admin/event-roles/<int:event_role_id>/reactivate",
    methods=["POST"]
)
def reactivate_event_role(event_role_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, active
        FROM event_roles
        WHERE id = ?
        """,
        (event_role_id,)
    )

    event_role = cursor.fetchone()

    if event_role is None:

        connection.close()

        flash(
            "Event role not found."
        )

        return redirect(
            url_for("admin")
        )

    if event_role["active"] == 1:

        connection.close()

        flash(
            "This event role is already active."
        )

        return redirect(
            url_for("admin")
        )

    cursor.execute(
        """
        UPDATE event_roles

        SET active = 1

        WHERE id = ?
        """,
        (event_role_id,)
    )

    connection.commit()
    connection.close()

    flash(
        "Event role reactivated successfully."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# ADMIN - TASKS
# =========================================================

@app.route(
    "/admin/tasks/create",
    methods=["POST"]
)
def create_task():

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    title = request.form[
        "title"
    ].strip()

    description = request.form[
        "description"
    ].strip()

    event_id = request.form[
        "event_id"
    ].strip()

    deadline = request.form[
        "deadline"
    ].strip()

    priority = request.form[
        "priority"
    ].strip()

    volunteer_limit = request.form[
        "volunteer_limit"
    ].strip()

    if event_id == "":
        event_id = None

    try:

        volunteer_limit = int(
            volunteer_limit
        )

    except ValueError:

        flash(
            "Volunteer limit must be a number."
        )

        return redirect(
            url_for("admin")
        )

    if volunteer_limit < 1:

        flash(
            "Volunteer limit must be at least 1."
        )

        return redirect(
            url_for("admin")
        )

    if (
        not title
        or not deadline
        or not priority
    ):

        flash(
            "Please fill in all required task fields."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

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
            datetime.now().isoformat()
        )
    )

    connection.commit()
    connection.close()

    flash(
        "Task created successfully!"
    )

    return redirect(
        url_for("admin")
    )


@app.route(
    "/admin/tasks/<int:task_id>/status",
    methods=["POST"]
)
def update_task_status(task_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    status = request.form[
        "status"
    ].strip()

    allowed_statuses = [
        "open",
        "in_progress",
        "completed"
    ]

    if status not in allowed_statuses:

        flash(
            "Invalid task status."
        )

        return redirect(
            url_for("admin")
        )

    connection = connect_database()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM tasks
        WHERE id = ?
        """,
        (task_id,)
    )

    task = cursor.fetchone()

    if task is None:

        connection.close()

        flash(
            "Task not found."
        )

        return redirect(
            url_for("admin")
        )

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

    connection.commit()
    connection.close()

    flash(
        "Task status updated successfully."
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
def create_user():
    """
    Creates a new user from the Admin Dashboard.

    Only admins can use this route.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    # -----------------------------------------------------
    # CHECK ADMIN PERMISSION
    # -----------------------------------------------------

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # GET FORM DATA
    # -----------------------------------------------------

    name = request.form[
        "name"
    ].strip()

    last_name = request.form[
        "last_name"
    ].strip()

    project_id = request.form[
        "project_id"
    ].strip()

    email = request.form[
        "email"
    ].strip()

    user_type = request.form[
        "user_type"
    ].strip()

    # -----------------------------------------------------
    # OPTIONAL VALUES
    # -----------------------------------------------------

    if last_name == "":
        last_name = None

    if email == "":
        email = None

    # -----------------------------------------------------
    # VALIDATE REQUIRED VALUES
    # -----------------------------------------------------

    if (
        not name
        or not project_id
        or not user_type
    ):

        flash(
            "Please fill in all required user fields."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # VALIDATE USER TYPE
    # -----------------------------------------------------

    allowed_user_types = [
        "volunteer",
        "admin"
    ]

    if user_type not in allowed_user_types:

        flash(
            "Invalid user type."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # OPEN DATABASE
    # -----------------------------------------------------

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # CHECK DUPLICATE USER
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT id

        FROM users

        WHERE name = ? COLLATE NOCASE

        AND (
            last_name = ?
            OR (
                last_name IS NULL
                AND ? IS NULL
            )
        )

        AND project_id = ?
        """,
        (
            name,
            last_name,
            last_name,
            project_id
        )
    )

    existing_user = cursor.fetchone()

    if existing_user:

        connection.close()

        flash(
            "This user already exists."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # INSERT USER
    # -----------------------------------------------------

    cursor.execute(
        """
        INSERT INTO users (
            name,
            last_name,
            project_id,
            email,
            user_type
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            name,
            last_name,
            project_id,
            email,
            user_type
        )
    )

    connection.commit()
    connection.close()

    flash(
        "User created successfully!"
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
def deactivate_user(user_id):
    """
    Deactivates a user without deleting them.

    The user's history remains in the database.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    # -----------------------------------------------------
    # CHECK ADMIN PERMISSION
    # -----------------------------------------------------

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # PREVENT ADMIN FROM DEACTIVATING THEMSELVES
    # -----------------------------------------------------

    if user_id == session["user_id"]:

        flash(
            "You cannot deactivate your own account."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # OPEN DATABASE
    # -----------------------------------------------------

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # FIND USER
    # -----------------------------------------------------

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
            "User not found."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # CHECK STATUS
    # -----------------------------------------------------

    if user["active"] == 0:

        connection.close()

        flash(
            "This user is already inactive."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # DEACTIVATE USER
    # -----------------------------------------------------

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
        "User deactivated successfully."
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
def reactivate_user(user_id):
    """
    Reactivates an inactive user.
    """

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

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
            "User not found."
        )

        return redirect(
            url_for("admin")
        )

    if user["active"] == 1:

        connection.close()

        flash(
            "This user is already active."
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
        "User reactivated successfully."
    )

    return redirect(
        url_for("admin")
    )


# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # CONFIRMED VOLUNTEERS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            users.name,
            projects.name AS project,
            roles.name AS role

        FROM confirmations

        JOIN users
            ON confirmations.user_id = users.id

        JOIN projects
            ON users.project_id = projects.id

        JOIN event_roles
            ON confirmations.event_role_id = event_roles.id

        JOIN roles
            ON event_roles.role_id = roles.id

        WHERE confirmations.status = 'confirmed'

        ORDER BY users.name
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

            CASE
                WHEN datetime(events.confirmation_deadline)
                    >= datetime('now', 'localtime')

                THEN 1

                ELSE 0
            END AS cancellation_open

        FROM confirmations

        JOIN event_roles
            ON confirmations.event_role_id = event_roles.id

        JOIN roles
            ON event_roles.role_id = roles.id

        JOIN events
            ON event_roles.event_id = events.id

        WHERE confirmations.user_id = ?
        AND confirmations.status = 'confirmed'

        ORDER BY roles.name
        """,
        (session["user_id"],)
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

            projects.name AS project

        FROM events

        LEFT JOIN projects
            ON events.project_id = projects.id

        WHERE events.active = 1

        AND events.event_date
            >= DATE('now', 'localtime')

        ORDER BY events.event_date ASC

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

                COUNT(
                    confirmations.id
                ) AS confirmed_count,

                CASE
                    WHEN datetime(events.confirmation_deadline)
                        >= datetime('now', 'localtime')

                    THEN 1

                    ELSE 0

                END AS confirmation_open

            FROM event_roles

            JOIN roles
                ON event_roles.role_id = roles.id

            JOIN events
                ON event_roles.event_id = events.id

            LEFT JOIN confirmations
                ON confirmations.event_role_id = event_roles.id
                AND confirmations.status = 'confirmed'

            WHERE event_roles.event_id = ?
            AND event_roles.active = 1

            GROUP BY
                event_roles.id,
                roles.name,
                event_roles.vacancy_limit,
                events.confirmation_deadline

            ORDER BY roles.name
            """,
            (next_event["id"],)
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
            tasks.volunteer_limit,

            COUNT(
                task_users.id
            ) AS volunteer_count,

            CASE
                WHEN datetime(tasks.deadline)
                    < datetime('now', 'localtime')

                THEN 1

                ELSE 0

            END AS overdue

        FROM tasks

        LEFT JOIN task_users
            ON task_users.task_id = tasks.id
            AND task_users.status = 'active'

        WHERE tasks.active = 1
        AND tasks.status != 'completed'

        GROUP BY
            tasks.id,
            tasks.title,
            tasks.description,
            tasks.deadline,
            tasks.priority,
            tasks.volunteer_limit

        ORDER BY tasks.deadline ASC
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
            ON task_users.task_id = tasks.id

        WHERE task_users.user_id = ?
        AND task_users.status = 'active'
        AND tasks.active = 1

        ORDER BY tasks.deadline ASC
        """,
        (session["user_id"],)
    )

    my_tasks = cursor.fetchall()

    connection.close()

    return render_template(
        "index.html",
        confirmations=confirmations,
        my_confirmations=my_confirmations,
        next_event=next_event,
        event_roles=event_roles,
        tasks=tasks,
        my_tasks=my_tasks
    )


# =========================================================
# CONFIRM EVENT ROLE
# =========================================================

@app.route(
    "/confirm/<int:event_role_id>",
    methods=["POST"]
)
def confirm(event_role_id):
    """
    Confirms the logged-in user for an event role.

    Before confirming, the system checks:

    - user is logged in
    - user is not already confirmed
    - event role exists
    - confirmation deadline is still open
    - vacancy limit has not been reached

    After a successful confirmation,
    an admin notification is created.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    user_id = session["user_id"]

    # -----------------------------------------------------
    # OPEN DATABASE
    # -----------------------------------------------------

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # CHECK EXISTING CONFIRMATION
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # ALREADY CONFIRMED
    # -----------------------------------------------------

    if (
        confirmation
        and confirmation["status"] == "confirmed"
    ):

        connection.close()

        flash(
            "You are already confirmed for this role."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # LOAD EVENT ROLE INFORMATION
    # -----------------------------------------------------
    # Besides capacity and deadline, we also load
    # the event and role names so they can be used
    # in the admin notification.

    cursor.execute(
        """
        SELECT
            event_roles.vacancy_limit,

            events.confirmation_deadline,

            events.name AS event_name,

            roles.name AS role_name,

            COUNT(
                confirmations.id
            ) AS confirmed_count

        FROM event_roles

        JOIN events
            ON event_roles.event_id = events.id

        JOIN roles
            ON event_roles.role_id = roles.id

        LEFT JOIN confirmations
            ON confirmations.event_role_id = event_roles.id
            AND confirmations.status = 'confirmed'

        WHERE event_roles.id = ?

        GROUP BY
            event_roles.id,
            event_roles.vacancy_limit,
            events.confirmation_deadline,
            events.name,
            roles.name
        """,
        (
            event_role_id,
        )
    )

    event_role = cursor.fetchone()

    # -----------------------------------------------------
    # CHECK EVENT ROLE EXISTS
    # -----------------------------------------------------

    if event_role is None:

        connection.close()

        flash(
            "Role not found."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK CONFIRMATION DEADLINE
    # -----------------------------------------------------

    deadline = datetime.fromisoformat(
        event_role[
            "confirmation_deadline"
        ]
    )

    if datetime.now() > deadline:

        connection.close()

        flash(
            "The confirmation deadline has passed."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK VACANCY LIMIT
    # -----------------------------------------------------

    if (
        event_role["confirmed_count"]
        >= event_role["vacancy_limit"]
    ):

        connection.close()

        flash(
            "This role is already full."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # RESTORE CANCELLED CONFIRMATION
    # -----------------------------------------------------

    if (
        confirmation
        and confirmation["status"] == "cancelled"
    ):

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

        flash(
            "Confirmation restored successfully!"
        )

    # -----------------------------------------------------
    # FIRST CONFIRMATION
    # -----------------------------------------------------

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

        flash(
            "Confirmation saved successfully!"
        )

    # -----------------------------------------------------
    # SAVE CONFIRMATION
    # -----------------------------------------------------

    connection.commit()
    connection.close()

    # -----------------------------------------------------
    # CREATE ADMIN NOTIFICATION
    # -----------------------------------------------------
    # Example:
    #
    # Mikio confirmed Photography for
    # APS - Dia da Bondade.

    create_notification(
        message=(
            f'{session["user_name"]} confirmed '
            f'{event_role["role_name"]} for '
            f'{event_role["event_name"]}.'
        ),
        notification_type="event_confirmation_created",
        related_entity_type="event_role",
        related_entity_id=event_role_id
    )

    # -----------------------------------------------------
    # RETURN TO HOME
    # -----------------------------------------------------

    return redirect(
        url_for("home")
    )


# =========================================================
# CANCEL CONFIRMATION
# =========================================================

@app.route(
    "/confirmations/<int:confirmation_id>/cancel",
    methods=["POST"]
)
def cancel_confirmation(confirmation_id):

    if "user_id" not in session:

        return redirect(
            url_for("login")
        )

    cancellation_reason = request.form[
        "cancellation_reason"
    ].strip()

    if not cancellation_reason:

        flash(
            "Cancellation reason is required."
        )

        return redirect(
            url_for("home")
        )

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # LOAD CONFIRMATION INFORMATION
    # -----------------------------------------------------
    # Loads the confirmation together with:
    # - event name
    # - role name
    # - cancellation deadline
    #
    # The event and role names will be used
    # in the admin notification.

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
            ON confirmations.event_role_id = event_roles.id

        JOIN events
            ON event_roles.event_id = events.id

        JOIN roles
            ON event_roles.role_id = roles.id

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
            "Confirmation not found."
        )

        return redirect(
            url_for("home")
        )

    deadline = datetime.fromisoformat(
        confirmation[
            "confirmation_deadline"
        ]
    )

    if datetime.now() > deadline:

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
        AND status = 'confirmed'
        """,
        (
            cancellation_reason,
            datetime.now().isoformat(),
            confirmation_id,
            session["user_id"]
        )
    )

    # -----------------------------------------------------
    # SAVE CANCELLATION
    # -----------------------------------------------------

    connection.commit()
    connection.close()


    # -----------------------------------------------------
    # CREATE ADMIN NOTIFICATION
    # -----------------------------------------------------
    # Example:
    #
    # Mikio cancelled Photography for
    # APS - Dia da Bondade.

    create_notification(
        message=(
            f'{session["user_name"]} cancelled '
            f'{confirmation["role_name"]} for '
            f'{confirmation["event_name"]}.'
        ),
        notification_type="confirmation_cancelled",
        related_entity_type="confirmation",
        related_entity_id=confirmation_id
    )


    # -----------------------------------------------------
    # USER FEEDBACK
    # -----------------------------------------------------

    flash(
        "Confirmation cancelled successfully."
    )

    return redirect(
        url_for("home")
    )

# =========================================================
# JOIN TASK
# =========================================================

@app.route(
    "/tasks/<int:task_id>/join",
    methods=["POST"]
)
def join_task(task_id):
    """
    Allows the logged-in user to join a task.

    The function checks:
    - login
    - existing participation
    - task existence
    - task active status
    - task completion status
    - volunteer capacity

    If everything is valid, the participation
    is created or restored.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    user_id = session["user_id"]

    # -----------------------------------------------------
    # OPEN DATABASE CONNECTION
    # -----------------------------------------------------
    # connection is created HERE.
    # Everything using connection or cursor must happen
    # after these lines.

    connection = connect_database()
    print("JOIN TASK CONNECTION:", connection)
    cursor = connection.cursor()
    

    # -----------------------------------------------------
    # CHECK EXISTING PARTICIPATION
    # -----------------------------------------------------

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

    # User is already helping with this task.
    if (
        participation
        and participation["status"] == "active"
    ):
        connection.close()

        flash(
            "You are already helping with this task."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # LOAD TASK + CURRENT VOLUNTEER COUNT
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            tasks.id,
            tasks.title,
            tasks.status,
            tasks.active,
            tasks.volunteer_limit,

            COUNT(task_users.id) AS volunteer_count

        FROM tasks

        LEFT JOIN task_users
            ON task_users.task_id = tasks.id
            AND task_users.status = 'active'

        WHERE tasks.id = ?

        GROUP BY
            tasks.id,
            tasks.title,
            tasks.status,
            tasks.active,
            tasks.volunteer_limit
        """,
        (
            task_id,
        )
    )

    task = cursor.fetchone()

    # -----------------------------------------------------
    # CHECK TASK EXISTS
    # -----------------------------------------------------

    if task is None:
        connection.close()

        flash(
            "Task not found."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK TASK ACTIVE STATUS
    # -----------------------------------------------------

    if task["active"] == 0:
        connection.close()

        flash(
            "This task is no longer active."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK TASK STATUS
    # -----------------------------------------------------

    if task["status"] == "completed":
        connection.close()

        flash(
            "This task is already completed."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK VOLUNTEER LIMIT
    # -----------------------------------------------------

    if (
        task["volunteer_count"]
        >= task["volunteer_limit"]
    ):
        connection.close()

        flash(
            "This task already has enough volunteers."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # RESTORE OLD PARTICIPATION
    # -----------------------------------------------------
    # If this user joined before and later cancelled,
    # restore the same record.

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
                datetime.now().isoformat(),
                participation["id"]
            )
        )

    # -----------------------------------------------------
    # FIRST PARTICIPATION
    # -----------------------------------------------------

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
                datetime.now().isoformat()
            )
        )

    # -----------------------------------------------------
    # SAVE DATABASE CHANGES
    # -----------------------------------------------------

    connection.commit()
    connection.close()

    # -----------------------------------------------------
    # CREATE INTERNAL NOTIFICATION
    # -----------------------------------------------------
    # This runs only after participation was successfully
    # saved in the database.

    create_notification(
        message=(
            f'{session["user_name"]} joined the task '
            f'"{task["title"]}".'
        ),
        notification_type="task_joined",
        related_entity_type="task",
        related_entity_id=task_id
    )

    # -----------------------------------------------------
    # USER FEEDBACK
    # -----------------------------------------------------

    flash(
        "You joined the task successfully!"
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
def leave_task(participation_id):
    """
    Allows the logged-in user to leave a task.

    The participation is not deleted from the database.
    Instead, its status becomes 'cancelled'.

    This keeps the participation history.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    # -----------------------------------------------------
    # OPEN DATABASE CONNECTION
    # -----------------------------------------------------

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # FIND PARTICIPATION
    # -----------------------------------------------------
    # We check both the participation id and the logged
    # user's id.
    #
    # This prevents one volunteer from leaving another
    # volunteer's task.

    # -----------------------------------------------------
    # FIND PARTICIPATION
    # -----------------------------------------------------
    # Loads the participation and task information.
    #
    # task_title will be used in the notification message.

    cursor.execute(
        """
        SELECT
            task_users.id,
            task_users.status,

            tasks.status AS task_status,
            tasks.title AS task_title

        FROM task_users

        JOIN tasks
            ON task_users.task_id = tasks.id

        WHERE task_users.id = ?
        AND task_users.user_id = ?
        """,
        (
            participation_id,
            session["user_id"]
        )
    )

    participation = cursor.fetchone()

    # -----------------------------------------------------
    # CHECK PARTICIPATION EXISTS
    # -----------------------------------------------------

    if participation is None:

        connection.close()

        flash(
            "Task participation not found."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK TASK IS NOT COMPLETED
    # -----------------------------------------------------
    # Once a task is completed, we preserve its history.

    if participation["task_status"] == "completed":

        connection.close()

        flash(
            "You cannot leave a completed task."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK PARTICIPATION STATUS
    # -----------------------------------------------------

    if participation["status"] != "active":

        connection.close()

        flash(
            "You are no longer active in this task."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CANCEL PARTICIPATION
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # SAVE TASK CANCELLATION
    # -----------------------------------------------------

    connection.commit()
    connection.close()


    # -----------------------------------------------------
    # CREATE ADMIN NOTIFICATION
    # -----------------------------------------------------
    # Example:
    #
    # Mikio left the task "Edit APS Reel".

    create_notification(
        message=(
            f'{session["user_name"]} left the task '
            f'"{participation["task_title"]}".'
        ),
        notification_type="task_left",
        related_entity_type="task_participation",
        related_entity_id=participation_id
    )


    # -----------------------------------------------------
    # USER FEEDBACK
    # -----------------------------------------------------

    flash(
        "You left the task successfully."
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
def submit_task_delivery(participation_id):
    """
    Allows a volunteer to submit or update
    a delivery link for a task.

    The delivery belongs to task_users,
    because each volunteer may submit a
    different delivery.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    # -----------------------------------------------------
    # GET DELIVERY LINK
    # -----------------------------------------------------

    delivery_link = request.form[
        "delivery_link"
    ].strip()

    if not delivery_link:

        flash(
            "Delivery link is required."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # OPEN DATABASE CONNECTION
    # -----------------------------------------------------

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # FIND PARTICIPATION
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            task_users.id,
            task_users.status,

            tasks.status AS task_status,
            tasks.title AS task_title

        FROM task_users

        JOIN tasks
            ON task_users.task_id = tasks.id

        WHERE task_users.id = ?
        AND task_users.user_id = ?
        """,
        (
            participation_id,
            session["user_id"]
        )
    )

    participation = cursor.fetchone()

    # -----------------------------------------------------
    # CHECK PARTICIPATION EXISTS
    # -----------------------------------------------------

    if participation is None:

        connection.close()

        flash(
            "Task participation not found."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK PARTICIPATION IS ACTIVE
    # -----------------------------------------------------

    if participation["status"] != "active":

        connection.close()

        flash(
            "You are no longer active in this task."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # CHECK TASK IS NOT COMPLETED
    # -----------------------------------------------------

    if participation["task_status"] == "completed":

        connection.close()

        flash(
            "This task is already completed."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # SAVE DELIVERY
    # -----------------------------------------------------

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
            datetime.now().isoformat(),
            participation_id,
            session["user_id"]
        )
    )

    connection.commit()
    connection.close()

    # -----------------------------------------------------
    # CREATE ADMIN NOTIFICATION
    # -----------------------------------------------------

    create_notification(
        message=(
            f'{session["user_name"]} submitted a delivery '
            f'for "{participation["task_title"]}".'
        ),
        notification_type="task_delivery_submitted",
        related_entity_type="task_participation",
        related_entity_id=participation_id
    )

    flash(
        "Task delivery submitted successfully!"
    )

    return redirect(
        url_for("home")
    )

# =========================================================
# MARK NOTIFICATION AS READ
# =========================================================

@app.route(
    "/admin/notifications/<int:notification_id>/read",
    methods=["POST"]
)
def mark_notification_as_read(notification_id):
    """
    Marks one notification as read.

    Only admins can use this route.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    # -----------------------------------------------------
    # CHECK ADMIN PERMISSION
    # -----------------------------------------------------

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # OPEN DATABASE
    # -----------------------------------------------------

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # CHECK NOTIFICATION EXISTS
    # -----------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            read

        FROM notifications

        WHERE id = ?
        """,
        (
            notification_id,
        )
    )

    notification = cursor.fetchone()

    if notification is None:

        connection.close()

        flash(
            "Notification not found."
        )

        return redirect(
            url_for("admin")
        )

    # -----------------------------------------------------
    # MARK AS READ
    # -----------------------------------------------------

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

    connection.commit()
    connection.close()

    flash(
        "Notification marked as read."
    )

    return redirect(
        url_for("admin")
    )

# =========================================================
# MARK ALL NOTIFICATIONS AS READ
# =========================================================

@app.route(
    "/admin/notifications/read-all",
    methods=["POST"]
)
def mark_all_notifications_as_read():
    """
    Marks every unread notification as read.

    Only admins can use this route.
    """

    # -----------------------------------------------------
    # CHECK LOGIN
    # -----------------------------------------------------

    if "user_id" not in session:
        return redirect(
            url_for("login")
        )

    # -----------------------------------------------------
    # CHECK ADMIN PERMISSION
    # -----------------------------------------------------

    if session.get("user_type") != "admin":

        flash(
            "Admin access required."
        )

        return redirect(
            url_for("home")
        )

    # -----------------------------------------------------
    # OPEN DATABASE
    # -----------------------------------------------------

    connection = connect_database()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # MARK ALL UNREAD NOTIFICATIONS AS READ
    # -----------------------------------------------------

    cursor.execute(
        """
        UPDATE notifications

        SET read = 1

        WHERE read = 0
        """
    )

    connection.commit()
    connection.close()

    flash(
        "All notifications marked as read."
    )

    return redirect(
        url_for("admin")
    )

# =========================================================
# APPLICATION INITIALIZATION
# =========================================================

# These functions must run when the application
# is imported by Gunicorn on Render.
#
# Gunicorn uses:
#
#     gunicorn app:app
#
# In that case __name__ is NOT "__main__",
# so database initialization cannot stay only
# inside the block at the bottom.

initialize_database()

seed_projects()
seed_users()
seed_roles()
seed_events()
seed_event_roles()


# =========================================================
# LOCAL DEVELOPMENT START
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )