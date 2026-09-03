import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const event = await sql`
  SELECT
    id,
    name,
    project_id,
    event_type,
    event_status,
    active
  FROM events
  WHERE id = 31
`

const teams = await sql`
  SELECT
    id,
    code,
    name,
    active
  FROM teams
  ORDER BY id
`

const activeTeams = await sql`
  SELECT
    id,
    code,
    name,
    active
  FROM teams
  WHERE active = 1
  ORDER BY id
`

console.log('\n===== EVENTO 31 =====')
console.table(event)

console.log('\n===== TODAS AS EQUIPES =====')
console.table(teams)

console.log('\n===== EQUIPES COM active = 1 =====')
console.table(activeTeams)

console.log(
  '\nTOTAL ATIVAS:',
  activeTeams.length
)
