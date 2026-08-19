import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// CENTRAL DO SONHAR — CONTENT SCOPE V1
// =========================================================
//
// tasks:
//   project_id + team_id
//
// announcements:
//   project_id + team_id
//
// event_roles:
//   team_id
//
// NULL significa que aquele nível não restringe
// o conteúdo.
//
// Exemplos:
//
// project=NULL / team=NULL
// → global
//
// project=APS / team=NULL
// → todo APS
//
// project=APS / team=Alimentação
// → Alimentação APS
//
// project=NULL / team=Mídias
// → Mídias transversal
// =========================================================


// ---------------------------------------------------------
// TASKS
// ---------------------------------------------------------

await sql`
  ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS
    project_id INTEGER
`

await sql`
  ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS
    team_id INTEGER
`

// Missões antigas relacionadas a evento herdam
// automaticamente o projeto desse evento.
await sql`
  UPDATE tasks t
  SET project_id = e.project_id
  FROM events e
  WHERE t.event_id = e.id
    AND t.project_id IS NULL
    AND e.project_id IS NOT NULL
`


// ---------------------------------------------------------
// ANNOUNCEMENTS
// ---------------------------------------------------------

await sql`
  ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS
    project_id INTEGER
`

await sql`
  ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS
    team_id INTEGER
`


// ---------------------------------------------------------
// EVENT ROLES / ACTIVITIES
// ---------------------------------------------------------

await sql`
  ALTER TABLE event_roles
  ADD COLUMN IF NOT EXISTS
    team_id INTEGER
`


// ---------------------------------------------------------
// FOREIGN KEYS
// ---------------------------------------------------------
// Cada bloco verifica a constraint antes de criar.
// ---------------------------------------------------------

const constraints = await sql`
  SELECT conname
  FROM pg_constraint
  WHERE conname IN (
    'tasks_project_id_fkey_scope',
    'tasks_team_id_fkey_scope',
    'announcements_project_id_fkey_scope',
    'announcements_team_id_fkey_scope',
    'event_roles_team_id_fkey_scope'
  )
`

const constraintNames =
  new Set(
    constraints.map(
      (item) => item.conname
    )
  )

if (
  !constraintNames.has(
    'tasks_project_id_fkey_scope'
  )
) {
  await sql`
    ALTER TABLE tasks
    ADD CONSTRAINT
      tasks_project_id_fkey_scope
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE SET NULL
  `
}

if (
  !constraintNames.has(
    'tasks_team_id_fkey_scope'
  )
) {
  await sql`
    ALTER TABLE tasks
    ADD CONSTRAINT
      tasks_team_id_fkey_scope
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE SET NULL
  `
}

if (
  !constraintNames.has(
    'announcements_project_id_fkey_scope'
  )
) {
  await sql`
    ALTER TABLE announcements
    ADD CONSTRAINT
      announcements_project_id_fkey_scope
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE SET NULL
  `
}

if (
  !constraintNames.has(
    'announcements_team_id_fkey_scope'
  )
) {
  await sql`
    ALTER TABLE announcements
    ADD CONSTRAINT
      announcements_team_id_fkey_scope
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE SET NULL
  `
}

if (
  !constraintNames.has(
    'event_roles_team_id_fkey_scope'
  )
) {
  await sql`
    ALTER TABLE event_roles
    ADD CONSTRAINT
      event_roles_team_id_fkey_scope
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE SET NULL
  `
}

console.log('')
console.log('✅ Content Scope v1 database ready!')
console.log('')
console.log('Created / verified:')
console.log('• tasks.project_id')
console.log('• tasks.team_id')
console.log('• announcements.project_id')
console.log('• announcements.team_id')
console.log('• event_roles.team_id')
