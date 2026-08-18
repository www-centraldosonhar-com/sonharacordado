import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const officialTeams = [
  ['activities', 'Equipe de Atividades'],
  ['volunteers', 'Equipe de Voluntárias'],
  ['assisted', 'Equipe de Assistidos'],
  ['food', 'Equipe de Alimentação'],
  ['media', 'Equipe de Mídias'],
]

// Migra Cozinha antiga para Alimentação, caso ainda exista.
const kitchen = await sql`
  SELECT id
  FROM teams
  WHERE code = 'kitchen'
  LIMIT 1
`

const food = await sql`
  SELECT id
  FROM teams
  WHERE code = 'food'
  LIMIT 1
`

if (kitchen[0] && !food[0]) {
  await sql`
    UPDATE teams
    SET
      code = 'food',
      name = 'Equipe de Alimentação'
    WHERE id = ${kitchen[0].id}
  `
}

for (const [code, name] of officialTeams) {
  await sql`
    INSERT INTO teams (
      code,
      name,
      active
    )
    VALUES (
      ${code},
      ${name},
      1
    )
    ON CONFLICT (code)
    DO UPDATE SET
      name = EXCLUDED.name,
      active = 1
  `
}

console.log('✅ Equipes oficiais prontas.')
