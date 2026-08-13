CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);


CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    last_name TEXT,
    project_id INTEGER NOT NULL,
    email TEXT,
    user_type TEXT NOT NULL DEFAULT 'volunteer',
    active INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (project_id) REFERENCES projects(id),

    UNIQUE(name, last_name, project_id)
);


CREATE TABLE IF NOT EXISTS confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_role_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    cancellation_reason TEXT,
    cancelled_at TEXT,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_role_id) REFERENCES event_roles(id),

    UNIQUE(user_id, event_role_id)
);

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    project_id INTEGER,
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    location TEXT NOT NULL,
    confirmation_deadline TEXT NOT NULL,
    sympla_link TEXT,
    event_type TEXT NOT NULL DEFAULT 'specific',
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (project_id)
        REFERENCES projects(id),
    UNIQUE(name, event_date)
);

CREATE TABLE IF NOT EXISTS event_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    vacancy_limit INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),

    UNIQUE(event_id, role_id)
);

-- ---------------------------------------------------------
-- TASKS
-- ---------------------------------------------------------
-- Stores work that volunteers can help with.
--
-- A task may be connected to an event,
-- but event_id can also be NULL.
--
-- Examples:
-- - Edit APS Reel
-- - Create Instagram artwork
-- - Upload event photos

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_id INTEGER,
    deadline TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'open',
    volunteer_limit INTEGER NOT NULL DEFAULT 1,
    delivery_link TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (event_id)
        REFERENCES events(id)
);

-- ---------------------------------------------------------
-- TASK USERS
-- ---------------------------------------------------------
-- Connects volunteers to tasks.
--
-- Also stores each volunteer's task delivery.

CREATE TABLE IF NOT EXISTS task_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    
    -- Link submitted by the volunteer.
    -- Example: Google Drive folder/file.
    delivery_link TEXT,

    -- Date and time when the delivery was submitted.
    submitted_at TEXT,

    FOREIGN KEY (task_id)
        REFERENCES tasks(id),

    FOREIGN KEY (user_id)
        REFERENCES users(id),
        
    UNIQUE(task_id, user_id)
);

-- ---------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------
-- Stores internal system notifications.
--
-- Initially notifications will be mainly used
-- by admins to see important activity.

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    notification_type TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT,
    related_entity_id INTEGER,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
);