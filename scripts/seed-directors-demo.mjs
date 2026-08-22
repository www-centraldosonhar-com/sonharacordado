import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const DEMO_PREFIX = '[DEMO DIRETORIA]'

const BRUNA_ID = 5
const RODRIGO_ID = 6
const MARIANE_ID = 10

// Voluntários reais usados apenas como participantes da demo.
// Nenhum cadastro ou permissão deles será alterado.
const DEMO_VOLUNTEERS = [1, 3, 4]


// ============================================================
// HELPERS DE SCHEMA
// ============================================================

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


async function getColumns(table) {
  return sql`
    SELECT
      column_name,
      column_default,
      is_identity
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
    ORDER BY ordinal_position
  `
}


async function getOne(query, params = []) {
  const rows = await sql.query(
    query,
    params
  )

  return rows[0] || null
}


async function cloneRow(
  table,
  template,
  overrides = {}
) {
  if (!template) {
    throw new Error(
      `Tabela ${table}: nenhum registro modelo disponível.`
    )
  }

  const schema =
    await getColumns(table)

  const columns =
    schema
      .filter((column) => {
        if (
          column.column_name === 'id'
        ) {
          return false
        }

        if (
          column.is_identity === 'YES'
        ) {
          return false
        }

        return Object.prototype.hasOwnProperty.call(
          template,
          column.column_name
        )
      })
      .map(
        (column) =>
          column.column_name
      )

  const values =
    columns.map((column) => {
      if (
        Object.prototype.hasOwnProperty.call(
          overrides,
          column
        )
      ) {
        return overrides[column]
      }

      return template[column]
    })

  const quotedColumns =
    columns
      .map(
        (column) =>
          `"${column}"`
      )
      .join(', ')

  const placeholders =
    columns
      .map(
        (_, index) =>
          `$${index + 1}`
      )
      .join(', ')

  const query = `
    INSERT INTO "${table}"
      (${quotedColumns})
    VALUES
      (${placeholders})
    RETURNING *
  `

  const rows =
    await sql.query(
      query,
      values
    )

  return rows[0]
}


function applyIfPresent(
  template,
  overrides,
  candidates,
  value
) {
  for (const candidate of candidates) {
    if (
      Object.prototype.hasOwnProperty.call(
        template,
        candidate
      )
    ) {
      overrides[candidate] = value
    }
  }
}


async function deleteByEventIds(
  table,
  eventIds
) {
  if (
    !(await tableExists(table)) ||
    !eventIds.length
  ) {
    return
  }

  const columns =
    await getColumns(table)

  const hasEventId =
    columns.some(
      (column) =>
        column.column_name ===
        'event_id'
    )

  if (!hasEventId) {
    return
  }

  const placeholders =
    eventIds.map(
      (_, index) =>
        `$${index + 1}`
    )

  await sql.query(
    `
      DELETE FROM "${table}"
      WHERE event_id IN (
        ${placeholders.join(', ')}
      )
    `,
    eventIds
  )
}


// ============================================================
// LIMPA DEMO ANTERIOR
// ============================================================

