import process from 'node:process'
import { jwtVerify } from 'jose'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

function getCookie(request, cookieName) {
  const cookieHeader = request.headers.cookie || ''

  const cookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())

  const targetCookie = cookies.find((cookie) =>
    cookie.startsWith(`${cookieName}=`)
  )

  if (!targetCookie) {
    return null
  }

  return targetCookie.substring(cookieName.length + 1)
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  try {
    const token = getCookie(
      request,
      'central_session'
    )

    if (!token) {
      return response.status(401).json({
        authenticated: false,
      })
    }

    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET
    )

    const { payload } = await jwtVerify(
      token,
      secret
    )

    const users = await sql`
      SELECT
        users.id,
        users.name,
        users.user_type,
        users.active,
        projects.name AS project
      FROM users
      JOIN projects
        ON users.project_id = projects.id
      WHERE users.id = ${payload.userId}
      LIMIT 1
    `

    const user = users[0]

    if (!user || !user.active) {
      return response.status(401).json({
        authenticated: false,
      })
    }

    const permissions = await sql`
      SELECT
        permission,
        admin_scope
      FROM user_permissions
      WHERE user_id = ${user.id}
        AND active = 1
      ORDER BY permission
    `

    const teams = await sql`
      SELECT
        t.code,
        t.name
      FROM user_teams ut
      JOIN teams t
        ON ut.team_id = t.id
      WHERE ut.user_id = ${user.id}
        AND ut.active = 1
        AND t.active = 1
      ORDER BY t.name
    `

    const permissionNames =
      permissions.map(
        (item) =>
          item.permission
      )

    const adminPermission =
      permissions.find(
        (item) =>
          item.permission === 'admin'
      )

    return response.status(200).json({
      authenticated: true,

      user: {
        id: user.id,
        name: user.name,
        project: user.project,
        userType: user.user_type,
        permissions:
          permissionNames,
        adminScope:
          adminPermission?.admin_scope ||
          null,
        teams,
      },
    })
  } catch {
    return response.status(401).json({
      authenticated: false,
    })
  }
}
