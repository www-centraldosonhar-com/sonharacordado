import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const keepPattern = '%Evento da Bondade%'

const keepEvents = await sql`
  SELECT
    id,
    name,
    event_date,
    event_status
  FROM events
  WHERE name ILIKE ${keepPattern}
  ORDER BY id
`

const removeEvents = await sql`
  SELECT
    id,
    name,
    event_date,
    event_status
  FROM events
  WHERE name NOT ILIKE ${keepPattern}
  ORDER BY id
`

console.log('\n===== MANTER =====')
console.table(keepEvents)

console.log('\n===== APAGAR =====')
console.table(removeEvents)

if (!keepEvents.length) {
  throw new Error(
    'SEGURANÇA: nenhum evento com "Evento da Bondade" foi encontrado. Nada foi apagado.'
  )
}

if (!removeEvents.length) {
  console.log('\n✅ Não há outros eventos para remover.')
  process.exit(0)
}

const eventIds =
  removeEvents.map(
    (event) => Number(event.id)
  )

const placeholders =
  eventIds
    .map((_, index) => `$${index + 1}`)
    .join(', ')


async function tableExists(table) {
  const rows = await sql`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ${table}
    LIMIT 1
  `

  return rows.length > 0
}


async function hasColumn(
  table,
  column
) {
  const rows = await sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
    LIMIT 1
  `

  return rows.length > 0
}


async function deleteDirectEventRows(table) {
  if (
    !(await tableExists(table)) ||
    !(await hasColumn(table, 'event_id'))
  ) {
    return
  }

  const result = await sql.query(
    `
      DELETE FROM "${table}"
      WHERE event_id IN (${placeholders})
      RETURNING 1
    `,
    eventIds
  )

  console.log(
    `✅ ${table}: ${result.length} removidos`
  )
}


console.log('\n===== LIMPANDO DEPENDÊNCIAS =====')

/*
 * Checklist items dependem do checklist,
 * que depende de event_roles.
 */
if (
  await tableExists(
    'activity_checklist_items'
  )
) {
  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name =
        'activity_checklist_items'
  `

  const names =
    new Set(
      columns.map(
        (row) => row.column_name
      )
    )

  const checklistFk =
    names.has('checklist_id')
      ? 'checklist_id'
      : names.has(
          'activity_checklist_id'
        )
        ? 'activity_checklist_id'
        : null

  if (checklistFk) {
    const result = await sql.query(
      `
        DELETE FROM activity_checklist_items
        WHERE "${checklistFk}" IN (
          SELECT ac.id
          FROM activity_checklists ac
          JOIN event_roles er
            ON er.id = ac.event_role_id
          WHERE er.event_id IN (
            ${placeholders}
          )
        )
        RETURNING 1
      `,
      eventIds
    )

    console.log(
      `✅ activity_checklist_items: ${result.length} removidos`
    )
  }
}


/*
 * Confirmations dependem de event_roles.
 */
if (
  await tableExists('confirmations')
) {
  const result = await sql.query(
    `
      DELETE FROM confirmations
      WHERE event_role_id IN (
        SELECT id
        FROM event_roles
        WHERE event_id IN (
          ${placeholders}
        )
      )
      RETURNING 1
    `,
    eventIds
  )

  console.log(
    `✅ confirmations: ${result.length} removidos`
  )
}


/*
 * Checklists dependem de event_roles.
 */
if (
  await tableExists(
    'activity_checklists'
  )
) {
  const result = await sql.query(
    `
      DELETE FROM activity_checklists
      WHERE event_role_id IN (
        SELECT id
        FROM event_roles
        WHERE event_id IN (
          ${placeholders}
        )
      )
      RETURNING 1
    `,
    eventIds
  )

  console.log(
    `✅ activity_checklists: ${result.length} removidos`
  )
}


/*
 * Tabelas que possuem event_id diretamente.
 */
for (const table of [
  'finance_requests',
  'team_expenses',
  'post_event_feedback',
  'post_event_team_reports',
  'post_event_closures',
  'event_registrations',
]) {
  await deleteDirectEventRows(table)
}


/*
 * Event roles por último, depois de tudo
 * que aponta para eles.
 */
await deleteDirectEventRows(
  'event_roles'
)


/*
 * Finalmente os eventos.
 */
const deletedEvents =
  await sql.query(
    `
      DELETE FROM events
      WHERE id IN (${placeholders})
      RETURNING id, name
    `,
    eventIds
  )

console.log(
  `\n✅ ${deletedEvents.length} eventos removidos.`
)

console.log('\n===== EVENTOS RESTANTES =====')

console.table(await sql`
  SELECT
    id,
    name,
    event_date,
    event_status,
    active
  FROM events
  ORDER BY id
`)

console.log(
  '\n🎉 Limpeza concluída. Somente Evento da Bondade foi preservado.'
)