async function cleanupExistingDemo() {
  const events = await sql`
    SELECT id
    FROM events
    WHERE name LIKE ${`${DEMO_PREFIX}%`}
  `

  const eventIds =
    events.map(
      (event) =>
        Number(event.id)
    )

  if (!eventIds.length) {
    return
  }

  console.log(
    '🧹 Removendo demo anterior...'
  )

  // Filhos mais profundos primeiro.
  if (
    await tableExists(
      'activity_checklist_items'
    )
  ) {
    const checklistIds =
      await sql.query(
        `
          SELECT ac.id
          FROM activity_checklists ac
          JOIN event_roles er
            ON er.id =
              ac.event_role_id
          WHERE er.event_id IN (
            ${eventIds
              .map(
                (_, index) =>
                  `$${index + 1}`
              )
              .join(', ')}
          )
        `,
        eventIds
      )

    if (checklistIds.length) {
      const ids =
        checklistIds.map(
          (row) =>
            Number(row.id)
        )

      const fkCandidates = [
        'checklist_id',
        'activity_checklist_id',
      ]

      const itemColumns =
        await getColumns(
          'activity_checklist_items'
        )

      const fk =
        fkCandidates.find(
          (candidate) =>
            itemColumns.some(
              (column) =>
                column.column_name ===
                candidate
            )
        )

      if (fk) {
        await sql.query(
          `
            DELETE FROM activity_checklist_items
            WHERE "${fk}" IN (
              ${ids
                .map(
                  (_, index) =>
                    `$${index + 1}`
                )
                .join(', ')}
            )
          `,
          ids
        )
      }
    }
  }

  await deleteByEventIds(
    'finance_requests',
    eventIds
  )

  await deleteByEventIds(
    'team_expenses',
    eventIds
  )

  await deleteByEventIds(
    'post_event_feedback',
    eventIds
  )

  await deleteByEventIds(
    'post_event_team_reports',
    eventIds
  )

  await deleteByEventIds(
    'post_event_closures',
    eventIds
  )

  // Checklists dependem de event_roles.
  if (
    await tableExists(
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
            ${eventIds
              .map(
                (_, index) =>
                  `$${index + 1}`
              )
              .join(', ')}
          )
        )
      `,
      eventIds
    )
  }

  if (
    await tableExists(
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
            ${eventIds
              .map(
                (_, index) =>
                  `$${index + 1}`
              )
              .join(', ')}
          )
        )
      `,
      eventIds
    )

    console.log(
      '✅ confirmations limpo'
    )
  }

  await deleteByEventIds(
    'event_registrations',
    eventIds
  )

  await deleteByEventIds(
    'event_roles',
    eventIds
  )

  await sql.query(
    `
      DELETE FROM events
      WHERE id IN (
        ${eventIds
          .map(
            (_, index) =>
              `$${index + 1}`
          )
          .join(', ')}
      )
    `,
    eventIds
  )
}


// ============================================================
// EVENTOS DEMO
// ============================================================

await cleanupExistingDemo()

console.log(
  '\n🎬 Preparando apresentação da diretoria...\n'
)

const futureTemplate =
  await getOne(`
    SELECT *
    FROM events
    WHERE event_status <> 'post_event'
    ORDER BY id DESC
    LIMIT 1
  `)

const postTemplate =
  await getOne(`
    SELECT *
    FROM events
    WHERE event_status = 'post_event'
    ORDER BY id DESC
    LIMIT 1
  `) ||
  futureTemplate


if (!futureTemplate) {
  throw new Error(
    'Não há nenhum evento existente para usar como modelo.'
  )
}


const futureDate =
  new Date()

futureDate.setDate(
  futureDate.getDate() + 14
)

const futureDateText =
  futureDate
    .toISOString()
    .slice(0, 10)


const pastDate =
  new Date()

pastDate.setDate(
  pastDate.getDate() - 7
)

const pastDateText =
  pastDate
    .toISOString()
    .slice(0, 10)


const futureOverrides = {}

applyIfPresent(
  futureTemplate,
  futureOverrides,
  ['name'],
  `${DEMO_PREFIX} Encontro Sonhar`
)

applyIfPresent(
  futureTemplate,
  futureOverrides,
  ['event_date'],
  futureDateText
)

applyIfPresent(
  futureTemplate,
  futureOverrides,
  ['location'],
  'Espaço Sonhar — Demonstração'
)

applyIfPresent(
  futureTemplate,
  futureOverrides,
  ['active'],
  1
)

applyIfPresent(
  futureTemplate,
  futureOverrides,
  [
    'deadline',
    'registration_deadline',
  ],
  futureDateText
)


const futureEvent =
  await cloneRow(
    'events',
    futureTemplate,
    futureOverrides
  )


const postOverrides = {}

applyIfPresent(
  postTemplate,
  postOverrides,
  ['name'],
  `${DEMO_PREFIX} Evento Encerrado`
)

applyIfPresent(
  postTemplate,
  postOverrides,
  ['event_date'],
  pastDateText
)

applyIfPresent(
  postTemplate,
  postOverrides,
  ['location'],
  'Espaço Sonhar — Demonstração'
)

applyIfPresent(
  postTemplate,
  postOverrides,
  ['active'],
  1
)

applyIfPresent(
  postTemplate,
  postOverrides,
  ['event_status'],
  'post_event'
)


const postEvent =
  await cloneRow(
    'events',
    postTemplate,
    postOverrides
  )


console.log(
  `✅ Evento futuro: ${futureEvent.name}`
)

console.log(
  `✅ Evento encerrado: ${postEvent.name}`
)


// ============================================================
// EQUIPES / FUNÇÕES
// ============================================================

const volunteersTeam =
  await getOne(
    `
      SELECT *
      FROM teams
      WHERE code = $1
      LIMIT 1
    `,
    ['volunteers']
  )

