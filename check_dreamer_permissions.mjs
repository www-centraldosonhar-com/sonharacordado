import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const rows = await sql`
  SELECT
    up.user_id,
    up.permission,
    up.active,
    u.name,
    u.project_id
  FROM user_permissions up
  JOIN users u
    ON u.id = up.user_id
  ORDER BY up.user_id
  LIMIT 30
`

console.table(rows)

process.exit(0)
