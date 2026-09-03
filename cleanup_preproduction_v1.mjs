import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from '@neondatabase/serverless'

const EXECUTE =
  process.env.CONFIRM_CLEANUP === 'YES_I_UNDERSTAND'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const client = await pool.connect()

const EVENT_TABLES_TO_CLEAR = [
  'activity_checklist_items',
  'activity_checklists',
  'post_event_answers',
  'post_event_feedback',
  'post_event_questions',
  'post_event_team_reports',
  'post_event_closures',
  'team_expenses',
  'media_content_deliveries',
  'confirmations',
  'event_registrations',
  'event_roles',
  'dreamer_attendance_events',
]

const BACKUP_TABLES = [
  ...EVENT_TABLES_TO_CLEAR,
  'events',
]

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function count(table, where = '') {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM ${quoteIdentifier(table)}
     ${where}`
  )

  return result.rows[0].total
}

async function makeBackup() {
  const timestamp =
    new Date()
      .toISOString()
      .replaceAll(':', '-')
      .replaceAll('.', '-')

  const backupDir =
    path.resolve('./cleanup-backups')

  fs.mkdirSync(
    backupDir,
    { recursive: true }
  )

  const backup = {
    createdAt:
      new Date().toISOString(),

    purpose:
      'Backup anterior à limpeza de pré-produção',

    tables: {},
  }

  for (const table of BACKUP_TABLES) {
    const result =
      await client.query(
        `SELECT *
         FROM ${quoteIdentifier(table)}`
      )

    backup.tables[table] =
      result.rows
  }

  const inactiveUsers =
    await client.query(`
      SELECT *
      FROM users
      WHERE active = 0
      ORDER BY id
    `)

  backup.inactive_users =
    inactiveUsers.rows

  const file =
    path.join(
      backupDir,
      `preproduction-cleanup-${timestamp}.json`
    )

  fs.writeFileSync(
    file,
    JSON.stringify(
      backup,
      null,
      2
    ),
    'utf8'
  )

  return file
}

async function inspectDreamerInactiveUsers() {
  const result =
    await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc

      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name =
          kcu.constraint_name
        AND tc.constraint_schema =
          kcu.constraint_schema

      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name =
          tc.constraint_name
        AND ccu.constraint_schema =
          tc.constraint_schema

      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND tc.table_name LIKE 'dreamer_%'

      ORDER BY
        tc.table_name,
        kcu.column_name
    `)

  const problems = []

  for (const fk of result.rows) {
    const table =
      quoteIdentifier(
        fk.table_name
      )

    const column =
      quoteIdentifier(
        fk.column_name
      )

    const query =
      await client.query(`
        SELECT COUNT(*)::int AS total
        FROM ${table} source
        JOIN users u
          ON u.id =
            source.${column}
        WHERE u.active = 0
      `)

    const total =
      query.rows[0].total

    if (total > 0) {
      problems.push({
        table:
          fk.table_name,

        column:
          fk.column_name,

        total,
      })
    }
  }

  return problems
}