const mediaTeam =
  await getOne(
    `
      SELECT *
      FROM teams
      WHERE code = $1
      LIMIT 1
    `,
    ['media']
  )


if (
  !volunteersTeam ||
  !mediaTeam
) {
  throw new Error(
    'Equipes Voluntários/Mídias não encontradas.'
  )
}


const checkinRole =
  await getOne(
    `
      SELECT *
      FROM roles
      WHERE team_id = $1
      ORDER BY
        CASE
          WHEN name ILIKE '%check%'
            THEN 0
          WHEN name ILIKE '%recep%'
            THEN 1
          ELSE 2
        END,
        id
      LIMIT 1
    `,
    [volunteersTeam.id]
  )


const mediaRole =
  await getOne(
    `
      SELECT *
      FROM roles
      WHERE team_id = $1
      ORDER BY
        CASE
          WHEN name ILIKE '%fot%'
            THEN 0
          WHEN name ILIKE '%film%'
            THEN 1
          ELSE 2
        END,
        id
      LIMIT 1
    `,
    [mediaTeam.id]
  )


const eventRoleTemplate =
  await getOne(`
    SELECT *
    FROM event_roles
    ORDER BY id DESC
    LIMIT 1
  `)


function eventRoleOverrides(
  role,
  team,
  delivery
) {
  const overrides = {}

  applyIfPresent(
    eventRoleTemplate,
    overrides,
    ['event_id'],
    futureEvent.id
  )

  applyIfPresent(
    eventRoleTemplate,
    overrides,
    ['role_id'],
    role.id
  )

  applyIfPresent(
    eventRoleTemplate,
    overrides,
    ['team_id'],
    team.id
  )

  applyIfPresent(
    eventRoleTemplate,
    overrides,
    [
      'vacancy_limit',
      'vacancies',
      'slots',
    ],
    6
  )

  applyIfPresent(
    eventRoleTemplate,
    overrides,
    ['requires_delivery'],
    delivery ? 1 : 0
  )

  applyIfPresent(
    eventRoleTemplate,
    overrides,
    ['community_visible'],
    1
  )

  applyIfPresent(
    eventRoleTemplate,
    overrides,
    ['active'],
    1
  )

  return overrides
}


const checkinEventRole =
  await cloneRow(
    'event_roles',
    eventRoleTemplate,
    eventRoleOverrides(
      checkinRole,
      volunteersTeam,
      false
    )
  )


const mediaEventRole =
  await cloneRow(
    'event_roles',
    eventRoleTemplate,
    eventRoleOverrides(
      mediaRole,
      mediaTeam,
      true
    )
  )


console.log(
  `✅ Check-in: ${checkinRole.name} — Bruna`
)

console.log(
  `✅ Mídias: ${mediaRole.name} — Rodrigo`
)


// ============================================================
// INSCRIÇÕES
// ============================================================

const registrationTemplate =
  await getOne(`
    SELECT *
    FROM event_registrations
    ORDER BY id DESC
    LIMIT 1
  `)


const registrations = []

for (
  let index = 0;
  index < DEMO_VOLUNTEERS.length;
  index += 1
) {
  const userId =
    DEMO_VOLUNTEERS[index]

  const overrides = {}

  applyIfPresent(
    registrationTemplate,
    overrides,
    ['event_id'],
    futureEvent.id
  )

  applyIfPresent(
    registrationTemplate,
    overrides,
    ['user_id'],
    userId
  )

  applyIfPresent(
    registrationTemplate,
    overrides,
    ['status'],
    'confirmed'
  )

  applyIfPresent(
    registrationTemplate,
    overrides,
    ['team'],
    index === 0
      ? mediaTeam.code
      : volunteersTeam.code
  )

  applyIfPresent(
    registrationTemplate,
    overrides,
    ['created_at'],
    new Date()
  )

  const registration =
    await cloneRow(
      'event_registrations',
      registrationTemplate,
      overrides
    )

  registrations.push(
    registration
  )
}

console.log(
  `✅ ${registrations.length} inscrições de demonstração`
)


// ============================================================
// CONFIRMAÇÕES DE ATIVIDADES
// ============================================================

const confirmationTemplate =
  await getOne(`
    SELECT *
    FROM confirmations
    ORDER BY id DESC
    LIMIT 1
  `)


