import process from 'node:process'

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const CAROL_USER_ID = 314
const CAROL_USERNAME = 'CarolinaSilva'

const users = await sql`
  SELECT
    id,
    name,
    full_name,
    username,
    project_id,
    user_type,
    active
  FROM users
  WHERE id = ${CAROL_USER_ID}
  LIMIT 1
`

const carol = users[0]

if (!carol) {
  throw new Error(
    `Usuária Carol (user_id ${CAROL_USER_ID}) não foi encontrada.`
  )
}

const conflicts = await sql`
  SELECT id, username
  FROM users
  WHERE
    LOWER(username) = LOWER(${CAROL_USERNAME})
    AND id <> ${CAROL_USER_ID}
  LIMIT 1
`

if (conflicts[0]) {
  throw new Error(
    `O username ${CAROL_USERNAME} já pertence ao user_id ${conflicts[0].id}. Nenhuma alteração foi feita.`
  )
}

await sql`
  UPDATE users
  SET
    username = ${CAROL_USERNAME},
    active = 1
  WHERE id = ${CAROL_USER_ID}
`

for (const permission of [
  'volunteer',
  'dreamer',
]) {
  await sql`
    INSERT INTO user_permissions (
      user_id,
      permission,
      admin_scope,
      active
    )
    VALUES (
      ${CAROL_USER_ID},
      ${permission},
      NULL,
      1
    )
    ON CONFLICT (user_id, permission)
    DO UPDATE SET
      active = 1,
      admin_scope = NULL
  `
}

await sql`
  INSERT INTO dreamer_roles (
    user_id,
    role_code,
    active
  )
  VALUES (
    ${CAROL_USER_ID},
    'dreamer_admin',
    1
  )
  ON CONFLICT (user_id, role_code)
  DO UPDATE SET
    active = 1
`

const result = await sql`
  SELECT
    u.id,
    u.name,
    u.full_name,
    u.username,
    u.project_id,
    u.user_type,
    u.active,
    COALESCE(
      ARRAY_AGG(
        DISTINCT up.permission
      ) FILTER (
        WHERE up.active = 1
      ),
      ARRAY[]::text[]
    ) AS permissions,
    COALESCE(
      ARRAY_AGG(
        DISTINCT dr.role_code
      ) FILTER (
        WHERE dr.active = 1
      ),
      ARRAY[]::text[]
    ) AS dreamer_roles
  FROM users u
  LEFT JOIN user_permissions up
    ON up.user_id = u.id
  LEFT JOIN dreamer_roles dr
    ON dr.user_id = u.id
  WHERE u.id = ${CAROL_USER_ID}
  GROUP BY u.id
`

console.log('\n✅ Acesso da Carol reparado sem conceder Admin Central.')
console.table(result)

process.exit(0)
