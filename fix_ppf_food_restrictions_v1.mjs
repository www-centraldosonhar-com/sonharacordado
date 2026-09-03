import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const targets = [
  {
    name: 'Cauê Vitalino',
    allergies: 'SIM — Restrição alimentar: Camarão',
  },
  {
    name: 'Pedro Henrique Rodrigues da Silva',
    allergies: 'SIM — Restrição alimentar: Camarão',
  },
  {
    name: 'Kethelyn santos da Silva',
    allergies:
      'SIM — Restrição alimentar: Não pode comer doces, dependendo do destro',
  },
]

const projectRows = await sql`
  SELECT id, name
  FROM projects
  WHERE UPPER(TRIM(name)) = 'PPF'
  LIMIT 1
`

if (!projectRows.length) {
  throw new Error('Projeto PPF não encontrado.')
}

const project = projectRows[0]

console.log(`📌 Projeto: ${project.name} (ID ${project.id})`)
console.log('🔎 Conferindo os 3 assistidos...')

const found = []

for (const target of targets) {
  const rows = await sql`
    SELECT
      id,
      full_name,
      allergies
    FROM assisted_people
    WHERE
      project_id = ${project.id}
      AND LOWER(TRIM(full_name)) =
        LOWER(TRIM(${target.name}))
    LIMIT 2
  `

  if (rows.length === 0) {
    throw new Error(
      `Assistido não encontrado no PPF: ${target.name}`
    )
  }

  if (rows.length > 1) {
    throw new Error(
      `Cadastro duplicado encontrado no PPF: ${target.name}`
    )
  }

  found.push({
    ...target,
    id: rows[0].id,
    currentAllergies: rows[0].allergies,
  })
}

console.log('\n🧾 Alterações:')
for (const person of found) {
  console.log(`• ${person.name}`)
  console.log(`  Antes: ${person.currentAllergies || '(vazio)'}`)
  console.log(`  Depois: ${person.allergies}`)
}

await sql`BEGIN`

try {
  for (const person of found) {
    await sql`
      UPDATE assisted_people
      SET
        allergies = ${person.allergies},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${person.id}
    `
  }

  await sql`COMMIT`
} catch (error) {
  await sql`ROLLBACK`
  throw error
}

const ids = found.map((person) => Number(person.id))

const result = await sql`
  SELECT
    ap.id,
    ap.full_name,
    ap.allergies,
    p.name AS project_name
  FROM assisted_people ap
  JOIN projects p
    ON p.id = ap.project_id
  WHERE ap.id = ANY(${ids})
  ORDER BY ap.full_name
`

console.log('\n✅ Restrições alimentares corrigidas no Neon:')
for (const row of result) {
  console.log(
    `• ${row.full_name} — ${row.allergies}`
  )
}
