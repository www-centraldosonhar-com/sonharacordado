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

// =========================================================
// RECORD ACCESS HELPERS
// =========================================================

// ---------------------------------------------------------
// EVENT
// ---------------------------------------------------------
// Eventos gerais (project_id NULL) são administrados
// somente pelo Admin Geral.
//
// Admin de Projeto:
// próprio projeto.
//
// Admin de equipe normal:
// próprio projeto.
//
// Admin de Mídias:
// qualquer projeto, pois Mídias é transversal.
// ---------------------------------------------------------

export async function adminCanAccessEvent(
  admin,
  eventId
) {
  const numericEventId =
    Number(eventId)

  if (
    !admin ||
    !Number.isInteger(numericEventId)
  ) {
    return false
  }

  const rows = await sql`
    SELECT
      id,
      project_id
    FROM events
    WHERE id = ${numericEventId}
    LIMIT 1
  `

  const event =
    rows[0]

  if (!event) {
    return false
  }

  if (
    event.project_id === null
  ) {
    return isGlobalAdmin(admin)
  }

  return adminCanAccessProject(
    admin,
    event.project_id
  )
}


// ---------------------------------------------------------
// USER
// ---------------------------------------------------------
// Global:
// qualquer usuário.
//
// Project:
// apenas usuários do próprio projeto.
//
// Team:
// usuário precisa pertencer à equipe administrada.
//
// Media admin:
// usuários de Mídias de qualquer projeto.
// ---------------------------------------------------------

export async function adminCanAccessUser(
  admin,
  userId
) {
  const numericUserId =
    Number(userId)

  if (
    !admin ||
    !Number.isInteger(numericUserId)
  ) {
    return false
  }

  if (isGlobalAdmin(admin)) {
    return true
  }

  const rows = await sql`
    SELECT
      u.id,
      u.project_id
    FROM users u
    WHERE u.id = ${numericUserId}
    LIMIT 1
  `

  const targetUser =
    rows[0]

  if (!targetUser) {
    return false
  }

  if (isProjectAdmin(admin)) {
    return (
      Number(
        targetUser.project_id
      ) ===
      Number(
        admin.projectId
      )
    )
  }

  if (!isTeamAdmin(admin)) {
    return false
  }

  const adminTeamIds =
    getAdminTeamIds(admin)

  if (
    adminTeamIds.length === 0
  ) {
    return false
  }

  if (
    !isMediaAdmin(admin) &&
    Number(
      targetUser.project_id
    ) !==
    Number(
      admin.projectId
    )
  ) {
    return false
  }

  const sharedTeams = await sql`
    SELECT 1
    FROM user_teams ut
    WHERE ut.user_id =
      ${numericUserId}
      AND ut.active = 1
      AND ut.team_id =
        ANY(${adminTeamIds})
    LIMIT 1
  `

  return Boolean(
    sharedTeams[0]
  )
}


// ---------------------------------------------------------
// TASK
// ---------------------------------------------------------
// Enquanto tasks não possuir project_id/team_id:
//
// tarefa ligada a evento:
// segue acesso ao evento.
//
// tarefa sem evento:
// somente Admin Geral.
// ---------------------------------------------------------

export async function adminCanAccessTask(
  admin,
  taskId
) {
  const numericTaskId =
    Number(taskId)

  if (
    !Number.isInteger(numericTaskId)
  ) {
    return false
  }

  const rows = await sql`
    SELECT
      id,
      event_id
    FROM tasks
    WHERE id = ${numericTaskId}
    LIMIT 1
  `

  const task =
    rows[0]

  if (!task) {
    return false
  }

  if (!task.event_id) {
    return isGlobalAdmin(admin)
  }

  return adminCanAccessEvent(
    admin,
    task.event_id
  )
}


// ---------------------------------------------------------
// ACTIVITY
// ---------------------------------------------------------

export async function adminCanAccessActivity(
  admin,
  eventRoleId
) {
  const numericId =
    Number(eventRoleId)

  if (
    !Number.isInteger(numericId)
  ) {
    return false
  }

  const rows = await sql`
    SELECT
      event_id
    FROM event_roles
    WHERE id = ${numericId}
    LIMIT 1
  `

  if (!rows[0]) {
    return false
  }

  return adminCanAccessEvent(
    admin,
    rows[0].event_id
  )
}


// ---------------------------------------------------------
// REGISTRATION
// ---------------------------------------------------------

export async function adminCanAccessRegistration(
  admin,
  registrationId
) {
  const numericId =
    Number(registrationId)

  if (
    !Number.isInteger(numericId)
  ) {
    return false
  }

  const rows = await sql`
    SELECT
      event_id
    FROM event_registrations
    WHERE id = ${numericId}
    LIMIT 1
  `

  if (!rows[0]) {
    return false
  }

  return adminCanAccessEvent(
    admin,
    rows[0].event_id
  )
}
