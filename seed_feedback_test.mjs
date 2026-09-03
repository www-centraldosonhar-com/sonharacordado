import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

const EVENT_ID = 31
const USER_ID = 5 // Bruna


// =========================================================
// 1. CONFIRMA EVENTO
// =========================================================

const events = await sql`
  SELECT
    id,
    name,
    event_status
  FROM events
  WHERE id = ${EVENT_ID}
  LIMIT 1
`

if (!events[0]) {
  throw new Error(
    'Evento 31 não encontrado.'
  )
}

console.log(
  `✅ Evento: ${events[0].name}`
)


// =========================================================
// 2. USUÁRIO
// =========================================================

const users = await sql`
  SELECT
    id,
    name,
    email
  FROM users
  WHERE
    id = ${USER_ID}
    AND active = 1
  LIMIT 1
`

const user =
  users[0]

if (!user) {
  throw new Error(
    'Bruna não encontrada.'
  )
}

console.log(
  `✅ Usuário de teste: ${user.name}`
)


// =========================================================
// 3. EQUIPE ATIVIDADES
// =========================================================

const teams = await sql`
  SELECT
    id,
    code,
    name
  FROM teams
  WHERE code = 'activities'
  LIMIT 1
`

const team =
  teams[0]

if (!team) {
  throw new Error(
    'Equipe activities não encontrada.'
  )
}


// =========================================================
// 4. FUNÇÃO EXISTENTE DA EQUIPE
// =========================================================

let roles = await sql`
  SELECT
    id,
    name
  FROM roles
  WHERE team_id = ${team.id}
  ORDER BY id
  LIMIT 1
`

if (!roles[0]) {
  roles = await sql`
    INSERT INTO roles (
      name,
      team_id,
      allows_checklist
    )
    VALUES (
      'Atividade de Teste - Feedback',
      ${team.id},
      1
    )
    RETURNING
      id,
      name
  `
}

const role =
  roles[0]

console.log(
  `✅ Função usada: ${role.name}`
)


// =========================================================
// 5. EVENT ROLE
// =========================================================

let eventRoles = await sql`
  SELECT
    id
  FROM event_roles
  WHERE
    event_id = ${EVENT_ID}
    AND role_id = ${role.id}
  LIMIT 1
`

if (!eventRoles[0]) {
  eventRoles = await sql`
    INSERT INTO event_roles (
      event_id,
      role_id,
      team_id,
      vacancy_limit,
      active,
      requires_delivery,
      delivery_deadline,
      community_visible
    )
    VALUES (
      ${EVENT_ID},
      ${role.id},
      ${team.id},
      10,
      1,
      0,
      NULL,
      FALSE
    )
    RETURNING id
  `
}

const eventRoleId =
  Number(
    eventRoles[0].id
  )

console.log(
  `✅ Atividade vinculada ao evento: ${eventRoleId}`
)


// =========================================================
// 6. INSCRIÇÃO CONFIRMADA
// =========================================================
//
// O schema antigo de event_registrations aceita:
// activities / assisted / media / kitchen.
//
// Para esse teste usamos activities.
// =========================================================

const registrationEmail =
  user.email ||
  'bruna.feedback@teste.local'

let registrations = await sql`
  SELECT id
  FROM event_registrations
  WHERE
    event_id = ${EVENT_ID}
    AND user_id = ${USER_ID}
  LIMIT 1
`

if (registrations[0]) {
  registrations = await sql`
    UPDATE event_registrations
    SET
      email =
        ${registrationEmail},
      team =
        'activities',
      status =
        'confirmed',
      updated_at =
        CURRENT_TIMESTAMP
    WHERE
      event_id = ${EVENT_ID}
      AND user_id = ${USER_ID}
    RETURNING id
  `
} else {
  registrations = await sql`
    INSERT INTO event_registrations (
      event_id,
      user_id,
      email,
      team,
      status
    )
    VALUES (
      ${EVENT_ID},
      ${USER_ID},
      ${registrationEmail},
      'activities',
      'confirmed'
    )
    RETURNING id
  `
}

const registrationId =
  Number(
    registrations[0].id
  )

console.log(
  `✅ Inscrição confirmada: ${registrationId}`
)


// =========================================================
// 7. CHECKLIST
// =========================================================

let checklists = await sql`
  SELECT id
  FROM activity_checklists
  WHERE
    event_role_id =
      ${eventRoleId}
    AND active = 1
  ORDER BY id
  LIMIT 1
`

if (!checklists[0]) {
  checklists = await sql`
    INSERT INTO activity_checklists (
      event_role_id,
      title,
      source_type,
      assigned_user_id,
      active
    )
    VALUES (
      ${eventRoleId},
      'Check-in Teste Pós-Evento',
      'event_registrations',
      ${USER_ID},
      1
    )
    RETURNING id
  `
}

const checklistId =
  Number(
    checklists[0].id
  )

console.log(
  `✅ Checklist: ${checklistId}`
)


// =========================================================
// 8. CHECK-IN REALIZADO
// =========================================================

await sql`
  INSERT INTO activity_checklist_items (
    checklist_id,
    registration_id,
    checked,
    checked_at,
    checked_by,
    notes,
    updated_at
  )
  VALUES (
    ${checklistId},
    ${registrationId},
    1,
    CURRENT_TIMESTAMP,
    ${USER_ID},
    'Check-in criado para teste da avaliação Pós-Evento.',
    CURRENT_TIMESTAMP
  )

  ON CONFLICT (
    checklist_id,
    registration_id
  )

  DO UPDATE SET
    checked = 1,
    checked_at =
      CURRENT_TIMESTAMP,
    checked_by =
      ${USER_ID},
    notes =
      'Check-in criado para teste da avaliação Pós-Evento.',
    updated_at =
      CURRENT_TIMESTAMP
`

console.log(
  '✅ CHECK-IN = realizado.'
)


// =========================================================
// 9. REMOVE FEEDBACK ANTERIOR DESTE TESTE
// =========================================================

await sql`
  DELETE FROM post_event_feedback
  WHERE
    event_id = ${EVENT_ID}
    AND user_id = ${USER_ID}
`

console.log(
  '✅ Avaliação anterior removida.'
)


// =========================================================
// 10. VERIFICA O CENÁRIO FINAL
// =========================================================

const result = await sql`
  SELECT
    registration.id
      AS registration_id,

    registration.status,

    item.checked,

    checklist.id
      AS checklist_id,

    event_role.id
      AS event_role_id,

    event.event_status

  FROM event_registrations registration

  JOIN activity_checklist_items item
    ON item.registration_id =
      registration.id

  JOIN activity_checklists checklist
    ON checklist.id =
      item.checklist_id

  JOIN event_roles event_role
    ON event_role.id =
      checklist.event_role_id

  JOIN events event
    ON event.id =
      registration.event_id

  WHERE
    registration.event_id =
      ${EVENT_ID}

    AND registration.user_id =
      ${USER_ID}
`

console.log(
  '\n===== CENÁRIO FINAL ====='
)

console.table(result)

console.log('')
console.log('🎯 Cenário pronto.')
console.log('')
console.log('Agora faça logout e entre como Bruna.')
console.log('O modal de avaliação deve aparecer na seleção de espaços.')
