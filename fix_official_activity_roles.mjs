import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

const teams = await sql`
  SELECT
    id,
    code
  FROM teams
  WHERE code IN (
    'media',
    'volunteers',
    'assisted'
  )
`

const teamId = code =>
  Number(
    teams.find(
      item => item.code === code
    )?.id
  )

const mediaId =
  teamId('media')

const volunteersId =
  teamId('volunteers')

const assistedId =
  teamId('assisted')

if (
  !mediaId ||
  !volunteersId ||
  !assistedId
) {
  throw new Error(
    'Equipes obrigatórias não encontradas.'
  )
}

const roles = [
  {
    name: 'Fotógrafo(a)',
    teamId: mediaId,
    checklist: 0,
  },
  {
    name: 'Storymaker',
    teamId: mediaId,
    checklist: 0,
  },
  {
    name:
      'Recepção / Check-in de Voluntários',
    teamId: volunteersId,
    checklist: 1,
  },
  {
    name:
      'Recepção / Check-in de Assistidos',
    teamId: assistedId,
    checklist: 1,
  },
  {
    name:
      'Despedida / Check-out de Assistidos',
    teamId: assistedId,
    checklist: 1,
  },
]

for (const role of roles) {
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
        name =
          ${role.name},
        team_id =
          ${role.teamId},
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

console.log(
  '\n===== ROLES OFICIAIS ====='
)

console.table(
  await sql`
    SELECT
      r.id,
      r.name,
      t.code AS team,
      r.allows_checklist

    FROM roles r

    JOIN teams t
      ON t.id = r.team_id

    WHERE r.name IN (
      'Fotógrafo(a)',
      'Storymaker',
      'Recepção / Check-in de Voluntários',
      'Recepção / Check-in de Assistidos',
      'Despedida / Check-out de Assistidos'
    )

    ORDER BY
      t.code,
      r.name
  `
)