async function createConfirmation(
  userId,
  eventRoleId
) {
  const overrides = {}

  applyIfPresent(
    confirmationTemplate,
    overrides,
    ['user_id'],
    userId
  )

  applyIfPresent(
    confirmationTemplate,
    overrides,
    ['event_role_id'],
    eventRoleId
  )

  applyIfPresent(
    confirmationTemplate,
    overrides,
    ['status'],
    'confirmed'
  )

  return cloneRow(
    'confirmations',
    confirmationTemplate,
    overrides
  )
}


await createConfirmation(
  DEMO_VOLUNTEERS[0],
  mediaEventRole.id
)

await createConfirmation(
  DEMO_VOLUNTEERS[1],
  checkinEventRole.id
)

await createConfirmation(
  DEMO_VOLUNTEERS[2],
  checkinEventRole.id
)

console.log(
  '✅ Atividades de Mídias e Check-in confirmadas'
)


// ============================================================
// CHECK-IN — BRUNA
// ============================================================

if (
  await tableExists(
    'activity_checklists'
  )
) {
  const checklistTemplate =
    await getOne(`
      SELECT *
      FROM activity_checklists
      ORDER BY id DESC
      LIMIT 1
    `)

  if (checklistTemplate) {
    const overrides = {}

    applyIfPresent(
      checklistTemplate,
      overrides,
      ['event_role_id'],
      checkinEventRole.id
    )

    applyIfPresent(
      checklistTemplate,
      overrides,
      ['title'],
      `${DEMO_PREFIX} Check-in de Voluntários`
    )

    applyIfPresent(
      checklistTemplate,
      overrides,
      ['assigned_user_id'],
      BRUNA_ID
    )

    applyIfPresent(
      checklistTemplate,
      overrides,
      ['active'],
      1
    )

    applyIfPresent(
      checklistTemplate,
      overrides,
      ['source_type'],
      'event_registrations'
    )

    const checklist =
      await cloneRow(
        'activity_checklists',
        checklistTemplate,
        overrides
      )

    const itemTemplate =
      await getOne(`
        SELECT *
        FROM activity_checklist_items
        ORDER BY id DESC
        LIMIT 1
      `)

    if (itemTemplate) {
      const itemColumns =
        await getColumns(
          'activity_checklist_items'
        )

      const checklistFk =
        [
          'checklist_id',
          'activity_checklist_id',
        ].find(
          (candidate) =>
            itemColumns.some(
              (column) =>
                column.column_name ===
                candidate
            )
        )

      for (
        let index = 0;
        index < registrations.length;
        index += 1
      ) {
        const itemOverrides = {}

        if (checklistFk) {
          itemOverrides[
            checklistFk
          ] = checklist.id
        }

        applyIfPresent(
          itemTemplate,
          itemOverrides,
          ['registration_id'],
          registrations[index].id
        )

        applyIfPresent(
          itemTemplate,
          itemOverrides,
          ['checked'],
          index < 2 ? 1 : 0
        )

        applyIfPresent(
          itemTemplate,
          itemOverrides,
          ['checked_by'],
          index < 2
            ? BRUNA_ID
            : null
        )

        applyIfPresent(
          itemTemplate,
          itemOverrides,
          ['checked_at'],
          index < 2
            ? new Date()
            : null
        )

        applyIfPresent(
          itemTemplate,
          itemOverrides,
          ['notes'],
          `${DEMO_PREFIX} Check-in`
        )

        await cloneRow(
          'activity_checklist_items',
          itemTemplate,
          itemOverrides
        )
      }
    }

    console.log(
      '✅ Checklist preparado para Bruna'
    )
  }
}


// ============================================================
// GASTOS
// ============================================================

if (
  await tableExists(
    'team_expenses'
  )
) {
  const expenseTemplate =
    await getOne(`
      SELECT *
      FROM team_expenses
      ORDER BY id DESC
      LIMIT 1
    `)

  if (expenseTemplate) {
    const expenses = [
      {
        label:
          'Materiais para recepção',
        amount:
          85.50,
        teamId:
          volunteersTeam.id,
        userId:
          BRUNA_ID,
      },
      {
        label:
          'Impressões e identificação',
        amount:
          142.90,
        teamId:
          volunteersTeam.id,
        userId:
          BRUNA_ID,
      },
      {
        label:
          'Material de apoio para Mídias',
        amount:
          219.00,
        teamId:
          mediaTeam.id,
        userId:
          RODRIGO_ID,
      },
    ]

    for (const expense of expenses) {
      const overrides = {}

      applyIfPresent(
        expenseTemplate,
        overrides,
        ['event_id'],
        futureEvent.id
      )

      applyIfPresent(
        expenseTemplate,
        overrides,
        ['team_id'],
        expense.teamId
      )

      applyIfPresent(
        expenseTemplate,
        overrides,
        [
          'user_id',
          'created_by',
          'submitted_by',
          'requested_by',
        ],
        expense.userId
      )

      applyIfPresent(
        expenseTemplate,
        overrides,
        [
          'amount',
          'value',
          'total_amount',
        ],
        expense.amount
      )

      applyIfPresent(
        expenseTemplate,
        overrides,
        [
          'title',
          'description',
          'item',
          'item_name',
        ],
        `${DEMO_PREFIX} ${expense.label}`
      )

      applyIfPresent(
        expenseTemplate,
        overrides,
        ['notes'],
        `${DEMO_PREFIX} Apresentação da diretoria`
      )

      await cloneRow(
        'team_expenses',
        expenseTemplate,
        overrides
      )
    }

    console.log(
      '✅ 3 gastos de demonstração'
    )
  }
}


