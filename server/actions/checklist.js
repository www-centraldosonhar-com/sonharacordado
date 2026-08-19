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
// - voluntário definido como responsável da checklist.
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

  const assigned =
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
    title,
    assignedUserId,
    itemId,
    checked,
    notes,
  } =
    request.method === 'GET'
      ? request.query ?? {}
      : request.body ?? {}

  try {
    // =====================================================
    // LIST CHECKLISTS OF AN ACTIVITY — ADMIN
    // =====================================================

    if (
      operation ===
      'list-activity'
    ) {
      const numericEventRoleId =
        Number(eventRoleId)

      const admin =
        await requireAdmin(request)

      if (
        !admin ||
        !Number.isInteger(
          numericEventRoleId
        )
      ) {
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

      const rows = await sql`
        SELECT
          ac.id,
          ac.title,
          ac.source_type,
          ac.assigned_user_id,
          ac.active,
          ac.created_at,

          u.name AS assigned_user_name,

          COUNT(aci.id)::int AS total_items,

          COUNT(
            aci.id
          ) FILTER (
            WHERE
              aci.checked = 1
          )::int AS checked_items

        FROM activity_checklists ac

        LEFT JOIN users u
          ON u.id =
            ac.assigned_user_id

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
          ac.created_at,
          u.name

        ORDER BY
          ac.created_at DESC
      `

      return response.status(200).json({
        checklists: rows,
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

      await syncChecklist(
        access.checklist
      )

      const items = await sql`
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

      const checkedValue =
        Number(checked) === 1
          ? 1
          : 0

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
