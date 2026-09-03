import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

const constraints = await sql`
  SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(
      con.oid
    ) AS definition

  FROM pg_constraint con

  JOIN pg_class rel
    ON rel.oid =
      con.conrelid

  WHERE rel.relname =
    'event_roles'

  ORDER BY
    con.conname
`

console.table(constraints)