async function inspectBlockingInactiveReferences() {
  const fkResult =
    await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc

      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name =
          kcu.constraint_name
        AND tc.constraint_schema =
          kcu.constraint_schema

      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name =
          tc.constraint_name
        AND ccu.constraint_schema =
          tc.constraint_schema

      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name =
          tc.constraint_name
        AND rc.constraint_schema =
          tc.constraint_schema

      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND rc.delete_rule IN (
          'NO ACTION',
          'RESTRICT'
        )

      ORDER BY
        tc.table_name,
        kcu.column_name
    `)

  const blockers = []

  for (const fk of fkResult.rows) {
    const table =
      quoteIdentifier(
        fk.table_name
      )

    const column =
      quoteIdentifier(
        fk.column_name
      )

    const result =
      await client.query(`
        SELECT
          COUNT(*)::int AS total
        FROM ${table} source
        JOIN users u
          ON u.id =
            source.${column}
        WHERE u.active = 0
      `)

    const total =
      result.rows[0].total

    if (total > 0) {
      blockers.push({
        table:
          fk.table_name,

        column:
          fk.column_name,

        delete_rule:
          fk.delete_rule,

        total,
      })
    }
  }

  return blockers
}

async function showState(title) {
  console.log(`\n===== ${title} =====`)

  const result =
    await client.query(`
      SELECT
        (SELECT COUNT(*)::int
         FROM events)
          AS events,

        (SELECT COUNT(*)::int
         FROM users
         WHERE active = 0)
          AS inactive_users,

        (SELECT COUNT(*)::int
         FROM event_roles)
          AS event_roles,

        (SELECT COUNT(*)::int
         FROM confirmations)
          AS confirmations,

        (SELECT COUNT(*)::int
         FROM event_registrations)
          AS event_registrations,

        (SELECT COUNT(*)::int
         FROM activity_checklists)
          AS activity_checklists,

        (SELECT COUNT(*)::int
         FROM activity_checklist_items)
          AS activity_checklist_items,

        (SELECT COUNT(*)::int
         FROM team_expenses)
          AS team_expenses,

        (SELECT COUNT(*)::int
         FROM post_event_feedback)
          AS feedback,

        (SELECT COUNT(*)::int
         FROM post_event_answers)
          AS answers,

        (SELECT COUNT(*)::int
         FROM post_event_questions)
          AS questions,

        (SELECT COUNT(*)::int
         FROM post_event_team_reports)
          AS reports,

        (SELECT COUNT(*)::int
         FROM post_event_closures)
          AS closures,

        (SELECT COUNT(*)::int
         FROM media_content_deliveries)
          AS media_deliveries
    `)

  console.table(
    result.rows
  )
}

try {
  await showState(
    'ESTADO ATUAL'
  )

  const inactive =
    await client.query(`
      SELECT
        id,
        full_name,
        username,
        project_id,
        user_type
      FROM users
      WHERE active = 0
      ORDER BY id
    `)

  console.log(
    '\n===== USUÁRIOS INATIVOS ====='
  )

  console.table(
    inactive.rows
  )

  if (!EXECUTE) {
    console.log(
      '\n🟡 DRY RUN'
    )

    console.log(
      'Nenhum dado será apagado.'
    )

    console.log(
      '\nPara executar realmente:'
    )

    console.log(
      'CONFIRM_CLEANUP=YES_I_UNDERSTAND node cleanup_preproduction_v1.mjs'
    )

    process.exit(0)
  }

  /*
   * O backup acontece ANTES da
   * transação destrutiva.
   */
  const backupFile =
    await makeBackup()

  console.log(
    '\n💾 Backup criado:'
  )

  console.log(
    backupFile
  )

  await client.query(
    'BEGIN'
  )

  try {
    console.log(
      '\n===== LIMPANDO EVENTOS ====='
    )

    /*
     * Todos os eventos atuais serão
     * removidos.
     *
     * As tabelas abaixo são dados
     * operacionais vinculados à vida
     * dos eventos.
     */

    for (
      const table
      of EVENT_TABLES_TO_CLEAR
    ) {
      const result =
        await client.query(
          `DELETE FROM ${quoteIdentifier(table)}`
        )

      console.log(
        `${table}: ${result.rowCount}`
      )
    }

    /*
     * Verificação defensiva:
     * atualmente não há tasks
     * ligadas aos eventos.
     *
     * Se isso mudar antes da execução,
     * abortamos em vez de apagar.
     */
    const eventTasks =
      await client.query(`
        SELECT COUNT(*)::int AS total
        FROM tasks
        WHERE event_id IS NOT NULL
      `)

    if (
      eventTasks.rows[0].total > 0
    ) {
      throw new Error(
        `Existem ${eventTasks.rows[0].total} tasks ligadas a eventos. Limpeza abortada.`
      )
    }

    const deletedEvents =
      await client.query(`
        DELETE FROM events
      `)

    console.log(
      `events: ${deletedEvents.rowCount}`
    )

    /*
     * EVENT DELETE:
     *
     * admin_audit_logs.event_id
     * finance_requests.event_id
     * dreamer_frequency_snapshots.event_id
     *
     * possuem SET NULL e portanto
     * preservam seus históricos.
     */

    console.log(
      '\n===== PROTEÇÃO DREAMER ====='
    )

    const dreamerProblems =
      await inspectDreamerInactiveUsers()

    if (
      dreamerProblems.length > 0
    ) {
      console.table(
        dreamerProblems
      )

      throw new Error(
        'Existe usuário inativo com dados Dreamer. Nada foi apagado.'
      )
    }

    console.log(
      '✅ Nenhum usuário inativo possui dados Dreamer.'
    )

    /*
     * Agora que eventos, confirmações
     * e gastos desapareceram,
     * verificamos qualquer FK restante
     * que possa impedir a remoção dos
     * usuários inativos.
     */
    console.log(
      '\n===== VERIFICANDO USUÁRIOS INATIVOS ====='
    )

    const blockers =
      await inspectBlockingInactiveReferences()

    if (
      blockers.length > 0
    ) {
      console.table(
        blockers
      )

      throw new Error(
        'Existem referências protegidas aos usuários inativos. Transação cancelada.'
      )
    }

    console.log(
      '✅ Nenhuma dependência bloqueadora restante.'
    )

    const deletedUsers =
      await client.query(`
        DELETE FROM users
        WHERE active = 0
      `)

    console.log(
      `users inativos: ${deletedUsers.rowCount}`
    )

    /*
     * Validação ainda dentro da
     * transação.
     */
    const validation =
      await client.query(`
        SELECT
          (SELECT COUNT(*)::int
           FROM events)
            AS events,

          (SELECT COUNT(*)::int
           FROM users
           WHERE active = 0)
            AS inactive_users,

          (SELECT COUNT(*)::int
           FROM event_roles)
            AS event_roles,

          (SELECT COUNT(*)::int
           FROM confirmations)
            AS confirmations,

          (SELECT COUNT(*)::int
           FROM event_registrations)
            AS registrations,

          (SELECT COUNT(*)::int
           FROM team_expenses)
            AS expenses,

          (SELECT COUNT(*)::int
           FROM post_event_feedback)
            AS feedback
      `)

    const final =
      validation.rows[0]

    console.table(
      validation.rows
    )

    const clean =
      Object.values(final)
        .every(
          value => Number(value) === 0
        )

    if (!clean) {
      throw new Error(
        'A validação final encontrou registros residuais. Rollback executado.'
      )
    }

    await client.query(
      'COMMIT'
    )

    console.log(
      '\n✅ LIMPEZA CONCLUÍDA COM SUCESSO!'
    )

    console.log(
      '✅ Eventos removidos.'
    )

    console.log(
      '✅ Inscrições e confirmações removidas.'
    )

    console.log(
      '✅ Checklists removidos.'
    )

    console.log(
      '✅ Gastos removidos.'
    )

    console.log(
      '✅ Avaliações e pós-evento removidos.'
    )

    console.log(
      '✅ Usuários inativos removidos.'
    )

    console.log(
      '✅ Usuários ativos preservados.'
    )

    console.log(
      '✅ Sócio Sonhador protegido.'
    )

  } catch (error) {
    await client.query(
      'ROLLBACK'
    )

    console.error(
      '\n❌ LIMPEZA CANCELADA.'
    )

    console.error(
      'Nenhuma alteração da transação foi mantida.'
    )

    throw error
  }

  await showState(
    'ESTADO FINAL'
  )

} finally {
  client.release()
  await pool.end()
}
