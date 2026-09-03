import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const rows = await sql`
  SELECT
    u.id,
    u.name,
    u.full_name,
    u.username,
    u.user_type,
    u.active,

    COALESCE(
      STRING_AGG(
        up.permission || ':' || up.active,
        ', '
        ORDER BY up.permission
      ),
      ''
    ) AS permissions

  FROM users u

  LEFT JOIN user_permissions up
    ON up.user_id = u.id

  WHERE
    u.project_id = 2
    AND u.active = 1

  GROUP BY
    u.id,
    u.name,
    u.full_name,
    u.username,
    u.user_type,
    u.active

  ORDER BY
    COALESCE(
      NULLIF(u.full_name, ''),
      u.name
    )
`

console.table(rows)

console.log(
  `\nTOTAL ATIVOS PPF: ${rows.length}`
)

process.exit(0)
