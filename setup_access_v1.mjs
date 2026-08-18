import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// USER PROFILE REVIEW FIELDS
// =========================================================

await sql`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS
  profile_review_required
  INTEGER NOT NULL DEFAULT 0
`

await sql`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS
  profile_review_message
  TEXT
`

// =========================================================
// TEAMS
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
  )
`

const teams = [
  ['activities', 'Equipe de Atividades'],
  ['assisted', 'Equipe de Assistidos'],
  ['media', 'Equipe de Mídias'],
  ['kitchen', 'Equipe de Cozinha'],
]

for (const [code, name] of teams) {
  await sql`
    INSERT INTO teams (
      code,
      name,
      active
    )
    VALUES (
      ${code},
      ${name},
      1
    )
    ON CONFLICT (code)
    DO UPDATE SET
      name = EXCLUDED.name
  `
}

// =========================================================
// USER PERMISSIONS
// =========================================================
//
// dreamer = acesso ao Espaço Sócio Sonhador
// volunteer = acesso à Central do Voluntário
// admin = acesso administrativo
//
// admin_scope:
// global = Admin Geral
// team   = Admin restrito à equipe
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
      REFERENCES users(id)
      ON DELETE CASCADE,

    permission TEXT NOT NULL,

    admin_scope TEXT,

    active INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, permission),

    CHECK (
      permission IN (
        'dreamer',
        'volunteer',
        'admin'
      )
    ),

    CHECK (
      admin_scope IS NULL
      OR admin_scope IN (
        'global',
        'team'
      )
    )
  )
`

// =========================================================
// USER TEAMS
// =========================================================
//
// Um voluntário pode estar vinculado a uma ou mais equipes.
// Admin de equipe terá acesso apenas às equipes vinculadas.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS user_teams (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
      REFERENCES users(id)
      ON DELETE CASCADE,

    team_id INTEGER NOT NULL
      REFERENCES teams(id)
      ON DELETE CASCADE,

    active INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, team_id)
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
  idx_user_permissions_user
  ON user_permissions(user_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS
  idx_user_teams_user
  ON user_teams(user_id)
`

// =========================================================
// MIGRATE CURRENT USERS
// =========================================================
//
// Todos os usuários atuais ganham acesso dreamer.
//
// volunteer -> volunteer + dreamer
// admin     -> admin global + volunteer + dreamer
// =========================================================

const users = await sql`
  SELECT
    id,
    user_type
  FROM users
`

for (const user of users) {
  await sql`
    INSERT INTO user_permissions (
      user_id,
      permission,
      admin_scope,
      active
    )
    VALUES (
      ${user.id},
      'dreamer',
      NULL,
      1
    )
    ON CONFLICT (user_id, permission)
    DO NOTHING
  `

  if (
    user.user_type === 'volunteer' ||
    user.user_type === 'admin'
  ) {
    await sql`
      INSERT INTO user_permissions (
        user_id,
        permission,
        admin_scope,
        active
      )
      VALUES (
        ${user.id},
        'volunteer',
        NULL,
        1
      )
      ON CONFLICT (user_id, permission)
      DO NOTHING
    `
  }

  if (user.user_type === 'admin') {
    await sql`
      INSERT INTO user_permissions (
        user_id,
        permission,
        admin_scope,
        active
      )
      VALUES (
        ${user.id},
        'admin',
        'global',
        1
      )
      ON CONFLICT (user_id, permission)
      DO UPDATE SET
        admin_scope = 'global',
        active = 1
    `
  }
}

console.log('')
console.log('✅ Access architecture v1 ready!')
console.log('• teams')
console.log('• user_permissions')
console.log('• user_teams')
console.log('• profile review fields')
console.log('• current users migrated')
