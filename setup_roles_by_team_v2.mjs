import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// ROLES BY TEAM V2
// =========================================================
// - Corrige team_id dos roles antigos.
// - Usa os códigos reais das equipes.
// - Renomeia Voluntárias -> Voluntários.
// - Cria funções-base.
// - Define quais funções podem possuir checklist.
// =========================================================

// ---------------------------------------------------------
// 1. Nome correto da equipe
// ---------------------------------------------------------

await sql`
  UPDATE teams
  SET name = 'Equipe de Voluntários'
  WHERE code = 'volunteers'
`

// ---------------------------------------------------------
// 2. Garante team_id em roles
// ---------------------------------------------------------

await sql`
  ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS team_id INTEGER
`

// ---------------------------------------------------------
// 3. Nova capacidade: checklist
// ---------------------------------------------------------

await sql`
  ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS allows_checklist INTEGER
  NOT NULL DEFAULT 0
`

const teams = await sql`
  SELECT id, code, name
  FROM teams
  WHERE active = 1
`

function teamId(code) {
  const team =
    teams.find(
      (item) =>
        item.code === code
    )

  if (!team) {
    throw new Error(
      `Equipe não encontrada: ${code}`
    )
  }

  return Number(team.id)
}

const activitiesId =
  teamId('activities')

const assistedId =
  teamId('assisted')

const mediaId =
  teamId('media')

const foodId =
  teamId('food')

const volunteersId =
  teamId('volunteers')

// ---------------------------------------------------------
// 4. Roles antigos = Mídias
// ---------------------------------------------------------

await sql`
  UPDATE roles
  SET team_id = ${mediaId}
  WHERE name IN (
    'Fotógrafo(a)',
    'Filmmaker',
    'Content Creator',
    'Photography'
  )
`

// ---------------------------------------------------------
// 5. Funções-base
// ---------------------------------------------------------

const starterRoles = [
  // ATIVIDADES
  {
    teamId: activitiesId,
    name: 'Apoio de Atividades',
    checklist: 0,
  },
  {
    teamId: activitiesId,
    name: 'Monitor(a) de Atividade',
    checklist: 0,
  },
  {
    teamId: activitiesId,
    name: 'Organização de Materiais',
    checklist: 0,
  },

  // VOLUNTÁRIOS
  {
    teamId: volunteersId,
    name: 'Conferência de Voluntários',
    checklist: 1,
  },
  {
    teamId: volunteersId,
    name: 'Recepção de Voluntários',
    checklist: 0,
  },
  {
    teamId: volunteersId,
    name: 'Apoio aos Voluntários',
    checklist: 0,
  },

  // ASSISTIDOS
  {
    teamId: assistedId,
    name: 'Conferência de Assistidos',
    checklist: 1,
  },
  {
    teamId: assistedId,
    name: 'Recepção de Assistidos',
    checklist: 0,
  },
  {
    teamId: assistedId,
    name: 'Acompanhamento de Assistidos',
    checklist: 0,
  },

  // ALIMENTAÇÃO
  {
    teamId: foodId,
    name: 'Apoio de Alimentação',
    checklist: 0,
  },
  {
    teamId: foodId,
    name: 'Distribuição de Alimentos',
    checklist: 0,
  },
  {
    teamId: foodId,
    name: 'Organização da Alimentação',
    checklist: 0,
  },
]

for (const role of starterRoles) {
  const existing = await sql`
    SELECT id
    FROM roles
    WHERE LOWER(name) =
      LOWER(${role.name})
    LIMIT 1
  `

  if (existing[0]) {
    await sql`
      UPDATE roles
      SET
        team_id = ${role.teamId},
        allows_checklist =
          ${role.checklist}
      WHERE id =
        ${existing[0].id}
    `
  } else {
    await sql`
      INSERT INTO roles (
        name,
        team_id,
        allows_checklist
      )
      VALUES (
        ${role.name},
        ${role.teamId},
        ${role.checklist}
      )
    `
  }
}

// ---------------------------------------------------------
// 6. Resultado
// ---------------------------------------------------------

console.log('')
console.log('✅ Roles V2 configurados!')
console.log('')

console.table(
  await sql`
    SELECT
      r.id,
      r.name,
      r.team_id,
      t.code AS team_code,
      t.name AS team_name,
      r.allows_checklist
    FROM roles r
    LEFT JOIN teams t
      ON t.id = r.team_id
    ORDER BY
      t.name,
      r.name
  `
)
