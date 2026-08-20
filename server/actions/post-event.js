import {
  adminCanAccessEvent,
  getAdminTeamIds,
  isGlobalAdmin,
  isProjectAdmin,
  isTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'


// =========================================================
// HELPERS
// =========================================================

function forbidden(response) {
  return response.status(403).json({
    error:
      'Você não possui permissão para administrar este Pós-Evento.',
  })
}


async function getEvent(eventId) {
  const rows = await sql`
    SELECT
      e.id,
      e.name,
      e.project_id,
      e.event_date,
      e.registration_fee,
      e.event_status,
      e.post_event_opened_at,
      e.post_event_closed_at,
      p.name AS project_name
    FROM events e
    LEFT JOIN projects p
      ON p.id = e.project_id
    WHERE e.id = ${eventId}
    LIMIT 1
  `

  return rows[0] || null
}


// =========================================================
// FINANCIAL SUMMARY
// =========================================================

async function getFinancialSummary(
  eventId
) {
  const registrationRows = await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE er.status = 'confirmed'
      )::int AS confirmed_count,

      COUNT(*) FILTER (
        WHERE er.status = 'confirmed'
        AND er.coupon_id IS NULL
      )::int AS paid_count,

      COUNT(*) FILTER (
        WHERE er.status = 'confirmed'
        AND er.coupon_id IS NOT NULL
      )::int AS free_count,

      COALESCE(
        SUM(
          CASE
            WHEN
              er.status = 'confirmed'
              AND er.coupon_id IS NULL
            THEN e.registration_fee
            ELSE 0
          END
        ),
        0
      )::numeric(12,2)
        AS collected_amount

    FROM event_registrations er

    JOIN events e
      ON e.id = er.event_id

    WHERE er.event_id =
      ${eventId}
  `

  const expenseRows = await sql`
    SELECT
      COALESCE(
        SUM(te.amount),
        0
      )::numeric(12,2)
        AS expenses_amount

    FROM team_expenses te

    WHERE
      te.event_id = ${eventId}

      AND te.active = 1
  `

  const teamExpenseRows = await sql`
    SELECT
      t.id AS team_id,
      t.code AS team_code,
      t.name AS team_name,

      COALESCE(
        SUM(te.amount),
        0
      )::numeric(12,2)
        AS amount

    FROM team_expenses te

    JOIN teams t
      ON t.id = te.team_id

    WHERE
      te.event_id = ${eventId}

      AND te.active = 1

    GROUP BY
      t.id,
      t.code,
      t.name

    ORDER BY
      t.name
  `

  const registrations =
    registrationRows[0] || {}

  const expenses =
    expenseRows[0] || {}

  const collectedAmount =
    Number(
      registrations.collected_amount || 0
    )

  const expensesAmount =
    Number(
      expenses.expenses_amount || 0
    )

  return {
    confirmedCount:
      Number(
        registrations.confirmed_count || 0
      ),

    paidCount:
      Number(
        registrations.paid_count || 0
      ),

    freeCount:
      Number(
        registrations.free_count || 0
      ),

    collectedAmount,

    expensesAmount,

    balanceAmount:
      collectedAmount -
      expensesAmount,

    expensesByTeam:
      teamExpenseRows.map(
        (row) => ({
          ...row,

          amount:
            Number(
              row.amount || 0
            ),
        })
      ),
  }
}


// =========================================================
// ATTENDANCE SUMMARY
// =========================================================

async function getAttendanceSummary(
  eventId
) {
  const rows = await sql`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM event_registrations er
        WHERE
          er.event_id = ${eventId}
          AND er.status = 'confirmed'
      ) AS registered_count,

      (
        SELECT COUNT(
          DISTINCT item.registration_id
        )::int

        FROM activity_checklist_items item

        JOIN activity_checklists checklist
          ON checklist.id =
            item.checklist_id

        JOIN event_roles role
          ON role.id =
            checklist.event_role_id

        WHERE
          role.event_id = ${eventId}

          AND checklist.active = 1

          AND item.checked = 1
      ) AS present_count
  `

  const data =
    rows[0] || {}

  const registered =
    Number(
      data.registered_count || 0
    )

  const present =
    Number(
      data.present_count || 0
    )

  return {
    registeredCount:
      registered,

    presentCount:
      present,

    absentCount:
      Math.max(
        0,
        registered - present
      ),

    attendanceRate:
      registered > 0
        ? Math.round(
            (
              present /
              registered
            ) *
            1000
          ) / 10
        : 0,
  }
}


// =========================================================
// TEAM REPORTS
// =========================================================

async function ensureTeamReports(
  eventId
) {
  const teams = await sql`
    SELECT DISTINCT
      t.id

    FROM teams t

    LEFT JOIN event_roles er
      ON er.team_id = t.id
      AND er.event_id = ${eventId}

    LEFT JOIN team_expenses te
      ON te.team_id = t.id
      AND te.event_id = ${eventId}

    WHERE
      t.active = 1

      AND (
        er.id IS NOT NULL
        OR te.id IS NOT NULL
      )
  `

  for (
    const team
    of teams
  ) {
    await sql`
      INSERT INTO post_event_team_reports (
        event_id,
        team_id,
        status
      )
      VALUES (
        ${eventId},
        ${team.id},
        'pending'
      )
      ON CONFLICT (
        event_id,
        team_id
      )
      DO NOTHING
    `
  }
}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  request,
  response
) {
  const admin =
    await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error:
        'Acesso administrativo não autorizado.',
    })
  }

  const {
    operation,
    eventId,
  } =
    request.method === 'GET'
      ? request.query ?? {}
      : request.body ?? {}

  const numericEventId =
    Number(eventId)

  if (
    !Number.isInteger(
      numericEventId
    )
  ) {
    return response.status(400).json({
      error:
        'Evento inválido.',
    })
  }

  const canAccess =
    await adminCanAccessEvent(
      admin,
      numericEventId
    )

  if (!canAccess) {
    return forbidden(
      response
    )
  }

  try {
    // =====================================================
    // OPEN POST EVENT
    // =====================================================

    if (
      operation ===
      'open'
    ) {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(
          response
        )
      }

      const event =
        await getEvent(
          numericEventId
        )

      if (!event) {
        return response.status(404).json({
          error:
            'Evento não encontrado.',
        })
      }

      if (
        event.event_status ===
        'closed'
      ) {
        return response.status(409).json({
          error:
            'Este evento já foi encerrado definitivamente.',
        })
      }

      await sql`
        UPDATE events
        SET
          event_status =
            'post_event',

          post_event_opened_at =
            COALESCE(
              post_event_opened_at,
              CURRENT_TIMESTAMP
            ),

          registrations_open = 0,

          active = 0

        WHERE id =
          ${numericEventId}
      `

      await sql`
        INSERT INTO post_event_closures (
          event_id,
          status,
          opened_by
        )

        VALUES (
          ${numericEventId},
          'open',
          ${admin.id}
        )

        ON CONFLICT (
          event_id
        )
        DO UPDATE SET
          status =
            CASE
              WHEN
                post_event_closures.status =
                'closed'
              THEN
                post_event_closures.status
              ELSE
                'open'
            END,

          updated_at =
            CURRENT_TIMESTAMP
      `

      await ensureTeamReports(
        numericEventId
      )

      return response.status(200).json({
        success: true,

        message:
          'Pós-Evento iniciado! 🌙',
      })
    }


    // =====================================================
    // SUMMARY
    // =====================================================

    if (
      operation ===
      'summary'
    ) {
      const event =
        await getEvent(
          numericEventId
        )

      if (!event) {
        return response.status(404).json({
          error:
            'Evento não encontrado.',
        })
      }

      const attendance =
        await getAttendanceSummary(
          numericEventId
        )

      const financial =
        await getFinancialSummary(
          numericEventId
        )

      const teamReports =
        await sql`
          SELECT
            report.id,
            report.team_id,
            report.status,
            report.summary,
            report.what_worked,
            report.what_to_improve,
            report.next_event_notes,
            report.submitted_at,

            team.code AS team_code,
            team.name AS team_name,

            submitted_user.name AS submitted_by_name

          FROM post_event_team_reports report

          JOIN teams team
            ON team.id =
              report.team_id

          LEFT JOIN users submitted_user
            ON submitted_user.id =
              report.submitted_by

          WHERE
            report.event_id =
              ${numericEventId}

          ORDER BY
            team.name
        `

      const feedbackRows =
        await sql`
          SELECT
            COUNT(*)::int AS total,

            COALESCE(
              AVG(rating),
              0
            )::numeric(3,2)
              AS average

          FROM post_event_feedback

          WHERE event_id =
            ${numericEventId}
        `

      const closureRows =
        await sql`
          SELECT *
          FROM post_event_closures
          WHERE event_id =
            ${numericEventId}
          LIMIT 1
        `

      return response.status(200).json({
        event,

        attendance,

        financial,

        teamReports,

        feedback: {
          total:
            Number(
              feedbackRows[0]
                ?.total || 0
            ),

          average:
            Number(
              feedbackRows[0]
                ?.average || 0
            ),
        },

        closure:
          closureRows[0] || null,
      })
    }


    if (operation === 'team-reports') {
      const event =
        await getEvent(numericEventId)

      if (!event) {
        return response.status(404).json({
          error: 'Evento não encontrado.',
        })
      }

      const rows = await sql`
        SELECT
          report.id,
          report.event_id,
          report.team_id,
          report.summary,
          report.what_worked,
          report.what_to_improve,
          report.next_event_notes,
          report.status,
          report.submitted_by,
          report.submitted_at,
          report.updated_at,
          team.code AS team_code,
          team.name AS team_name,
          submitted_user.name AS submitted_by_name
        FROM post_event_team_reports report
        JOIN teams team
          ON team.id = report.team_id
        LEFT JOIN users submitted_user
          ON submitted_user.id = report.submitted_by
        WHERE report.event_id = ${numericEventId}
        ORDER BY team.name
      `

      let visibleReports = rows

      if (isTeamAdmin(admin)) {
        const teamIds =
          getAdminTeamIds(admin)

        visibleReports =
          rows.filter((report) =>
            teamIds.includes(
              Number(report.team_id)
            )
          )
      }

      return response.status(200).json({
        event,
        reports: visibleReports,
        access: {
          canSubmit:
            isTeamAdmin(admin),
          canApprove:
            isGlobalAdmin(admin) ||
            isProjectAdmin(admin),
          adminTeamIds:
            getAdminTeamIds(admin),
        },
      })
    }

    if (operation === 'submit-team-report') {
      if (!isTeamAdmin(admin)) {
        return forbidden(response)
      }

      const {
        teamId,
        summary,
        whatWorked,
        whatToImprove,
        nextEventNotes,
      } = request.body ?? {}

      const numericTeamId =
        Number(teamId)

      if (
        !Number.isInteger(numericTeamId)
      ) {
        return response.status(400).json({
          error: 'Equipe inválida.',
        })
      }

      const adminTeamIds =
        getAdminTeamIds(admin)

      if (
        !adminTeamIds.includes(
          numericTeamId
        )
      ) {
        return forbidden(response)
      }

      const event =
        await getEvent(numericEventId)

      if (
        !event ||
        event.event_status !== 'post_event'
      ) {
        return response.status(409).json({
          error:
            'O relatório só pode ser enviado durante o Pós-Evento.',
        })
      }

      const cleanSummary =
        typeof summary === 'string'
          ? summary.trim()
          : ''

      if (!cleanSummary) {
        return response.status(400).json({
          error:
            'Escreva um resumo do evento.',
        })
      }

      const existing = await sql`
        SELECT id, status
        FROM post_event_team_reports
        WHERE event_id = ${numericEventId}
          AND team_id = ${numericTeamId}
        LIMIT 1
      `

      if (
        existing[0]?.status ===
        'approved'
      ) {
        return response.status(409).json({
          error:
            'Este relatório já foi aprovado e está bloqueado.',
        })
      }

      await sql`
        INSERT INTO post_event_team_reports (
          event_id,
          team_id,
          summary,
          what_worked,
          what_to_improve,
          next_event_notes,
          status,
          submitted_by,
          submitted_at,
          updated_at
        )
        VALUES (
          ${numericEventId},
          ${numericTeamId},
          ${cleanSummary},
          ${whatWorked?.trim() || null},
          ${whatToImprove?.trim() || null},
          ${nextEventNotes?.trim() || null},
          'submitted',
          ${admin.id},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (
          event_id,
          team_id
        )
        DO UPDATE SET
          summary = EXCLUDED.summary,
          what_worked = EXCLUDED.what_worked,
          what_to_improve =
            EXCLUDED.what_to_improve,
          next_event_notes =
            EXCLUDED.next_event_notes,
          status = 'submitted',
          submitted_by =
            EXCLUDED.submitted_by,
          submitted_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP
      `

      return response.status(200).json({
        success: true,
        message:
          'Relatório da equipe enviado! 🤝',
      })
    }

    if (operation === 'approve-team-report') {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(response)
      }

      const {
        reportId,
      } = request.body ?? {}

      const numericReportId =
        Number(reportId)

      if (
        !Number.isInteger(
          numericReportId
        )
      ) {
        return response.status(400).json({
          error:
            'Relatório inválido.',
        })
      }

      const reportRows = await sql`
        SELECT
          id,
          event_id,
          status
        FROM post_event_team_reports
        WHERE id = ${numericReportId}
          AND event_id = ${numericEventId}
        LIMIT 1
      `

      const report =
        reportRows[0]

      if (!report) {
        return response.status(404).json({
          error:
            'Relatório não encontrado.',
        })
      }

      if (
        report.status !== 'submitted'
      ) {
        return response.status(409).json({
          error:
            'Somente relatórios enviados podem ser aprovados.',
        })
      }

      await sql`
        UPDATE post_event_team_reports
        SET
          status = 'approved',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id =
          ${numericReportId}
      `

      return response.status(200).json({
        success: true,
        message:
          'Relatório aprovado! ✅',
      })
    }

    return response.status(400).json({
      error:
        'Operação de Pós-Evento desconhecida.',
    })

  } catch (error) {
    console.error(
      'Post-event error:',
      error
    )

    return response.status(500).json({
      error:
        error?.message ||
        'Não foi possível administrar o Pós-Evento.',
    })
  }
}
