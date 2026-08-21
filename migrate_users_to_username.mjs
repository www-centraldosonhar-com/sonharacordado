import process from 'node:process'
import { neon } from '@neondatabase/serverless'

import {
  createUniqueUsername,
  normalizeFullName,
} from './server/actions/_people-import.js'

const sql =
  neon(process.env.DATABASE_URL)


// ============================================================
// 1. ADICIONA USERNAME
// ============================================================

await sql`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT
`

console.log(
  '✅ Coluna users.username pronta.'
)


// ============================================================
// 2. CARREGA USUÁRIOS ATUAIS
//
// Login NÃO será alterado nesta etapa.
// ============================================================

const users = await sql`
  SELECT
    id,
    name,
    full_name,
    username
  FROM users
  ORDER BY id
`

const usedUsernames = []

const result = []


// ============================================================
// 3. GERA USERNAMES ÚNICOS
// ============================================================

for (const user of users) {
  /*
   * Se já houver username no futuro,
   * preservamos.
   */
  if (
    String(
      user.username || ''
    ).trim()
  ) {
    usedUsernames.push(
      user.username
    )

    result.push({
      id:
        user.id,

      full_name:
        user.full_name ||
        user.name,

      username:
        user.username,

      action:
        'preserved',
    })

    continue
  }


  const fullName =
    normalizeFullName(
      user.full_name ||
      user.name
    )


  const username =
    createUniqueUsername(
      fullName,
      usedUsernames
    )


  await sql`
    UPDATE users
    SET
      username =
        ${username},

      full_name =
        COALESCE(
          NULLIF(
            TRIM(full_name),
            ''
          ),
          ${fullName}
        )
    WHERE id =
      ${user.id}
  `


  usedUsernames.push(
    username
  )


  result.push({
    id:
      user.id,

    full_name:
      fullName,

    username,

    action:
      'created',
  })
}


// ============================================================
// 4. GARANTE UNICIDADE GLOBAL
// ============================================================

await sql`
  CREATE UNIQUE INDEX
  IF NOT EXISTS
    users_username_unique_idx
  ON users (
    LOWER(username)
  )
  WHERE username IS NOT NULL
`


// ============================================================
// 5. RESULTADO
// ============================================================

console.log(
  '\n===== USERNAMES ====='
)

console.table(
  result.map(
    (user) => ({
      id:
        user.id,

      name:
        user.full_name,

      login:
        `@${user.username}`,

      action:
        user.action,
    })
  )
)


const verification =
  await sql`
    SELECT
      COUNT(*)::int AS total,

      COUNT(username)::int
        AS with_username,

      COUNT(DISTINCT LOWER(username))::int
        AS unique_usernames
    FROM users
  `


console.log(
  '\n===== VERIFICAÇÃO ====='
)

console.table(
  verification
)


if (
  verification[0].total !==
    verification[0].with_username ||
  verification[0].with_username !==
    verification[0].unique_usernames
) {
  throw new Error(
    '❌ A verificação de usernames falhou.'
  )
}


console.log(
  '\n🔥 Migração de username concluída.'
)

console.log(
  'ℹ️ Login atual por name + project + PIN continua intacto.'
)
