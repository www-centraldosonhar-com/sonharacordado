import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

export const sql =
  neon(process.env.DATABASE_URL)

// =========================================================
// ADMIN ACCESS
// =========================================================
//
// admin_scope:
// team    = Admin de Equipe
// project = Admin de Projeto
// global  = Admin Geral
//
// Regras:
// - Admin Geral: tudo.
// - Admin de Projeto: tudo do próprio projeto.
// - Admin de Equipe: própria equipe + próprio projeto.
// - Admin de Mídias: equipe transversal entre projetos.
// =========================================================

export async function requireAdmin(request) {
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
      u.project_id,
      p.name AS project,
      up.admin_scope
    FROM users u

    JOIN projects p
      ON p.id = u.project_id

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

  if (
    ![
      'team',
      'project',
      'global',
    ].includes(user.admin_scope)
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

    projectId:
      Number(user.project_id),

    teams,
  }
}

// =========================================================
// HELPERS
// =========================================================

export function getAdminTeamIds(admin) {
  return (
    admin?.teams || []
  ).map(
    (team) =>
      Number(team.id)
  )
}

export function isGlobalAdmin(admin) {
  return (
    admin?.adminScope ===
    'global'
  )
}

export function isProjectAdmin(admin) {
  return (
    admin?.adminScope ===
    'project'
  )
}

export function isTeamAdmin(admin) {
  return (
    admin?.adminScope ===
    'team'
  )
}

export function isMediaAdmin(admin) {
  return (
    isTeamAdmin(admin) &&
    (
      admin?.teams || []
    ).some(
      (team) =>
        team.code === 'media'
    )
  )
}

// =========================================================
// PROJECT ACCESS
// =========================================================
// Admin Geral       -> qualquer projeto
// Admin de Mídias   -> qualquer projeto
// Project/Team      -> próprio projeto
// =========================================================

export function adminCanAccessProject(
  admin,
  projectId
) {
  if (!admin) {
    return false
  }

  if (
    isGlobalAdmin(admin) ||
    isMediaAdmin(admin)
  ) {
    return true
  }

  return (
    Number(projectId) ===
    Number(admin.projectId)
  )
}
