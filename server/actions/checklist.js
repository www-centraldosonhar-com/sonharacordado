import { getSessionUser } from './_session.js'

import {
  adminCanAccessActivity,
  requireAdmin,
  sql,
} from './_admin.js'

// =========================================================
// CHECKLIST ACCESS
// =========================================================
// Pode acessar:
// - Admin autorizado para a atividade;
// - qualquer voluntário com confirmação ativa na própria atividade.
// Responsáveis antigos permanecem aceitos apenas por compatibilidade.
// =========================================================

async function getChecklistAccess(
  request,
  checklistId
) {
  const session =
    await getSessionUser(request)

  if (!session?.userId) {
    return null
  }

  const rows = await sql`
    SELECT
      ac.id,
      ac.event_role_id,
      ac.title,
      ac.source_type,
      ac.assigned_user_id,
      ac.active,

      er.event_id,

      e.name AS event_name,
      e.event_date,
      e.event_status,

      r.name AS activity_name,

      t.name AS team_name

    FROM activity_checklists ac

    JOIN event_roles er
      ON er.id = ac.event_role_id

    JOIN events e
      ON e.id = er.event_id

    JOIN roles r
      ON r.id = er.role_id

    LEFT JOIN teams t
      ON t.id = er.team_id

    WHERE ac.id = ${checklistId}
      AND ac.active = 1

    LIMIT 1
  `

  const checklist = rows[0]

  if (!checklist) {
    return null
  }

  const admin =
    await requireAdmin(request)

  let adminAllowed = false

  if (admin) {
    adminAllowed =
      await adminCanAccessActivity(
        admin,
        checklist.event_role_id
      )
  }

  const participantRows = await sql`
    SELECT 1
    FROM confirmations confirmation
    WHERE confirmation.event_role_id =
        ${checklist.event_role_id}
      AND confirmation.user_id =
        ${session.userId}
      AND confirmation.status = 'confirmed'
    LIMIT 1
  `

  const assigneeRows = await sql`
    SELECT 1
    FROM activity_checklist_assignees aca
    WHERE aca.checklist_id = ${checklist.id}
      AND aca.user_id = ${session.userId}
    LIMIT 1
  `

  // Regra operacional:
  // qualquer pessoa confirmada NA PRÓPRIA atividade opera
  // a checklist compartilhada. Os vínculos antigos de
  // responsável continuam válidos apenas por compatibilidade.
  const assigned =
    Boolean(participantRows[0]) ||
    Boolean(assigneeRows[0]) ||
    Number(
      checklist.assigned_user_id
    ) ===
    Number(
      session.userId
    )

  if (
    !adminAllowed &&
    !assigned
  ) {
    return null
  }

  return {
    session,
    checklist,
    admin,
    assigned,
  }
}


// =========================================================
// SYNC ITEMS
// =========================================================
// Adiciona automaticamente à checklist todos os voluntários
// com inscrição CONFIRMADA no evento.
//
// Não duplica quem já existe.
// =========================================================

async function syncChecklist(
  checklist
) {
  if (
    checklist.source_type ===
    'assisted_people'
  ) {
    const isCheckout =
      checklist.activity_name ===
      'Despedida / Check-out de Assistidos'

    await sql`
      INSERT INTO activity_checklist_items (
        checklist_id,
        assisted_person_id,
        checked
      )

      SELECT
        ${checklist.id},
        assisted.id,
        0

      FROM assisted_people assisted

      JOIN events event
        ON event.id =
          ${checklist.event_id}

      WHERE
        assisted.active = 1
        AND event.project_id IS NOT NULL
        AND assisted.project_id =
          event.project_id

        AND (
          ${!isCheckout}
          OR EXISTS (
            SELECT 1
            FROM activity_checklists checkin
            JOIN event_roles checkin_role
              ON checkin_role.id = checkin.event_role_id
            JOIN roles checkin_activity
              ON checkin_activity.id = checkin_role.role_id
            JOIN activity_checklist_items checkin_item
              ON checkin_item.checklist_id = checkin.id
            WHERE checkin_role.event_id = event.id
              AND checkin.active = 1
              AND checkin.source_type = 'assisted_people'
              AND checkin_activity.name = 'Recepção / Check-in de Assistidos'
              AND checkin_item.assisted_person_id = assisted.id
              AND checkin_item.checked = 1
          )
        )

      ON CONFLICT (
        checklist_id,
        assisted_person_id
      )
      WHERE assisted_person_id IS NOT NULL
      DO NOTHING
    `

    return
  }

  await sql`
    INSERT INTO activity_checklist_items (
      checklist_id,
      registration_id,
      checked
    )

    SELECT
      ${checklist.id},
      er.id,
      0

    FROM event_registrations er

    WHERE
      er.event_id =
        ${checklist.event_id}

      AND er.status =
        'confirmed'

    ON CONFLICT (
      checklist_id,
      registration_id
    )
    DO NOTHING
  `
}


// =========================================================
// ENSURE OPERATIONAL CHECKLIST
// =========================================================
// Check-in de Voluntários e check-in/check-out de Assistidos
// não dependem mais de responsável escolhido.
// =========================================================

