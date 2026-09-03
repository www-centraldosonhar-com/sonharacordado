import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const FULL_NAME = 'Luciana'
const USERNAME = 'luciana'
const EMAIL = 'luciana.admin@centraldosonhar.local'
const PHONE = '11999990000'
const BIRTH_DATE = '1990-01-01'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrada. Rode com --env-file=.env.local.')
}

// Usa APS apenas como projeto-base obrigatório do cadastro/login.
// O acesso administrativo continua GLOBAL via user_permissions.
const projects = await sql`
  SELECT id, name
  FROM projects
  ORDER BY
    CASE
      WHEN UPPER(name) = 'APS' THEN 0
      WHEN UPPER(name) LIKE '%AMIGOS PARA SEMPRE%' THEN 0
      ELSE 1
    END,
    id
  LIMIT 1
`

const project = projects[0]

if (!project) {
  throw new Error('Nenhum projeto cadastrado foi encontrado.')
}

const existing = await sql`
  SELECT
    id,
    name,
    full_name,
    username,
    email,
    password_hash,
    user_type,
    active,
    project_id
  FROM users
  WHERE
    LOWER(COALESCE(username, '')) = LOWER(${USERNAME})
    OR LOWER(COALESCE(email, '')) = LOWER(${EMAIL})
  LIMIT 1
`

let user = existing[0] || null
let created = false

if (!user) {
  const inserted = await sql`
    INSERT INTO users (
      name,
      full_name,
      username,
      project_id,
      email,
      phone,
      password_hash,
      user_type,
      active,
      birth_date,
      allergies
    )
    VALUES (
      ${FULL_NAME},
      ${FULL_NAME},
      ${USERNAME},
      ${project.id},
      ${EMAIL},
      ${PHONE},
      NULL,
      'admin',
      1,
      ${BIRTH_DATE},
      NULL
    )
    RETURNING
      id,
      name,
      full_name,
      username,
      email,
      password_hash,
      user_type,
      active,
      project_id
  `

  user = inserted[0]
  created = true
} else {
  // Em uma segunda execução, não zeramos um PIN que a Luciana
  // eventualmente já tenha criado. Apenas garantimos acesso/estado.
  const updated = await sql`
    UPDATE users
    SET
      user_type = 'admin',
      active = 1
    WHERE id = ${user.id}
    RETURNING
      id,
      name,
      full_name,
      username,
      email,
      password_hash,
      user_type,
      active,
      project_id
  `

  user = updated[0]
}

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
  DO UPDATE SET
    admin_scope = NULL,
    active = 1
`

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

const result = await sql`
  SELECT
    u.id,
    COALESCE(NULLIF(u.full_name, ''), u.name) AS name,
    u.username,
    u.email,
    p.name AS project,
    u.user_type,
    u.active,
    (u.password_hash IS NULL) AS requires_pin_setup,
    MAX(
      CASE
        WHEN up.permission = 'admin'
         AND up.active = 1
        THEN up.admin_scope
      END
    ) AS admin_scope,
    BOOL_OR(
      up.permission = 'volunteer'
      AND up.active = 1
    ) AS volunteer_access
  FROM users u
  JOIN projects p
    ON p.id = u.project_id
  LEFT JOIN user_permissions up
    ON up.user_id = u.id
  WHERE u.id = ${user.id}
  GROUP BY u.id, p.name
`

console.log('')
console.log(
  created
    ? '✅ Luciana criada como Admin Geral.'
    : '✅ Luciana já existia; acesso Admin Geral confirmado.'
)
console.table(result)

if (created) {
  console.log('')
  console.log('🔐 Primeiro acesso: sem PIN.')
  console.log('👤 Usuário: @luciana')
  console.log('ℹ️ Ao entrar, o sistema deverá solicitar a criação do PIN.')
} else if (user.password_hash) {
  console.log('')
  console.log('ℹ️ A conta já possuía PIN; ele foi preservado.')
}
