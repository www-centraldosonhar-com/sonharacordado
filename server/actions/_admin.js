import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

export const sql =
  neon(process.env.DATABASE_URL)

// =========================================================
// REQUIRE ADMIN
// =========================================================
// A autorização administrativa agora vem de
// user_permissions.
//
// admin_scope:
// - global = Admin Geral
// - team   = Admin de uma ou mais equipes
//
// O antigo users.user_type continua existindo apenas
// durante a transição e não é mais a fonte principal
// de autorização.
// =========================================================

export async function requireAdmin(
  request
) {
  const sessionUser =
    await getSessionUser(request)

  if (!sessionUser?.userId) {
    return null
  }

  const users = await sql`
    SELECT
      u.id,
      u.name,
      u.active,
      up.admin_scope
    FROM users u
    JOIN user_permissions up
      ON up.user_id = u.id
      AND up.permission = 'admin'
      AND up.active = 1
    WHERE u.id =
      ${sessionUser.userId}
    LIMIT 1
  `

  const user = users[0]

  if (
    !user ||
    Number(user.active) !== 1
  ) {
    return null
  }

  const teams = await sql`
    SELECT
      t.id,
      t.code,
      t.name
    FROM user_teams ut
    JOIN teams t
      ON t.id = ut.team_id
    WHERE ut.user_id =
      ${user.id}
      AND ut.active = 1
      AND t.active = 1
    ORDER BY t.name
  `

  return {
    ...user,

    adminScope:
      user.admin_scope,

    teams,
  }
}

// =========================================================
// ADMIN TEAM IDS
// =========================================================

export function getAdminTeamIds(
  admin
) {
  return (
    admin?.teams || []
  ).map(
    (team) =>
      Number(team.id)
  )
}

// =========================================================
// GLOBAL ADMIN CHECK
// =========================================================

export function isGlobalAdmin(
  admin
) {
  return (
    admin?.adminScope ===
    'global'
  )
}
