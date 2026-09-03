import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const users = await sql`
  SELECT
    u.id,
    u.name,
    u.project_id,
    up.permission,
    up.admin_scope,
    up.active
  FROM users u
  LEFT JOIN user_permissions up
    ON up.user_id = u.id
  WHERE LOWER(u.name) LIKE '%bruna%'
  ORDER BY u.id, up.id
`

console.table(users)

const teams = await sql`
  SELECT
    u.id AS user_id,
    u.name,
    t.id AS team_id,
    t.code,
    t.name AS team_name,
    ut.active
  FROM users u
  LEFT JOIN user_teams ut
    ON ut.user_id = u.id
  LEFT JOIN teams t
    ON t.id = ut.team_id
  WHERE LOWER(u.name) LIKE '%bruna%'
  ORDER BY u.id, t.id
`

console.log('\n===== EQUIPES =====')
console.table(teams)