async function ensureOperationalChecklist(
  eventRoleId
) {
  const activityRows = await sql`
    SELECT
      er.id,
      er.event_id,
      r.name AS role_name,
      r.allows_checklist,
      e.project_id,
      e.event_status
    FROM event_roles er
    JOIN roles r
      ON r.id = er.role_id
    JOIN events e
      ON e.id = er.event_id
    WHERE er.id = ${eventRoleId}
      AND er.active = 1
    LIMIT 1
  `

  const activity = activityRows[0]

  if (
    !activity ||
    Number(activity.allows_checklist) !== 1
  ) {
    return null
  }

  const assistedChecklist =
    activity.role_name ===
      'Recepção / Check-in de Assistidos' ||
    activity.role_name ===
      'Despedida / Check-out de Assistidos'

  const volunteerChecklist =
    activity.role_name ===
      'Recepção / Check-in de Voluntários'

  if (
    !assistedChecklist &&
    !volunteerChecklist
  ) {
    return null
  }

  if (
    assistedChecklist &&
    activity.project_id === null
  ) {
    return null
  }

  let rows = await sql`
    SELECT *
    FROM activity_checklists
    WHERE event_role_id = ${eventRoleId}
      AND active = 1
    ORDER BY id
    LIMIT 1
  `

  if (!rows[0]) {
    await sql`
      INSERT INTO activity_checklists (
        event_role_id,
        title,
        source_type,
        assigned_user_id,
        active
      )
      SELECT
        ${eventRoleId},
        ${activity.role_name},
        ${
          assistedChecklist
            ? 'assisted_people'
            : 'event_registrations'
        },
        NULL,
        1
      WHERE NOT EXISTS (
        SELECT 1
        FROM activity_checklists
        WHERE event_role_id = ${eventRoleId}
          AND active = 1
      )
    `

    rows = await sql`
      SELECT *
      FROM activity_checklists
      WHERE event_role_id = ${eventRoleId}
        AND active = 1
      ORDER BY id
      LIMIT 1
    `
  }

  return rows[0] || null
}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  request,
  response
) {
  const session =
    await getSessionUser(request)

  if (!session?.userId) {
    return response.status(401).json({
      error:
        'Sessão inválida ou expirada.',
    })
  }

  const {
    operation,
    checklistId,
    eventRoleId,
    eventId,
    activityName,
    lookupActivityName,
    title,
    assignedUserId,
    assignedUserIds,
    itemId,
    checked,
    notes,
  } =
    request.method === 'GET'
      ? request.query ?? {}
      : request.body ?? {}

  try {
    // =====================================================
    // ASSISTED EVENT OVERVIEW — ADMIN
    // =====================================================
    //
    // Panorama operacional consolidado dos Assistidos.
    //
    // Recebe apenas o eventRoleId da atividade atual de
    // Check-in e resolve todo o estado diretamente pelo
    // evento:
    //
    // - Assistidos ativos do projeto;
    // - Check-in realizado;
    // - Check-out realizado;
    // - Assistidos ainda dentro do evento.
    //
    // Não depende de descobrir checklist irmã no frontend.
    // =====================================================

    if (
      operation ===
      'assisted-overview'
    ) {
      const numericEventRoleId =
        Number(eventRoleId)

      if (
        !Number.isInteger(
          numericEventRoleId
        ) ||
        numericEventRoleId <= 0
      ) {
        return response.status(400).json({
          error:
            'Atividade inválida.',
        })
      }

      const admin =
        await requireAdmin(request)

      if (!admin) {
        return response.status(403).json({
          error:
            'Acesso não autorizado.',
        })
      }

      const allowed =
        await adminCanAccessActivity(
          admin,
          numericEventRoleId
        )

      if (!allowed) {
        return response.status(403).json({
          error:
            'Você não pode administrar esta atividade.',
        })
      }

      // Confirma que o eventRoleId pertence realmente
      // ao Check-in de Assistidos e obtém o evento/projeto.
      const contextRows =
        await sql`
          SELECT
            er.event_id,
            event.project_id,
            event.event_status,
            role.name
              AS activity_name

          FROM event_roles er

          JOIN events event
            ON event.id =
              er.event_id

          JOIN roles role
            ON role.id =
              er.role_id

          WHERE
            er.id =
              ${numericEventRoleId}

            AND er.active = 1

          LIMIT 1
        `

      const context =
        contextRows[0]

      if (!context) {
        return response.status(404).json({
          error:
            'Atividade não encontrada.',
        })
      }

      if (
        context.activity_name !==
        'Recepção / Check-in de Assistidos'
      ) {
        return response.status(400).json({
          error:
            'O panorama deve ser aberto a partir do Check-in de Assistidos.',
        })
      }

      if (!context.project_id) {
        return response.status(400).json({
          error:
            'Este evento não possui projeto definido para Assistidos.',
        })
      }

      // ===================================================
      // PEOPLE + CHECK-IN + CHECK-OUT
      // ===================================================
      //
      // EXISTS evita depender de IDs específicos de
      // checklist ou event_role do Check-out.
      //
      // O vínculo é sempre:
      // evento + nome oficial da atividade +
      // assisted_person_id.
      // ===================================================

      const people =
        await sql`
          SELECT
            assisted.id
              AS assisted_person_id,

            assisted.full_name
              AS user_name,

            assisted.child_number,
            assisted.guardian_name,
            assisted.guardian_phone,
            assisted.departure_method,

            CASE
              WHEN EXISTS (
                SELECT 1

                FROM activity_checklists checklist

                JOIN event_roles checklist_role
                  ON checklist_role.id =
                    checklist.event_role_id

                JOIN roles activity
                  ON activity.id =
                    checklist_role.role_id

                JOIN activity_checklist_items item
                  ON item.checklist_id =
                    checklist.id

                WHERE
                  checklist_role.event_id =
                    ${context.event_id}

                  AND checklist.active = 1

                  AND checklist.source_type =
                    'assisted_people'

                  AND activity.name =
                    'Recepção / Check-in de Assistidos'

                  AND item.assisted_person_id =
                    assisted.id

                  AND item.checked = 1
              )
              THEN 1
              ELSE 0
            END::int
              AS checked_in,

            CASE
              WHEN EXISTS (
                SELECT 1

                FROM activity_checklists checklist

                JOIN event_roles checklist_role
                  ON checklist_role.id =
                    checklist.event_role_id

                JOIN roles activity
                  ON activity.id =
                    checklist_role.role_id

                JOIN activity_checklist_items item
                  ON item.checklist_id =
                    checklist.id

                WHERE
                  checklist_role.event_id =
                    ${context.event_id}

                  AND checklist.active = 1

                  AND checklist.source_type =
                    'assisted_people'

                  AND activity.name =
                    'Despedida / Check-out de Assistidos'

                  AND item.assisted_person_id =
                    assisted.id

                  AND item.checked = 1
              )
              THEN 1
              ELSE 0
            END::int
              AS checked_out

          FROM assisted_people assisted

          WHERE
            assisted.project_id =
              ${context.project_id}

            AND assisted.active = 1

          ORDER BY
            assisted.full_name
        `

      const total =
        people.length

      const checkedIn =
        people.filter(
          person =>
            Number(
              person.checked_in
            ) === 1
        ).length

      const checkedOut =
        people.filter(
          person =>
            Number(
              person.checked_out
            ) === 1
        ).length

      const inside =
        people.filter(
          person =>
            Number(
              person.checked_in
            ) === 1 &&
            Number(
              person.checked_out
            ) !== 1
        ).length

      return response.status(200).json({
        eventId:
          context.event_id,

        eventStatus:
          context.event_status,

        totals: {
          total,
          checkedIn,
          checkedOut,
          inside,
        },

        people,
      })
    }


    // =====================================================
    // LIST CHECKLISTS OF AN ACTIVITY — ADMIN
    // =====================================================

    if (
      operation ===
      'list-activity'
    ) {
      let numericEventRoleId =
        Number(eventRoleId)

      const numericEventId =
        Number(eventId)

      const normalizedActivityName =
        String(
          activityName || ''
        ).trim()

      const admin =
        await requireAdmin(request)

      if (!admin) {
        return response.status(403).json({
          error:
            'Acesso não autorizado.',
        })
      }

      const normalizedLookupActivityName =
        String(
          lookupActivityName || ''
        ).trim()

      // Quando recebemos um eventRoleId atual + nome de
      // outra atividade, usamos o próprio eventRoleId para
      // descobrir o evento e localizar a atividade irmã.
      //
      // Exemplo:
      // Check-in Assistidos -> Check-out Assistidos.
      if (
        Number.isInteger(
          numericEventRoleId
        ) &&
        normalizedLookupActivityName
      ) {
        const siblingRows =
          await sql`
            SELECT
              target_er.id

            FROM event_roles source_er

            JOIN event_roles target_er
              ON target_er.event_id =
                source_er.event_id

            JOIN roles target_role
              ON target_role.id =
                target_er.role_id

            WHERE
              source_er.id =
                ${numericEventRoleId}

              AND target_role.name =
                ${normalizedLookupActivityName}

              AND target_er.active = 1

            LIMIT 1
          `

        numericEventRoleId =
          Number(
            siblingRows[0]?.id
          )
      }

      // O uso antigo continua funcionando com eventRoleId.
      // Para painéis administrativos, também permitimos
      // localizar a atividade pelo evento + nome oficial.
      if (
        !Number.isInteger(
          numericEventRoleId
        ) &&
        Number.isInteger(
          numericEventId
        ) &&
        normalizedActivityName
      ) {
        const eventRoleRows =
          await sql`
            SELECT
              er.id

            FROM event_roles er

            JOIN roles r
              ON r.id =
                er.role_id

            WHERE
              er.event_id =
                ${numericEventId}

              AND r.name =
                ${normalizedActivityName}

              AND er.active = 1

            LIMIT 1
          `

        numericEventRoleId =
          Number(
            eventRoleRows[0]?.id
          )
      }

      if (
        !Number.isInteger(
          numericEventRoleId
        )
      ) {
        return response.status(400).json({
          error:
            'Atividade não encontrada.',
        })
      }

      const allowed =
        await adminCanAccessActivity(
          admin,
          numericEventRoleId
        )

      if (!allowed) {
        return response.status(403).json({
          error:
            'Você não pode administrar esta atividade.',
        })
      }

      await ensureOperationalChecklist(
        numericEventRoleId
      )

      // Antes de calcular o contador, sincroniza a
      // checklist com todas as inscrições confirmadas
      // atuais do evento.
      const checklistRows = await sql`
        SELECT
          ac.id,
          er.event_id,
          ac.source_type,
          r.name AS activity_name,
          e.event_status
        FROM activity_checklists ac
        JOIN event_roles er
          ON er.id = ac.event_role_id
        JOIN events e
          ON e.id = er.event_id
        JOIN roles r
          ON r.id = er.role_id
        WHERE
          ac.event_role_id =
            ${numericEventRoleId}
          AND ac.active = 1
      `

      for (
        const checklist
        of checklistRows
      ) {
        if (
          checklist.event_status !==
            'post_event' &&
          checklist.event_status !==
            'closed'
        ) {
          await syncChecklist(
            checklist
          )
        }
      }

      const rows = await sql`
        SELECT
          ac.id,
          ac.title,
          ac.source_type,
          ac.assigned_user_id,
          ac.active,
          ac.created_at,

          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'user_id', assignee.user_id,
                  'user_name', assignee_user.name
                )
                ORDER BY
                  CASE
                    WHEN assignee.user_id = ac.assigned_user_id
                      THEN 0
                    ELSE 1
                  END,
                  assignee_user.name
              ),
              '[]'::json
            )
            FROM activity_checklist_assignees assignee
            JOIN users assignee_user
              ON assignee_user.id = assignee.user_id
            WHERE assignee.checklist_id = ac.id
          ) AS assigned_users,

          COUNT(aci.id)::int AS total_items,

          COUNT(
            aci.id
          ) FILTER (
            WHERE
              aci.checked = 1
          )::int AS checked_items

        FROM activity_checklists ac

        LEFT JOIN activity_checklist_items aci
          ON aci.checklist_id =
            ac.id

        WHERE
          ac.event_role_id =
            ${numericEventRoleId}

          AND ac.active = 1

        GROUP BY
          ac.id,
          ac.title,
          ac.source_type,
          ac.assigned_user_id,
          ac.active,
          ac.created_at

        ORDER BY
          ac.created_at DESC
      `

      return response.status(200).json({
        checklists: rows,
        locked:
          checklistRows.some(
            checklist =>
              checklist.event_status ===
                'post_event' ||
              checklist.event_status ===
                'closed'
          ),
      })
    }


    // =====================================================
    // ASSIGN CHECK-IN RESPONSIBLE — ADMIN
    // =====================================================
    // O Admin escolhe um participante confirmado da própria
    // atividade. A checklist é criada automaticamente caso
    // ainda não exista.
    // =====================================================

    if (operation === 'assign') {
      const numericEventRoleId =
        Number(eventRoleId)

      const rawAssignedUserIds =
        Array.isArray(assignedUserIds)
          ? assignedUserIds
          : assignedUserId
            ? [assignedUserId]
            : []

      const numericAssignedUserIds =
        [...new Set(
          rawAssignedUserIds
            .map(Number)
            .filter(Number.isInteger)
        )]

      const numericAssignedUserId =
        numericAssignedUserIds[0] ?? null

      const admin =
        await requireAdmin(request)

      if (
        !admin ||
        !Number.isInteger(
          numericEventRoleId
        ) ||
        numericAssignedUserIds.length === 0 ||
        numericAssignedUserIds.length > 2
      ) {
        return response.status(400).json({
          error:
            'Escolha um ou dois responsáveis válidos.',
        })
      }

      const allowed =
        await adminCanAccessActivity(
          admin,
          numericEventRoleId
        )

      if (!allowed) {
        return response.status(403).json({
          error:
            'Você não pode administrar esta atividade.',
        })
      }

      const activityRows = await sql`
        SELECT
          er.id,
          er.event_id,
          r.name AS role_name,
          r.allows_checklist,
          e.project_id,
          e.event_status
        FROM event_roles er
        JOIN roles r
          ON r.id = er.role_id
        JOIN events e
          ON e.id = er.event_id
        WHERE er.id =
          ${numericEventRoleId}
        LIMIT 1
      `

      const activity =
        activityRows[0]

      if (
        !activity ||
        Number(
          activity.allows_checklist
        ) !== 1
      ) {
        return response.status(400).json({
          error:
            'Essa atividade não possui check-in.',
        })
      }

      const assistedChecklist =
        activity.role_name ===
          'Recepção / Check-in de Assistidos' ||
        activity.role_name ===
          'Despedida / Check-out de Assistidos'

      if (
        activity.role_name !==
          'Recepção / Check-in de Voluntários' &&
        !assistedChecklist
      ) {
        return response.status(400).json({
          error:
            'Essa atividade não utiliza checklist operacional.',
        })
      }

      if (
        activity.event_status ===
          'post_event' ||
        activity.event_status ===
          'closed'
      ) {
        return response.status(409).json({
          error:
            'A checklist está bloqueada porque o evento foi encerrado operacionalmente.',
        })
      }

      if (
        assistedChecklist &&
        activity.project_id === null
      ) {
        return response.status(400).json({
          error:
            'Eventos gerais não possuem projeto para definir a base de Assistidos.',
        })
      }

      // Todos os responsáveis precisam estar confirmados
      // exatamente nesta atividade. Como o limite é dois,
      // validamos individualmente para evitar ambiguidades
      // de serialização de arrays entre Node e Postgres.
      for (
        const assigneeUserId
        of numericAssignedUserIds
      ) {
        const participation = await sql`
          SELECT c.id
          FROM confirmations c
          WHERE
            c.event_role_id =
              ${numericEventRoleId}
            AND c.user_id =
              ${assigneeUserId}
            AND c.status = 'confirmed'
          LIMIT 1
        `

        if (!participation[0]) {
          return response.status(400).json({
            error:
              'Todos os responsáveis precisam estar confirmados nesta atividade.',
          })
        }
      }

      const existingRows = await sql`
        SELECT *
        FROM activity_checklists
        WHERE
          event_role_id =
            ${numericEventRoleId}
          AND active = 1
        ORDER BY id
        LIMIT 1
      `

      let checklist =
        existingRows[0]

      if (checklist) {
        const updated = await sql`
          UPDATE activity_checklists
          SET
            title =
              ${activity.role_name},
            source_type =
              ${
                assistedChecklist
                  ? 'assisted_people'
                  : 'event_registrations'
              },
            assigned_user_id =
              ${numericAssignedUserId}
          WHERE id =
            ${checklist.id}
          RETURNING *
        `

        checklist =
          updated[0]
      } else {
        const created = await sql`
          INSERT INTO activity_checklists (
            event_role_id,
            title,
            source_type,
            assigned_user_id,
            active
          )
          VALUES (
            ${numericEventRoleId},
            ${activity.role_name},
            ${
              assistedChecklist
                ? 'assisted_people'
                : 'event_registrations'
            },
            ${numericAssignedUserId},
            1
          )
          RETURNING *
        `

        checklist =
          created[0]
      }

      // Uma única checklist compartilhada pelos responsáveis.
      // Primeiro garantimos os novos vínculos; só depois
      // removemos responsáveis que deixaram de ser escolhidos.
      // Assim, uma falha intermediária nunca zera os acessos.
      for (
        const assigneeUserId
        of numericAssignedUserIds
      ) {
        await sql`
          INSERT INTO activity_checklist_assignees (
            checklist_id,
            user_id
          )
          VALUES (
            ${checklist.id},
            ${assigneeUserId}
          )
          ON CONFLICT (checklist_id, user_id)
          DO NOTHING
        `
      }

      const secondaryAssignedUserId =
        numericAssignedUserIds[1] ?? null

      await sql`
        DELETE FROM activity_checklist_assignees
        WHERE checklist_id = ${checklist.id}
          AND user_id <> ${numericAssignedUserId}
          AND (
            ${secondaryAssignedUserId}::int IS NULL
            OR user_id <> ${secondaryAssignedUserId}
          )
      `

      await syncChecklist({
        ...checklist,
        event_id:
          activity.event_id,
        activity_name:
          activity.role_name,
      })

      const assignedUsers = await sql`
        SELECT
          aca.user_id,
          u.name AS user_name
        FROM activity_checklist_assignees aca
        JOIN users u
          ON u.id = aca.user_id
        WHERE aca.checklist_id = ${checklist.id}
        ORDER BY
          CASE
            WHEN aca.user_id = ${numericAssignedUserId}
              THEN 0
            ELSE 1
          END,
          u.name
      `

      return response.status(200).json({
        success: true,
        checklist: {
          ...checklist,
          assigned_users: assignedUsers,
        },
        message:
          'Responsáveis definidos! ✅',
      })
    }


    // =====================================================
    // CREATE — ADMIN
    // =====================================================

    if (operation === 'create') {
      const numericEventRoleId =
        Number(eventRoleId)

      const numericAssignedUserId =
        assignedUserId
          ? Number(assignedUserId)
          : null

      const cleanTitle =
        typeof title === 'string'
          ? title.trim()
          : ''

      const admin =
        await requireAdmin(request)

      if (
        !admin ||
        !Number.isInteger(
          numericEventRoleId
        ) ||
        !cleanTitle
      ) {
        return response.status(400).json({
          error:
            'Dados da checklist inválidos.',
        })
      }

      const allowed =
        await adminCanAccessActivity(
          admin,
          numericEventRoleId
        )

      if (!allowed) {
        return response.status(403).json({
          error:
            'Você não pode administrar esta atividade.',
        })
      }

      if (
        numericAssignedUserId !== null
      ) {
        const users = await sql`
          SELECT id
          FROM users
          WHERE id =
            ${numericAssignedUserId}
            AND active = 1
          LIMIT 1
        `

        if (!users[0]) {
          return response.status(400).json({
            error:
              'Responsável inválido.',
          })
        }
      }

      const created = await sql`
        INSERT INTO activity_checklists (
          event_role_id,
          title,
          source_type,
          assigned_user_id,
          active
        )
        VALUES (
          ${numericEventRoleId},
          ${cleanTitle},
          'event_registrations',
          ${numericAssignedUserId},
          1
        )
        RETURNING *
      `

      const checklist =
        created[0]

      if (numericAssignedUserId !== null) {
        await sql`
          INSERT INTO activity_checklist_assignees (
            checklist_id,
            user_id
          )
          VALUES (
            ${checklist.id},
            ${numericAssignedUserId}
          )
          ON CONFLICT (checklist_id, user_id)
          DO NOTHING
        `
      }

      const eventRows = await sql`
        SELECT event_id
        FROM event_roles
        WHERE id =
          ${numericEventRoleId}
        LIMIT 1
      `

      await syncChecklist({
        ...checklist,
        event_id:
          eventRows[0].event_id,
      })

      return response.status(201).json({
        success: true,
        checklist,
        message:
          'Checklist criada! ✅',
      })
    }


    // =====================================================
    // EVENT HISTORY SUMMARY
    // Read-only presence history for Global / Project admins
    // =====================================================

    if (operation === 'event-history-summary') {
      const numericEventId =
        Number(eventId)

      if (
        !Number.isInteger(numericEventId) ||
        numericEventId <= 0
      ) {
        return response.status(400).json({
          error: 'Evento inválido.',
        })
      }

      const admin =
        await requireAdmin(request)

      if (!admin) {
        return response.status(403).json({
          error: 'Acesso não autorizado.',
        })
      }

      const adminScope =
        String(
          admin.adminScope ||
          admin.admin_scope ||
          ''
        ).toLowerCase()

      // Admin de Equipe não recebe acesso ao
      // resumo histórico geral do evento.
      if (
        adminScope !== 'global' &&
        adminScope !== 'project'
      ) {
        return response.status(403).json({
          error:
            'Você não possui acesso ao resumo histórico deste evento.',
        })
      }

      const eventRows = await sql`
        SELECT
          e.id,
          e.name,
          e.event_date,
          e.event_status,
          e.project_id,
          p.name AS project_name

        FROM events e

        LEFT JOIN projects p
          ON p.id = e.project_id

        WHERE
          e.id = ${numericEventId}

        LIMIT 1
      `

      const event = eventRows[0]

      if (!event) {
        return response.status(404).json({
          error: 'Evento não encontrado.',
        })
      }

      if (
        event.event_status !== 'post_event' &&
        event.event_status !== 'closed'
      ) {
        return response.status(409).json({
          error:
            'O resumo histórico fica disponível após o encerramento do evento.',
        })
      }

      // Admin de Projeto:
      // - evento do próprio projeto
      // - Evento Geral (project_id NULL)
      if (
        adminScope === 'project' &&
        event.project_id !== null &&
        Number(event.project_id) !==
          Number(admin.projectId || admin.project_id)
      ) {
        return response.status(403).json({
          error:
            'Você não possui acesso a este evento.',
        })
      }


      // -----------------------------------------------------
      // VOLUNTEERS
      // -----------------------------------------------------

      const volunteerRows = await sql`
        SELECT
          er.user_id,
          u.name,
          p.name AS project_name,
          aci.checked_at

        FROM activity_checklists checklist

        JOIN event_roles role
          ON role.id =
            checklist.event_role_id

        JOIN roles activity
          ON activity.id =
            role.role_id

        JOIN activity_checklist_items aci
          ON aci.checklist_id =
            checklist.id

        JOIN event_registrations er
          ON er.id =
            aci.registration_id

        JOIN users u
          ON u.id =
            er.user_id

        LEFT JOIN projects p
          ON p.id =
            u.project_id

        WHERE
          role.event_id =
            ${numericEventId}

          AND checklist.active = 1

          AND checklist.source_type =
            'event_registrations'

          AND activity.name =
            'Recepção / Check-in de Voluntários'

          AND aci.checked = 1

          AND er.status =
            'confirmed'

        ORDER BY
          u.name
      `


      // -----------------------------------------------------
      // ASSISTED
      // -----------------------------------------------------

      const assistedRows = await sql`
        SELECT
          assisted.id,
          assisted.child_number,
          assisted.full_name AS name,

          MAX(
            CASE
              WHEN activity.name =
                'Recepção / Check-in de Assistidos'
                AND aci.checked = 1
              THEN 1
              ELSE 0
            END
          )::int AS checked_in,

          MAX(
            CASE
              WHEN activity.name =
                'Despedida / Check-out de Assistidos'
                AND aci.checked = 1
              THEN 1
              ELSE 0
            END
          )::int AS checked_out,

          MAX(
            CASE
              WHEN activity.name =
                'Recepção / Check-in de Assistidos'
                AND aci.checked = 1
              THEN aci.checked_at
              ELSE NULL
            END
          ) AS checked_in_at,

          MAX(
            CASE
              WHEN activity.name =
                'Despedida / Check-out de Assistidos'
                AND aci.checked = 1
              THEN aci.checked_at
              ELSE NULL
            END
          ) AS checked_out_at

        FROM activity_checklists checklist

        JOIN event_roles role
          ON role.id =
            checklist.event_role_id

        JOIN roles activity
          ON activity.id =
            role.role_id

        JOIN activity_checklist_items aci
          ON aci.checklist_id =
            checklist.id

        JOIN assisted_people assisted
          ON assisted.id =
            aci.assisted_person_id

        WHERE
          role.event_id =
            ${numericEventId}

          AND checklist.active = 1

          AND checklist.source_type =
            'assisted_people'

          AND activity.name IN (
            'Recepção / Check-in de Assistidos',
            'Despedida / Check-out de Assistidos'
          )

        GROUP BY
          assisted.id,
          assisted.child_number,
          assisted.full_name

        HAVING
          MAX(
            CASE
              WHEN activity.name =
                'Recepção / Check-in de Assistidos'
                AND aci.checked = 1
              THEN 1
              ELSE 0
            END
          ) = 1

        ORDER BY
          assisted.child_number NULLS LAST,
          assisted.full_name
      `

      const assistedCheckedOut =
        assistedRows.filter(
          (person) =>
            Number(person.checked_out) === 1
        ).length

      return response.status(200).json({
        event: {
          id: Number(event.id),
          name: event.name,
          date: event.event_date,
          status: event.event_status,
          projectId:
            event.project_id === null
              ? null
              : Number(event.project_id),
          projectName:
            event.project_name || null,
        },

        volunteers: {
          total: volunteerRows.length,
          people: volunteerRows.map(
            (person) => ({
              userId:
                Number(person.user_id),
              name:
                person.name,
              projectName:
                person.project_name || null,
              checkedAt:
                person.checked_at || null,
            })
          ),
        },

        assisted: {
          checkedIn:
            assistedRows.length,

          checkedOut:
            assistedCheckedOut,

          inside:
            assistedRows.length -
            assistedCheckedOut,

          people: assistedRows.map(
            (person) => ({
              id:
                Number(person.id),

              childNumber:
                person.child_number === null
                  ? null
                  : Number(
                      person.child_number
                    ),

              name:
                person.name,

              checkedIn:
                Number(
                  person.checked_in
                ) === 1,

              checkedOut:
                Number(
                  person.checked_out
                ) === 1,

              checkedInAt:
                person.checked_in_at ||
                null,

              checkedOutAt:
                person.checked_out_at ||
                null,
            })
          ),
        },
      })
    }


    // =====================================================
    // MY CHECKLISTS
    // =====================================================
    // Lista apenas checklists onde o usuário logado foi
    // definido como responsável.
    // =====================================================

    if (operation === 'mine') {
      const confirmedOperationalActivities =
        await sql`
          SELECT DISTINCT
            c.event_role_id
          FROM confirmations c
          JOIN event_roles er
            ON er.id = c.event_role_id
          JOIN roles r
            ON r.id = er.role_id
          JOIN events e
            ON e.id = er.event_id
          WHERE c.user_id = ${session.userId}
            AND c.status = 'confirmed'
            AND er.active = 1
            AND r.allows_checklist = 1
            AND r.name IN (
              'Recepção / Check-in de Voluntários',
              'Recepção / Check-in de Assistidos',
              'Despedida / Check-out de Assistidos'
            )
            AND e.event_status NOT IN (
              'post_event',
              'closed'
            )
        `

      for (
        const activity
        of confirmedOperationalActivities
      ) {
        await ensureOperationalChecklist(
          Number(activity.event_role_id)
        )
      }

      // ===================================================
      // SYNC BEFORE COUNTERS
      // ===================================================
      // Uma inscrição pode ser confirmada depois da criação
      // da checklist. Antes de devolver checked_items /
      // total_items, sincronizamos todas as checklists
      // atribuídas ao usuário atual.
      // ===================================================

      const assignedChecklists =
        await sql`
          SELECT
          ac.id,
          er.event_id,
          ac.source_type
          ,r.name AS activity_name

          FROM activity_checklists ac

          JOIN event_roles er
            ON er.id =
              ac.event_role_id

          JOIN events e
            ON e.id =
              er.event_id

          JOIN roles r
            ON r.id = er.role_id

          WHERE
            (
              EXISTS (
                SELECT 1
                FROM confirmations confirmation
                WHERE confirmation.event_role_id =
                    ac.event_role_id
                  AND confirmation.user_id =
                    ${session.userId}
                  AND confirmation.status = 'confirmed'
              )
              OR EXISTS (
                SELECT 1
                FROM activity_checklist_assignees aca
                WHERE aca.checklist_id = ac.id
                  AND aca.user_id = ${session.userId}
              )
              OR ac.assigned_user_id = ${session.userId}
            )

            AND ac.active = 1

            AND er.active = 1

            AND e.event_status
              NOT IN (
                'post_event',
                'closed'
              )
        `

      for (
        const checklist
        of assignedChecklists
      ) {
        await syncChecklist(
          checklist
        )
      }

      const rows = await sql`
        SELECT
          ac.id,
          ac.title,
          ac.event_role_id,
          ac.source_type,

          er.event_id,

          e.name AS event_name,
          e.event_date,

          r.name AS activity_name,

          t.name AS team_name,

          COUNT(aci.id)::int
            AS total_items,

          COUNT(aci.id) FILTER (
            WHERE aci.checked = 1
          )::int
            AS checked_items

        FROM activity_checklists ac

        JOIN event_roles er
          ON er.id = ac.event_role_id

        JOIN events e
          ON e.id = er.event_id

        JOIN roles r
          ON r.id = er.role_id

        LEFT JOIN teams t
          ON t.id = er.team_id

        LEFT JOIN activity_checklist_items aci
          ON aci.checklist_id = ac.id

        WHERE
          (
            EXISTS (
              SELECT 1
              FROM confirmations confirmation
              WHERE confirmation.event_role_id =
                  ac.event_role_id
                AND confirmation.user_id =
                  ${session.userId}
                AND confirmation.status = 'confirmed'
            )
            OR EXISTS (
              SELECT 1
              FROM activity_checklist_assignees aca
              WHERE aca.checklist_id = ac.id
                AND aca.user_id = ${session.userId}
            )
            OR ac.assigned_user_id = ${session.userId}
          )

          AND ac.active = 1

          AND er.active = 1

          AND e.event_status
            NOT IN (
              'post_event',
              'closed'
            )

        GROUP BY
          ac.id,
          ac.title,
          ac.event_role_id,
          ac.source_type,
          er.event_id,
          e.name,
          e.event_date,
          r.name,
          t.name

        ORDER BY
          e.event_date ASC,
          ac.created_at ASC
      `

      return response.status(200).json({
        checklists: rows,
      })
    }


    // =====================================================
    // GET CHECKLIST
    // =====================================================

    if (operation === 'get') {
      const numericChecklistId =
        Number(checklistId)

      const access =
        await getChecklistAccess(
          request,
          numericChecklistId
        )

      if (!access) {
        return response.status(403).json({
          error:
            'Checklist não disponível.',
        })
      }

      if (
        access.checklist.event_status !==
          'post_event' &&
        access.checklist.event_status !==
          'closed'
      ) {
        await syncChecklist(
          access.checklist
        )
      }

      const items =
        access.checklist.source_type ===
        'assisted_people'
          ? await sql`
        SELECT
          aci.id,
          aci.assisted_person_id,
          aci.checked,
          aci.checked_at,
          aci.notes,
          aci.updated_at,

          assisted.full_name AS user_name,
          project.name AS project_name,
          assisted.child_number,
          assisted.birth_date,
          assisted.allergies,
          assisted.notes AS assisted_notes,
          assisted.guardian_name,
          assisted.guardian_phone,
          assisted.departure_method,

          checked_user.name
            AS checked_by_name

        FROM activity_checklist_items aci

        JOIN assisted_people assisted
          ON assisted.id =
            aci.assisted_person_id

        JOIN projects project
          ON project.id =
            assisted.project_id

        LEFT JOIN users checked_user
          ON checked_user.id =
            aci.checked_by

        WHERE
          aci.checklist_id =
            ${numericChecklistId}

          AND (
            ${access.checklist.activity_name !== 'Despedida / Check-out de Assistidos'}
            OR EXISTS (
              SELECT 1
              FROM activity_checklists checkin
              JOIN event_roles checkin_role
                ON checkin_role.id = checkin.event_role_id
              JOIN roles checkin_activity
                ON checkin_activity.id = checkin_role.role_id
              JOIN activity_checklist_items checkin_item
                ON checkin_item.checklist_id = checkin.id
              WHERE checkin_role.event_id = ${access.checklist.event_id}
                AND checkin.active = 1
                AND checkin.source_type = 'assisted_people'
                AND checkin_activity.name = 'Recepção / Check-in de Assistidos'
                AND checkin_item.assisted_person_id = aci.assisted_person_id
                AND checkin_item.checked = 1
            )
          )

        ORDER BY
          assisted.child_number NULLS LAST,
          assisted.full_name
      `
          : await sql`
        SELECT
          aci.id,
          aci.registration_id,
          aci.checked,
          aci.checked_at,
          aci.notes,
          aci.updated_at,

          er.user_id,

          u.name AS user_name,

          p.name AS project_name,

          er.team AS registration_team,

          checked_user.name
            AS checked_by_name

        FROM activity_checklist_items aci

        JOIN event_registrations er
          ON er.id =
            aci.registration_id

        JOIN users u
          ON u.id =
            er.user_id

        JOIN projects p
          ON p.id =
            u.project_id

        LEFT JOIN users checked_user
          ON checked_user.id =
            aci.checked_by

        WHERE
          aci.checklist_id =
            ${numericChecklistId}

          AND er.status =
            'confirmed'

        ORDER BY
          u.name
      `

      return response.status(200).json({
        checklist:
          access.checklist,

        items,
      })
    }


    // =====================================================
    // TOGGLE PRESENCE
    // =====================================================

    if (operation === 'toggle') {
      const numericChecklistId =
        Number(checklistId)

      const numericItemId =
        Number(itemId)

      const access =
        await getChecklistAccess(
          request,
          numericChecklistId
        )

      if (!access) {
        return response.status(403).json({
          error:
            'Checklist não disponível.',
        })
      }

      if (
        access.checklist.event_status ===
          'post_event' ||
        access.checklist.event_status ===
          'closed'
      ) {
        return response.status(409).json({
          error:
            'A checklist está bloqueada porque o evento foi encerrado operacionalmente.',
        })
      }

      if (
        access.checklist.source_type ===
          'assisted_people' &&
        !access.assigned
      ) {
        return response.status(403).json({
          error:
            'Você precisa estar confirmado nesta atividade para operar a checklist de Assistidos.',
        })
      }

      const checkedValue =
        Number(checked) === 1
          ? 1
          : 0

      if (
        access.checklist.source_type ===
          'assisted_people'
      ) {
        const isCheckin =
          access.checklist.activity_name ===
          'Recepção / Check-in de Assistidos'

        const isCheckout =
          access.checklist.activity_name ===
          'Despedida / Check-out de Assistidos'

        if (isCheckin && checkedValue === 0) {
          const checkoutRows = await sql`
            SELECT 1
            FROM activity_checklist_items checkout_item
            JOIN activity_checklists checkout
              ON checkout.id = checkout_item.checklist_id
            JOIN event_roles checkout_role
              ON checkout_role.id = checkout.event_role_id
            JOIN roles checkout_activity
              ON checkout_activity.id = checkout_role.role_id
            WHERE checkout_role.event_id = ${access.checklist.event_id}
              AND checkout.active = 1
              AND checkout.source_type = 'assisted_people'
              AND checkout_activity.name = 'Despedida / Check-out de Assistidos'
              AND checkout_item.assisted_person_id = (
                SELECT assisted_person_id
                FROM activity_checklist_items
                WHERE id = ${numericItemId}
                  AND checklist_id = ${numericChecklistId}
              )
              AND checkout_item.checked = 1
            LIMIT 1
          `

          if (checkoutRows[0]) {
            return response.status(409).json({
              error:
                'Não é possível desfazer o check-in enquanto o check-out estiver marcado.',
            })
          }
        }

        if (isCheckout && checkedValue === 1) {
          const checkinRows = await sql`
            SELECT 1
            FROM activity_checklist_items checkin_item
            JOIN activity_checklists checkin
              ON checkin.id = checkin_item.checklist_id
            JOIN event_roles checkin_role
              ON checkin_role.id = checkin.event_role_id
            JOIN roles checkin_activity
              ON checkin_activity.id = checkin_role.role_id
            WHERE checkin_role.event_id = ${access.checklist.event_id}
              AND checkin.active = 1
              AND checkin.source_type = 'assisted_people'
              AND checkin_activity.name = 'Recepção / Check-in de Assistidos'
              AND checkin_item.assisted_person_id = (
                SELECT assisted_person_id
                FROM activity_checklist_items
                WHERE id = ${numericItemId}
                  AND checklist_id = ${numericChecklistId}
              )
              AND checkin_item.checked = 1
            LIMIT 1
          `

          if (!checkinRows[0]) {
            return response.status(409).json({
              error:
                'Não é possível fazer check-out sem check-in confirmado.',
            })
          }
        }
      }

      const updated = await sql`
        UPDATE activity_checklist_items
        SET
          checked =
            ${checkedValue},

          checked_at =
            ${
              checkedValue === 1
                ? new Date()
                : null
            },

          checked_by =
            ${
              checkedValue === 1
                ? access.session.userId
                : null
            },

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ${numericItemId}

          AND checklist_id =
            ${numericChecklistId}

        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Item não encontrado.',
        })
      }

      return response.status(200).json({
        success: true,
      })
    }


    // =====================================================
    // NOTES
    // =====================================================

    if (
      operation ===
      'update-notes'
    ) {
      const numericChecklistId =
        Number(checklistId)

      const numericItemId =
        Number(itemId)

      const access =
        await getChecklistAccess(
          request,
          numericChecklistId
        )

      if (!access) {
        return response.status(403).json({
          error:
            'Checklist não disponível.',
        })
      }

      if (
        access.checklist.event_status ===
          'post_event' ||
        access.checklist.event_status ===
          'closed'
      ) {
        return response.status(409).json({
          error:
            'A checklist está bloqueada porque o evento foi encerrado operacionalmente.',
        })
      }

      if (
        access.checklist.source_type ===
          'assisted_people' &&
        !access.assigned
      ) {
        return response.status(403).json({
          error:
            'Você precisa estar confirmado nesta atividade para operar a checklist de Assistidos.',
        })
      }

      const cleanNotes =
        typeof notes === 'string'
          ? notes.trim()
          : ''

      await sql`
        UPDATE activity_checklist_items
        SET
          notes =
            ${cleanNotes || null},

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ${numericItemId}

          AND checklist_id =
            ${numericChecklistId}
      `

      return response.status(200).json({
        success: true,
      })
    }

    return response.status(400).json({
      error:
        'Operação de checklist desconhecida.',
    })
  } catch (error) {
    console.error(
      'Checklist error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível concluir a operação da checklist.',
    })
  }
}