// ============================================================
// FINANCEIRO
// ============================================================

if (
  await tableExists(
    'finance_requests'
  )
) {
  const financeTemplate =
    await getOne(`
      SELECT *
      FROM finance_requests
      ORDER BY id DESC
      LIMIT 1
    `)

  if (financeTemplate) {
    for (
      const [index, amount] of
      [350, 180].entries()
    ) {
      const overrides = {}

      applyIfPresent(
        financeTemplate,
        overrides,
        ['event_id'],
        futureEvent.id
      )

      applyIfPresent(
        financeTemplate,
        overrides,
        [
          'user_id',
          'requested_by',
          'created_by',
        ],
        index === 0
          ? RODRIGO_ID
          : BRUNA_ID
      )

      applyIfPresent(
        financeTemplate,
        overrides,
        ['answered_by'],
        MARIANE_ID
      )

      applyIfPresent(
        financeTemplate,
        overrides,
        [
          'amount',
          'value',
          'requested_amount',
        ],
        amount
      )

      applyIfPresent(
        financeTemplate,
        overrides,
        [
          'title',
          'subject',
          'description',
          'request',
          'message',
        ],
        `${DEMO_PREFIX} Solicitação ${
          index + 1
        }`
      )

      applyIfPresent(
        financeTemplate,
        overrides,
        ['notes'],
        `${DEMO_PREFIX} Fluxo financeiro`
      )

      /*
       * Mantemos o status existente no template.
       * Assim respeitamos qualquer CHECK constraint
       * do banco atual.
       */
      await cloneRow(
        'finance_requests',
        financeTemplate,
        overrides
      )
    }

    console.log(
      '✅ Solicitações financeiras preparadas para Mariane'
    )
  }
}


// ============================================================
// PÓS-EVENTO
// ============================================================

for (
  const table of [
    'post_event_closures',
    'post_event_feedback',
    'post_event_team_reports',
  ]
) {
  if (!(await tableExists(table))) {
    continue
  }

  const template =
    await getOne(
      `SELECT * FROM "${table}" ORDER BY id DESC LIMIT 1`
    )

  if (!template) {
    continue
  }

  const overrides = {}

  applyIfPresent(
    template,
    overrides,
    ['event_id'],
    postEvent.id
  )

  applyIfPresent(
    template,
    overrides,
    ['team_id'],
    mediaTeam.id
  )

  applyIfPresent(
    template,
    overrides,
    [
      'user_id',
      'created_by',
      'submitted_by',
      'author_id',
    ],
    RODRIGO_ID
  )

  applyIfPresent(
    template,
    overrides,
    [
      'title',
      'summary',
      'report',
      'feedback',
      'notes',
      'message',
      'content',
    ],
    `${DEMO_PREFIX} Pós-evento apresentado à diretoria`
  )

  await cloneRow(
    table,
    template,
    overrides
  )
}

console.log(
  '✅ Pós-evento preparado'
)


// ============================================================
// RESUMO
// ============================================================

console.log('\n===================================')
console.log('🎉 DEMO DIRETORIA PRONTA')
console.log('===================================')

console.log(
  `Evento futuro: #${futureEvent.id} ${futureEvent.name}`
)

console.log(
  `Evento encerrado: #${postEvent.id} ${postEvent.name}`
)

console.log(
  'Check-in: Bruna / Equipe de Voluntários'
)

console.log(
  'Mídias: Rodrigo / Equipe de Mídias'
)

console.log(
  'Financeiro: Mariane'
)

console.log('\nNenhum usuário foi alterado.')
