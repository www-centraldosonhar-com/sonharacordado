import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== TODOS OS USUÁRIOS ATIVOS POR PROJETO =====')

const activeUsers = await sql`
  SELECT
    p.id AS project_id,
    p.name AS project,
    COUNT(DISTINCT u.id)::int AS total
  FROM users u
  JOIN projects p
    ON p.id = u.project_id
  WHERE
    u.active = 1
    AND p.id IN (1, 2, 3)
  GROUP BY p.id, p.name
  ORDER BY p.id
`

console.table(activeUsers)


console.log('\n===== TODOS POR PROJETO, SEM FILTRO ACTIVE =====')

const allUsers = await sql`
  SELECT
    p.id AS project_id,
    p.name AS project,
    COUNT(DISTINCT u.id)::int AS total
  FROM users u
  JOIN projects p
    ON p.id = u.project_id
  WHERE
    p.id IN (1, 2, 3)
  GROUP BY p.id, p.name
  ORDER BY p.id
`

console.table(allUsers)


console.log('\n===== ACTIVE SEM PERMISSION VOLUNTEER =====')

const missingPermission = await sql`
  SELECT
    p.id AS project_id,
    p.name AS project,
    COUNT(DISTINCT u.id)::int AS total
  FROM users u
  JOIN projects p
    ON p.id = u.project_id
  WHERE
    u.active = 1
    AND p.id IN (1, 2, 3)

    AND NOT EXISTS (
      SELECT 1
      FROM user_permissions up
      WHERE
        up.user_id = u.id
        AND up.permission = 'volunteer'
        AND up.active = 1
    )

  GROUP BY p.id, p.name
  ORDER BY p.id
`

console.table(missingPermission)

process.exit(0)
