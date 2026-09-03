import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== COLUNAS DE PROJECTS =====')

const projectColumns = await sql`
  SELECT
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'projects'
  ORDER BY ordinal_position
`

console.table(projectColumns)

console.log('\n===== PROJETOS =====')

const projects = await sql`
  SELECT *
  FROM projects
  ORDER BY id
`

console.table(projects)

console.log('\n===== CANDIDATOS: CAROL / MIKIO =====')

const users = await sql`
  SELECT
    users.id,
    users.name,
    users.full_name,
    users.username,
    users.user_type,
    users.active,
    users.project_id,
    projects.name AS project_name

  FROM users

  LEFT JOIN projects
    ON projects.id = users.project_id

  WHERE
    LOWER(COALESCE(users.name, '')) LIKE '%carol%'
    OR LOWER(COALESCE(users.full_name, '')) LIKE '%carol%'
    OR LOWER(COALESCE(users.username, '')) LIKE '%carol%'
    OR LOWER(COALESCE(users.name, '')) LIKE '%mikio%'
    OR LOWER(COALESCE(users.full_name, '')) LIKE '%mikio%'
    OR LOWER(COALESCE(users.username, '')) LIKE '%mikio%'

  ORDER BY users.id
`

console.table(users)

process.exit(0)
