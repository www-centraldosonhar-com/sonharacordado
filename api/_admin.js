import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

export const sql = neon(process.env.DATABASE_URL)

export async function requireAdmin(request) {
  const sessionUser = await getSessionUser(request)

  if (!sessionUser?.userId) {
    return null
  }

  const users = await sql`
    SELECT
      id,
      name,
      user_type,
      active
    FROM users
    WHERE id = ${sessionUser.userId}
    LIMIT 1
  `

  const user = users[0]

  if (
    !user ||
    !user.active ||
    user.user_type !== 'admin'
  ) {
    return null
  }

  return user
}
