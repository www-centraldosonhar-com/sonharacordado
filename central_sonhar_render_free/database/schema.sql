-- =========================================================
-- CENTRAL DO SONHAR - POSTGRESQL / NEON
-- =========================================================

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    email TEXT,
    avatar_path TEXT,
    password_hash TEXT,
    user_type TEXT NOT NULL DEFAULT 'volunteer'
        CHECK (user_type IN ('volunteer', 'admin')),
    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),
    UNIQUE (name, project_id)
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    location TEXT NOT NULL,
    confirmation_deadline TIMESTAMP NOT NULL,
    sympla_link TEXT,
    event_image_path TEXT,
    event_type TEXT NOT NULL DEFAULT 'specific'
        CHECK (event_type IN ('specific', 'general')),
    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),
    UNIQUE (name, event_date)
);

CREATE TABLE IF NOT EXISTS event_roles (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    role_id INTEGER NOT NULL REFERENCES roles(id),
    vacancy_limit INTEGER NOT NULL CHECK (vacancy_limit > 0),
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),
    UNIQUE (event_id, role_id)
);

CREATE TABLE IF NOT EXISTS confirmations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_role_id INTEGER NOT NULL REFERENCES event_roles(id),
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled')),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, event_role_id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_id INTEGER REFERENCES events(id),
    deadline TIMESTAMP NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('normal', 'important', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'completed')),
    volunteer_limit INTEGER NOT NULL DEFAULT 1
        CHECK (volunteer_limit > 0),
    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_users (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled')),
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivery_link TEXT,
    submitted_at TIMESTAMP,
    UNIQUE (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('normal', 'important', 'urgent')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    notification_type TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT,
    related_entity_id INTEGER,
    read INTEGER NOT NULL DEFAULT 0
        CHECK (read IN (0, 1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_confirmations_user
    ON confirmations(user_id);

CREATE INDEX IF NOT EXISTS idx_confirmations_event_role
    ON confirmations(event_role_id);

CREATE INDEX IF NOT EXISTS idx_task_users_user
    ON task_users(user_id);

CREATE INDEX IF NOT EXISTS idx_task_users_task
    ON task_users(task_id);

CREATE INDEX IF NOT EXISTS idx_events_date
    ON events(event_date);

CREATE INDEX IF NOT EXISTS idx_notifications_read
    ON notifications(read, created_at);
