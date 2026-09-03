import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from '@neondatabase/serverless'

const EXECUTE = process.env.CONFIRM_EVENT_CLEANUP === 'YES_I_UNDERSTAND'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()

const TEST_MARKERS = ['teste', 'testando', 'cenário de teste', 'cenario de teste']
const FUTURE_RESET_TABLES = [
  'post_event_answers',
  'post_event_questions',
  'post_event_feedback',
  'post_event_team_reports',
  'post_event_closures',
  'event_registrations',
]

const TEST_EVENT_DIRECT_TABLES = [
  ...FUTURE_RESET_TABLES,
  'dreamer_attendance_events',
  'media_content_deliveries',
  'team_expenses',
  'tasks',
]

function qid(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function tableExists(table) {
  const result = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${table}`]
  )
  return Boolean(result.rows[0]?.exists)
}

async function rowsForEventIds(table, eventIds) {
  if (!eventIds.length || !(await tableExists(table))) return []
  const result = await client.query(
    `SELECT * FROM ${qid(table)} WHERE event_id = ANY($1::int[])`,
    [eventIds]
  )
  return result.rows
}

async function deleteForEventIds(table, eventIds) {
  if (!eventIds.length || !(await tableExists(table))) return 0
  const result = await client.query(
    `DELETE FROM ${qid(table)} WHERE event_id = ANY($1::int[])`,
    [eventIds]
  )
  return result.rowCount
}


async function confirmationRowsForEventIds(eventIds) {
  if (!eventIds.length || !(await tableExists('confirmations')) || !(await tableExists('event_roles'))) {
    return []
  }

  const result = await client.query(`
    SELECT c.*
    FROM confirmations c
    JOIN event_roles er ON er.id = c.event_role_id
    WHERE er.event_id = ANY($1::int[])
  `, [eventIds])

  return result.rows
}

async function deleteConfirmationsForEventIds(eventIds) {
  if (!eventIds.length || !(await tableExists('confirmations')) || !(await tableExists('event_roles'))) {
    return 0
  }

  const result = await client.query(`
    DELETE FROM confirmations c
    USING event_roles er
    WHERE er.id = c.event_role_id
      AND er.event_id = ANY($1::int[])
  `, [eventIds])

  return result.rowCount
}

async function eventRoleRowsForEventIds(eventIds) {
  if (!eventIds.length || !(await tableExists('event_roles'))) return []
  const result = await client.query(
    `SELECT * FROM event_roles WHERE event_id = ANY($1::int[])`,
    [eventIds]
  )
  return result.rows
}

async function deleteEventRolesForEventIds(eventIds) {
  if (!eventIds.length || !(await tableExists('event_roles'))) return 0
  const result = await client.query(
    `DELETE FROM event_roles WHERE event_id = ANY($1::int[])`,
    [eventIds]
  )
  return result.rowCount
}

async function checklistRowsForEventIds(eventIds) {
  if (!eventIds.length) return { checklists: [], items: [] }
  if (!(await tableExists('activity_checklists'))) return { checklists: [], items: [] }

  const checklists = await client.query(`
    SELECT ac.*
    FROM activity_checklists ac
    JOIN event_roles er ON er.id = ac.event_role_id
    WHERE er.event_id = ANY($1::int[])
  `, [eventIds])

  const checklistIds = checklists.rows.map(row => Number(row.id))
  if (!checklistIds.length || !(await tableExists('activity_checklist_items'))) {
    return { checklists: checklists.rows, items: [] }
  }

  const items = await client.query(
    `SELECT * FROM activity_checklist_items WHERE checklist_id = ANY($1::int[])`,
    [checklistIds]
  )

  return { checklists: checklists.rows, items: items.rows }
}

async function deleteChecklistsForEventIds(eventIds) {
  if (!eventIds.length || !(await tableExists('activity_checklists'))) {
    return { items: 0, checklists: 0 }
  }

  const idsResult = await client.query(`
    SELECT ac.id
    FROM activity_checklists ac
    JOIN event_roles er ON er.id = ac.event_role_id
    WHERE er.event_id = ANY($1::int[])
  `, [eventIds])

  const checklistIds = idsResult.rows.map(row => Number(row.id))
  let items = 0

  if (checklistIds.length && await tableExists('activity_checklist_items')) {
    const deletedItems = await client.query(
      `DELETE FROM activity_checklist_items WHERE checklist_id = ANY($1::int[])`,
      [checklistIds]
    )
    items = deletedItems.rowCount
  }

  const deletedChecklists = await client.query(`
    DELETE FROM activity_checklists ac
    USING event_roles er
    WHERE er.id = ac.event_role_id
      AND er.event_id = ANY($1::int[])
  `, [eventIds])

  return { items, checklists: deletedChecklists.rowCount }
}

try {
  const eventsResult = await client.query(`
    SELECT id, name, project_id, event_type, event_date, event_time, active
    FROM events
    ORDER BY event_date, event_time, id
  `)

  const todayResult = await client.query(`SELECT CURRENT_DATE::text AS today`)
  const today = todayResult.rows[0].today

  const isTest = event => {
    const text = String(event.name || '').toLowerCase()
    return TEST_MARKERS.some(marker => text.includes(marker))
  }

  const testEvents = eventsResult.rows.filter(isTest)
  const futureEvents = eventsResult.rows.filter(event => String(event.event_date).slice(0, 10) >= today)
  const futureNonTestEvents = futureEvents.filter(event => !isTest(event))

  const testEventIds = testEvents.map(event => Number(event.id))
  const futureEventIds = futureNonTestEvents.map(event => Number(event.id))

  console.log('\n===== LIMPEZA DE TESTES + INSCRIÇÕES FUTURAS =====')
  console.log(`Data do banco: ${today}`)

  console.log('\n===== EVENTOS DE TESTE QUE SERÃO APAGADOS =====')
  console.table(testEvents.map(({ id, name, event_date, event_time, project_id }) => ({
    id, name, event_date, event_time, project_id,
  })))

  console.log('\n===== EVENTOS FUTUROS REAIS QUE SERÃO PRESERVADOS =====')
  console.table(futureNonTestEvents.map(({ id, name, event_date, event_time, project_id }) => ({
    id, name, event_date, event_time, project_id,
  })))

  const registrationPreview = futureEventIds.length
    ? await client.query(`
        SELECT e.id, e.name, e.event_date, COUNT(er.id)::int AS registrations
        FROM events e
        LEFT JOIN event_registrations er ON er.event_id = e.id
        WHERE e.id = ANY($1::int[])
        GROUP BY e.id, e.name, e.event_date
        ORDER BY e.event_date, e.id
      `, [futureEventIds])
    : { rows: [] }

  console.log('\n===== INSCRIÇÕES FUTURAS QUE SERÃO ZERADAS =====')
  console.table(registrationPreview.rows)

  const receiptRows = [...testEventIds, ...futureEventIds].length
    ? await client.query(`
        SELECT id, event_id, user_id, payment_receipt_path
        FROM event_registrations
        WHERE event_id = ANY($1::int[])
          AND payment_receipt_path IS NOT NULL
        ORDER BY event_id, id
      `, [[...new Set([...testEventIds, ...futureEventIds])]])
    : { rows: [] }

  if (receiptRows.rows.length) {
    console.log('\n⚠️ Comprovantes no Supabase associados aos registros removidos:')
    console.table(receiptRows.rows)
    console.log('Os registros do banco serão removidos; os arquivos físicos do Storage não são apagados por este script.')
  }

  if (!EXECUTE) {
    console.log('\n🟡 DRY RUN — nenhum dado foi alterado.')
    console.log('Para executar de verdade:')
    console.log('CONFIRM_EVENT_CLEANUP=YES_I_UNDERSTAND node --env-file=.env.local cleanup_future_event_tests_v2.mjs')
    process.exit(0)
  }

  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const backupDir = path.resolve('./cleanup-backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const allTargetIds = [...new Set([...testEventIds, ...futureEventIds])]
  const backup = {
    createdAt: new Date().toISOString(),
    databaseDate: today,
    purpose: 'Antes de apagar eventos de teste e zerar histórico de inscrições de eventos futuros',
    testEvents,
    futureEvents: futureNonTestEvents,
    tables: {},
  }

  backup.tables.events = eventsResult.rows.filter(event => allTargetIds.includes(Number(event.id)))
  for (const table of TEST_EVENT_DIRECT_TABLES) {
    backup.tables[table] = await rowsForEventIds(table, allTargetIds)
  }
  backup.tables.confirmations = await confirmationRowsForEventIds(allTargetIds)
  backup.tables.event_roles = await eventRoleRowsForEventIds(allTargetIds)
  const checklistBackup = await checklistRowsForEventIds(allTargetIds)
  backup.tables.activity_checklists = checklistBackup.checklists
  backup.tables.activity_checklist_items = checklistBackup.items

  const backupFile = path.join(backupDir, `future-event-cleanup-${timestamp}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\n💾 Backup criado: ${backupFile}`)

  await client.query('BEGIN')
  try {
    console.log('\n===== ZERANDO HISTÓRICO DOS EVENTOS FUTUROS =====')

    const checklistDeleted = await deleteChecklistsForEventIds(futureEventIds)
    console.log(`activity_checklist_items: ${checklistDeleted.items}`)
    console.log(`activity_checklists: ${checklistDeleted.checklists}`)

    const futureConfirmations = await deleteConfirmationsForEventIds(futureEventIds)
    console.log(`confirmations: ${futureConfirmations}`)

    for (const table of FUTURE_RESET_TABLES) {
      const count = await deleteForEventIds(table, futureEventIds)
      console.log(`${table}: ${count}`)
    }

    console.log('\n===== APAGANDO EVENTOS DE TESTE =====')
    if (testEventIds.length) {
      // Itens/checklists são removidos primeiro para evitar resíduos em schemas antigos.
      await deleteChecklistsForEventIds(testEventIds)

      // Limpa explicitamente dados conhecidos; confirmations depende de event_roles.
      await deleteConfirmationsForEventIds(testEventIds)
      for (const table of TEST_EVENT_DIRECT_TABLES) {
        await deleteForEventIds(table, testEventIds)
      }
      await deleteEventRolesForEventIds(testEventIds)

      const deletedEvents = await client.query(
        `DELETE FROM events WHERE id = ANY($1::int[])`,
        [testEventIds]
      )
      console.log(`events de teste: ${deletedEvents.rowCount}`)
    } else {
      console.log('Nenhum evento de teste encontrado pelos marcadores seguros.')
    }

    await client.query('COMMIT')
    console.log('\n✅ LIMPEZA CONCLUÍDA!')
    console.log('✅ Eventos reais futuros preservados.')
    console.log('✅ Inscrições/confirmações/checklists futuros zerados.')
    console.log('✅ Eventos claramente marcados como teste removidos.')
    console.log('✅ Histórico de eventos já realizados preservado.')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('\n❌ Erro: rollback executado. Nenhuma alteração da transação foi mantida.')
    throw error
  }
} finally {
  client.release()
  await pool.end()
}
