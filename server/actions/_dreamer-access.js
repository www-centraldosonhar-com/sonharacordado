import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql =
  neon(process.env.DATABASE_URL)

export async function requireDreamerUser(
  request
) {
  const session =
    await getSessionUser(request)

  if (!session?.userId) {
    return null
  }

  const users = await sql`
    SELECT
      u.id,
      u.name,
      u.full_name,
      u.username,
      u.email,
      u.avatar_path,
      u.user_type,
      u.project_id,
      p.name AS project_name
    FROM users u
    JOIN projects p
      ON p.id = u.project_id
    WHERE
      u.id = ${session.userId}
      AND u.active = 1
    LIMIT 1
  `

  const user = users[0]

  if (!user) {
    return null
  }

  const permissions = await sql`
    SELECT permission
    FROM user_permissions
    WHERE
      user_id = ${user.id}
      AND active = 1
  `

  const permissionNames =
    permissions.map(
      item => item.permission
    )

  const allowed =
    permissionNames.includes(
      'volunteer'
    ) ||
    permissionNames.includes(
      'dreamer'
    )

  if (!allowed) {
    return null
  }

  const dreamerRoles = await sql`
    SELECT role_code
    FROM dreamer_roles
    WHERE
      user_id = ${user.id}
      AND active = 1
  `

  const profiles = await sql`
    SELECT
      dp.id,
      dp.preferred_project_id,
      project.name AS preferred_project,
      dp.joined_at
    FROM dreamer_profiles dp
    LEFT JOIN projects project
      ON project.id =
        dp.preferred_project_id
    WHERE
      dp.user_id = ${user.id}
      AND dp.active = 1
    LIMIT 1
  `

  return {
    ...user,

    permissions:
      permissionNames,

    dreamerProfile:
      profiles[0] || null,

    dreamerRoles:
      dreamerRoles.map(
        item => item.role_code
      ),

    isDreamerAdmin:
      dreamerRoles.some(
        item =>
          item.role_code ===
          'dreamer_admin'
      ),
  }
}
