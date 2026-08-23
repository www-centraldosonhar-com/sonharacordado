import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const DEMO_PREFIX =
  '[DEMO DIRETORIA]'

const events = await sql`
  SELECT id, name
  FROM events
  WHERE name LIKE ${`${DEMO_PREFIX}%`}
`

if (!events.length) {
  console.log(
    'ℹ️ Nenhum dado DEMO DIRETORIA encontrado.'
  )

  process.exit(0)
}

const ids =
  events.map(
    (event) =>
      Number(event.id)
  )

const placeholders =
  ids.map(
    (_, index) =>
      `$${index + 1}`
  ).join(', ')

async function exists(table) {
  const rows = await sql`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ${table}
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
  `

  return rows.length > 0
}

async function deleteEventRows(table) {
  if (
    !(await exists(table)) ||
    !(await hasColumn(
      table,
      'event_id'
    ))
  ) {
    return
  }

  await sql.query(
    `
      DELETE FROM "${table}"
      WHERE event_id IN (
        ${placeholders}
      )
    `,
    ids
  )

  console.log(
    `✅ ${table} limpo`
  )
}


// Itens dos checklists primeiro.
if (
  await exists(
    'activity_checklist_items'
  )
) {
  const columns =
    await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name =
        'activity_checklist_items'
        AND table_schema = 'public'
    `

  const names =
    new Set(
      columns.map(
        (row) =>
          row.column_name
      )
    )

  const fk =
    names.has('checklist_id')
      ? 'checklist_id'
      : names.has(
          'activity_checklist_id'
        )
        ? 'activity_checklist_id'
        : null

  if (fk) {
    await sql.query(
      `
        DELETE FROM activity_checklist_items
        WHERE "${fk}" IN (
          SELECT ac.id
          FROM activity_checklists ac
          JOIN event_roles er
            ON er.id =
              ac.event_role_id
          WHERE er.event_id IN (
            ${placeholders}
          )
        )
      `,
      ids
    )
  }
}


await deleteEventRows(
  'finance_requests'
)

await deleteEventRows(
  'team_expenses'
)

await deleteEventRows(
  'post_event_feedback'
)

await deleteEventRows(
  'post_event_team_reports'
)

await deleteEventRows(
  'post_event_closures'
)


if (
  await exists(
    'activity_checklists'
  )
) {
  await sql.query(
    `
      DELETE FROM activity_checklists
      WHERE event_role_id IN (
        SELECT id
        FROM event_roles
        WHERE event_id IN (
          ${placeholders}
        )
      )
    `,
    ids
  )
}


if (
  await exists(
    'confirmations'
  )
) {
  await sql.query(
    `
      DELETE FROM confirmations
      WHERE event_role_id IN (
        SELECT id
        FROM event_roles
        WHERE event_id IN (
          ${placeholders}
        )
      )
    `,
    ids
  )

  console.log(
    '✅ confirmations limpo'
  )
}

await deleteEventRows(
  'event_registrations'
)

await deleteEventRows(
  'event_roles'
)


await sql.query(
  `
    DELETE FROM events
    WHERE id IN (
      ${placeholders}
    )
  `,
  ids
)


console.log(
  '🎉 DEMO DIRETORIA removida.'
)

console.log(
  'Nenhum usuário foi apagado.'
)
