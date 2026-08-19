import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// ROLES BY TEAM V1
// =========================================================

await sql`
  ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS team_id INTEGER
`

const constraint = await sql`
  SELECT 1
  FROM pg_constraint
  WHERE conname = 'roles_team_id_fkey'
  LIMIT 1
`

if (!constraint[0]) {
  await sql`
    ALTER TABLE roles
    ADD CONSTRAINT roles_team_id_fkey
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE SET NULL
  `
}

const teams = await sql`
  SELECT id, code, name
  FROM teams
  WHERE active = 1
`

function findTeam(code) {
  return teams.find(
    (team) => team.code === code
  )
}

const media = findTeam('media')
const activities = findTeam('activities')
const volunteers = findTeam('volunteers')
const assisted = findTeam('assisted')
const kitchen = findTeam('kitchen')

for (const [label, team] of [
  ['Mídias', media],
  ['Atividades', activities],
  ['Voluntárias', volunteers],
  ['Assistidos', assisted],
  ['Alimentação', kitchen],
]) {
  if (!team) {
    throw new Error(
      `Equipe não encontrada no banco: ${label}`
    )
  }
}

// ---------------------------------------------------------
// Papéis antigos são de Mídias.
// ---------------------------------------------------------

await sql`
  UPDATE roles
  SET team_id = ${media.id}
  WHERE team_id IS NULL
    AND name IN (
      'Fotógrafo(a)',
      'Filmmaker',
      'Content Creator',
      'Photography'
    )
`

// ---------------------------------------------------------
// Funções-base das equipes.
// ---------------------------------------------------------

const starterRoles = [
  [activities.id, 'Apoio de Atividades'],
  [activities.id, 'Monitor(a) de Atividade'],
  [activities.id, 'Organização de Materiais'],

  [volunteers.id, 'Recepção de Voluntários'],
  [volunteers.id, 'Credenciamento'],
  [volunteers.id, 'Apoio aos Voluntários'],

  [assisted.id, 'Acompanhamento de Assistidos'],
  [assisted.id, 'Recepção de Assistidos'],
  [assisted.id, 'Apoio de Grupo'],

  [kitchen.id, 'Apoio de Alimentação'],
  [kitchen.id, 'Distribuição de Alimentos'],
  [kitchen.id, 'Organização da Alimentação'],
]

for (const [teamId, name] of starterRoles) {
  const exists = await sql`
    SELECT id
    FROM roles
    WHERE LOWER(name) = LOWER(${name})
      AND team_id = ${teamId}
    LIMIT 1
  `

  if (!exists[0]) {
    await sql`
      INSERT INTO roles (
        name,
        team_id
      )
      VALUES (
        ${name},
        ${teamId}
      )
    `
  }
}

console.log('✅ Roles organizados por equipe.')
console.table(
  await sql`
    SELECT
      r.id,
      r.name,
      t.name AS team
    FROM roles r
    LEFT JOIN teams t
      ON t.id = r.team_id
    ORDER BY t.name, r.name
  `
)
