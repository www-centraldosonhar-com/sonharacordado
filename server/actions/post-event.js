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


async function canAccessPostEvent(
  admin,
  eventId
) {
  const event =
    await getEvent(eventId)

  if (!event) {
    return false
  }

  // Eventos específicos continuam utilizando
  // a autorização normal da Central.
  if (
    event.project_id !== null
  ) {
    return adminCanAccessEvent(
      admin,
      eventId
    )
  }

  // =======================================================
  // EVENTO GERAL
  // =======================================================
  // Geral e Projeto podem administrar/revisar o Pós-Evento.
  // Um Admin de Equipe só entra quando foi explicitamente
  // escolhido como responsável por alguma equipe.
  //
  // Isso NÃO concede permissões permanentes e NÃO libera
  // automaticamente aprovação ou abertura do Pós-Evento.
  // Essas operações possuem validações próprias.
  // =======================================================

  if (
    isGlobalAdmin(admin) ||
    isProjectAdmin(admin)
  ) {
    return true
  }

  if (!isTeamAdmin(admin)) {
    return false
  }

  const assignmentRows =
    await sql`
      SELECT
        1

      FROM post_event_team_reports

      WHERE
        event_id =
          ${Number(eventId)}

        AND responsible_user_id =
          ${Number(admin.id)}

      LIMIT 1
    `

  return Boolean(
    assignmentRows[0]
  )
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
  // =======================================================
  // CENTRAL 3.0 — PÓS-EVENTO POR TIPO DE EVENTO
  // =======================================================
  // Evento de projeto:
  //   todas as equipes ativas precisam entregar Pós-Evento.
  //
  // Evento geral:
  //   os responsáveis serão escolhidos explicitamente por
  //   equipe, portanto não criamos relatórios automáticos
  //   nesta etapa.
  // =======================================================

  const eventRows = await sql`
    SELECT
      id,
      project_id

    FROM events

    WHERE
      id = ${eventId}

    LIMIT 1
  `

  const event =
    eventRows[0]

  if (!event) {
    return
  }

  // Evento geral / global.
  if (event.project_id === null) {
    return
  }

  const teams = await sql`
    SELECT
      t.id

    FROM teams t

    WHERE
      t.active = 1

    ORDER BY
      t.name
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
    await canAccessPostEvent(
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

      // ===================================================
      // DATA DO EVENTO
      // ===================================================
      // O Pós-Evento só pode começar no próprio dia do
      // evento ou depois dele.
      //
      // A comparação é feita diretamente no PostgreSQL
      // usando CURRENT_DATE para evitar diferenças de
      // timezone entre navegador, Node e banco.
      // ===================================================

      const openedEvents =
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

          WHERE
            id =
              ${numericEventId}

            AND event_date <=
              CURRENT_DATE

          RETURNING
            id,
            event_date
        `

      if (!openedEvents[0]) {
        return response.status(409).json({
          error:
            'O Pós-Evento só pode ser iniciado na data do evento ou depois.',
        })
      }

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
          SELECT DISTINCT ON (
            team.id
          )
            report.id,
            report.id AS report_id,

            team.id AS team_id,

            COALESCE(
              report.status,
              'pending'
            ) AS status,

            report.summary,
            report.what_worked,
            report.what_to_improve,
            report.next_event_notes,

            report.rating,
            report.rating_comment,

            report.returned_by,
            report.returned_at,
            report.return_reason,

            report.submitted_by,
            report.submitted_at,
            report.updated_at,

            COALESCE(
              report.financial_status,
              'pending'
            ) AS financial_status,

            report.financial_completed_at,
            report.financial_completed_by,

            report.responsible_user_id,
            report.assigned_at,

            team.code AS team_code,
            team.name AS team_name,

            submitted_user.name
              AS submitted_by_name,

            responsible_user.name
              AS responsible_user_name

          FROM teams team

          LEFT JOIN post_event_team_reports report
            ON report.team_id = team.id
            AND report.event_id = ${numericEventId}

          LEFT JOIN users submitted_user
            ON submitted_user.id = report.submitted_by

          LEFT JOIN users responsible_user
            ON responsible_user.id = report.responsible_user_id

          WHERE team.active = 1

          ORDER BY
            team.id,
            report.updated_at DESC NULLS LAST,
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

      const feedbackCommentRows =
        await sql`
          SELECT
            feedback.id,
            feedback.rating,
            feedback.comment,
            feedback.created_at,

            user_account.name
              AS user_name,

            project.name
              AS project_name

          FROM post_event_feedback feedback

          JOIN users user_account
            ON user_account.id =
              feedback.user_id

          LEFT JOIN projects project
            ON project.id =
              user_account.project_id

          WHERE
            feedback.event_id =
              ${numericEventId}

            AND NULLIF(
              TRIM(
                COALESCE(
                  feedback.comment,
                  ''
                )
              ),
              ''
            ) IS NOT NULL

          ORDER BY
            feedback.created_at DESC,
            feedback.id DESC
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

          comments:
            feedbackCommentRows.map(
              (item) => ({
                id:
                  item.id,

                rating:
                  Number(
                    item.rating || 0
                  ),

                comment:
                  item.comment,

                createdAt:
                  item.created_at,

                userName:
                  item.user_name,

                projectName:
                  item.project_name,
              })
            ),
        },

        closure:
          closureRows[0] || null,
      })
    }


    // =====================================================
    // CLOSE EVENT EXPENSES
    // =====================================================
    //
    // Admin Geral:
    // - pode fechar qualquer evento.
    //
    // Admin de Projeto:
    // - apenas eventos do próprio projeto.
    //
    // Após este fechamento:
    // - gastos ficam congelados;
    // - Financeiro pode considerar o valor oficial.
    // =====================================================

    if (
      operation ===
      'close-expenses'
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
        return response
          .status(404)
          .json({
            error:
              'Evento não encontrado.',
          })
      }

      if (
        event.event_status !==
        'post_event'
      ) {
        return response
          .status(409)
          .json({
            error:
              'Os gastos só podem ser fechados durante o Pós-Evento.',
          })
      }

      if (
        isProjectAdmin(admin) &&
        event.project_id !== null &&
        Number(
          event.project_id
        ) !==
        Number(
          admin.projectId
        )
      ) {
        return forbidden(
          response
        )
      }

      const closureRows =
        await sql`
          SELECT
            id,
            expenses_closed
          FROM post_event_closures
          WHERE event_id =
            ${numericEventId}
          LIMIT 1
        `

      const closure =
        closureRows[0]

      if (!closure) {
        return response
          .status(409)
          .json({
            error:
              'O Pós-Evento ainda não foi iniciado para este evento.',
          })
      }

      if (
        Number(
          closure.expenses_closed
        ) === 1
      ) {
        return response
          .status(409)
          .json({
            error:
              'Os gastos deste evento já foram fechados.',
          })
      }

      // =================================================
      // FECHAMENTOS DAS EQUIPES
      // =================================================
      // O financeiro global só pode ser finalizado depois
      // que todos os fechamentos existentes deste evento
      // forem aprovados.
      //
      // A proteção é feita no backend para não depender
      // apenas do estado visual do botão no frontend.
      // =================================================

      const teamClosureRows =
        await sql`
          SELECT
            COUNT(*)::int
              AS total_count,

            COUNT(*) FILTER (
              WHERE
                report.status = 'approved'
                AND report.financial_status IN (
                  'expenses',
                  'no_expenses',
                  'donation'
                )
            )::int
              AS approved_count

          FROM teams team

          LEFT JOIN post_event_team_reports report
            ON report.team_id = team.id
            AND report.event_id = ${numericEventId}

          WHERE team.active = 1
        `

      const totalTeamClosures =
        Number(
          teamClosureRows[0]
            ?.total_count || 0
        )

      const approvedTeamClosures =
        Number(
          teamClosureRows[0]
            ?.approved_count || 0
        )

      if (
        totalTeamClosures === 0
      ) {
        return response
          .status(409)
          .json({
            error:
              'Nenhum fechamento de equipe está disponível para este evento.',
          })
      }

      if (
        approvedTeamClosures !==
        totalTeamClosures
      ) {
        return response
          .status(409)
          .json({
            error:
              'Ainda existem fechamentos de equipe aguardando aprovação.',

            totalTeamClosures,
            approvedTeamClosures,

            pendingTeamClosures:
              totalTeamClosures -
              approvedTeamClosures,
          })
      }


      const totalRows =
        await sql`
          SELECT
            COUNT(*) FILTER (
              WHERE active = 1
            )::int AS expense_count,

            COALESCE(
              SUM(amount) FILTER (
                WHERE active = 1
              ),
              0
            )::numeric(12,2)
              AS expense_total

          FROM team_expenses

          WHERE event_id =
            ${numericEventId}
        `

      await sql`
        UPDATE post_event_closures

        SET
          expenses_closed = 1,

          expenses_closed_by =
            ${admin.id},

          expenses_closed_at =
            CURRENT_TIMESTAMP,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE event_id =
          ${numericEventId}
      `

      return response
        .status(200)
        .json({
          success: true,

          expensesClosed: true,

          expenseCount:
            Number(
              totalRows[0]
                ?.expense_count || 0
            ),

          expenseTotal:
            Number(
              totalRows[0]
                ?.expense_total || 0
            ),

          message:
            'Fechamento de gastos concluído! 💰🔒',
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

      const isGeneralEvent =
        event.project_id === null

      let rows = []

      if (isGeneralEvent) {
        // =================================================
        // EVENTO GERAL
        // =================================================
        // Todas as equipes ativas aparecem como slots,
        // mesmo antes de existir um relatório real.
        //
        // O relatório será criado posteriormente pelo
        // assign-team-responsible.
        // =================================================

        rows = await sql`
          SELECT DISTINCT ON (
            team.id
          )
            report.id,
            report.id AS report_id,

            ${numericEventId}
              AS event_id,

            team.id
              AS team_id,

            report.summary,
            report.what_worked,
            report.what_to_improve,
            report.next_event_notes,

            COALESCE(
              report.status,
              'pending'
            ) AS status,

            report.submitted_by,
            report.submitted_at,
            report.updated_at,

            report.responsible_user_id,
            report.assigned_by,
            report.assigned_at,

            COALESCE(
              report.financial_status,
              'pending'
            ) AS financial_status,

            report.financial_completed_at,
            report.financial_completed_by,

            report.returned_by,
            report.returned_at,
            report.return_reason,

            team.code
              AS team_code,

            team.name
              AS team_name,

            submitted_user.name
              AS submitted_by_name,

            responsible_user.name
              AS responsible_user_name

          FROM teams team

          LEFT JOIN post_event_team_reports report
            ON report.team_id =
              team.id

            AND report.event_id =
              ${numericEventId}

          LEFT JOIN users submitted_user
            ON submitted_user.id =
              report.submitted_by

          LEFT JOIN users responsible_user
            ON responsible_user.id =
              report.responsible_user_id

          WHERE
            team.active = 1

          ORDER BY
            team.id,
            report.updated_at DESC NULLS LAST,
            team.name
        `
      } else {
        // =================================================
        // EVENTO DE PROJETO
        // =================================================
        // Mantém o comportamento normal com relatórios
        // reais já criados pelo ensureTeamReports().
        // =================================================

        rows = await sql`
          SELECT
            report.id,
            report.id AS report_id,
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

            report.responsible_user_id,
            report.assigned_by,
            report.assigned_at,

            COALESCE(
              report.financial_status,
              'pending'
            ) AS financial_status,

            report.financial_completed_at,
            report.financial_completed_by,

            report.returned_by,
            report.returned_at,
            report.return_reason,

            team.code
              AS team_code,

            team.name
              AS team_name,

            submitted_user.name
              AS submitted_by_name,

            responsible_user.name
              AS responsible_user_name

          FROM post_event_team_reports report

          JOIN teams team
            ON team.id =
              report.team_id

          LEFT JOIN users submitted_user
            ON submitted_user.id =
              report.submitted_by

          LEFT JOIN users responsible_user
            ON responsible_user.id =
              report.responsible_user_id

          WHERE
            report.event_id =
              ${numericEventId}

          ORDER BY
            team.name
        `
      }

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

      
      // ===================================================
      // CENTRAL 3.0 — ADMINS ELEGÍVEIS POR EQUIPE
      // ===================================================
      // Somente eventos gerais precisam selecionar um
      // responsável. Em eventos de projeto o fluxo normal
      // dos Admins de Equipe permanece inalterado.
      // ===================================================

      const closureRows =
        await sql`
          SELECT
            expenses_closed
          FROM post_event_closures
          WHERE event_id = ${numericEventId}
          LIMIT 1
        `

      const expensesClosed =
        Number(
          closureRows[0]?.expenses_closed || 0
        ) === 1

      const reportsWithEligibleAdmins =
        await Promise.all(
          visibleReports.map(
            async (report) => {
              let eligibleAdmins = []

              if (isGeneralEvent) {
                const eligibleRows =
                  await sql`
                    SELECT DISTINCT
                      u.id,

                      u.name AS name

                    FROM users u

                    INNER JOIN user_permissions up
                      ON up.user_id = u.id
                      AND up.permission = 'admin'
                      AND up.active = 1

                    INNER JOIN user_teams ut
                      ON ut.user_id = u.id
                      AND ut.team_id =
                        ${report.team_id}
                      AND ut.active = 1

                    WHERE
                      u.active = 1

                    ORDER BY
                      name
                  `

                eligibleAdmins =
                  eligibleRows.map(
                    (person) => ({
                      id:
                        Number(person.id),

                      name:
                        person.name,
                    })
                  )
              }

              return {
                ...report,

                eligible_admins:
                  eligibleAdmins,
              }
            }
          )
        )

return response.status(200).json({
        event,
        reports: reportsWithEligibleAdmins,
        access: {
          currentAdminId:
            Number(admin.id),

          isGeneralEvent,

          expensesClosed,

          canAssignResponsible:
            isGlobalAdmin(admin) ||
            isProjectAdmin(admin),

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

    if (
      operation ===
      'assign-team-responsible'
    ) {
      // ===================================================
      // CENTRAL 3.0
      // EVENTO GERAL — RESPONSÁVEL PELO PÓS-EVENTO
      // ===================================================

      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(response)
      }

      const {
        teamId,
        responsibleUserId,
      } = request.body ?? {}

      const numericTeamId =
        Number(teamId)

      const numericResponsibleUserId =
        Number(responsibleUserId)

      if (
        !Number.isInteger(
          numericTeamId
        ) ||
        !Number.isInteger(
          numericResponsibleUserId
        )
      ) {
        return response.status(400).json({
          error:
            'Equipe ou responsável inválido.',
        })
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
        event.project_id !== null
      ) {
        return response.status(409).json({
          error:
            'A seleção de responsável é exclusiva para eventos gerais.',
        })
      }

      if (
        event.event_status !==
        'post_event'
      ) {
        return response.status(409).json({
          error:
            'Os responsáveis só podem ser definidos durante o Pós-Evento.',
        })
      }

      const assignmentClosureRows =
        await sql`
          SELECT expenses_closed
          FROM post_event_closures
          WHERE event_id = ${numericEventId}
          LIMIT 1
        `

      if (
        Number(
          assignmentClosureRows[0]?.expenses_closed || 0
        ) === 1
      ) {
        return response.status(409).json({
          error:
            'O financeiro deste evento já foi finalizado. Os responsáveis não podem mais ser alterados.',
        })
      }

      // ---------------------------------------------------
      // Confirma que a equipe existe e está ativa.
      // ---------------------------------------------------

      const teamRows = await sql`
        SELECT
          id,
          name

        FROM teams

        WHERE
          id = ${numericTeamId}
          AND active = 1

        LIMIT 1
      `

      const team =
        teamRows[0]

      if (!team) {
        return response.status(404).json({
          error:
            'Equipe não encontrada ou inativa.',
        })
      }

      // ---------------------------------------------------
      // O responsável precisa:
      //
      // 1. existir e estar ativo;
      // 2. possuir permissão Admin ativa;
      // 3. pertencer à equipe selecionada.
      //
      // A atribuição NÃO modifica permissões permanentes.
      // ---------------------------------------------------

      const responsibleRows =
        await sql`
          SELECT DISTINCT
            u.id,
            u.name

          FROM users u

          INNER JOIN user_permissions up
            ON up.user_id = u.id
            AND up.permission = 'admin'
            AND up.active = 1

          INNER JOIN user_teams ut
            ON ut.user_id = u.id
            AND ut.team_id =
              ${numericTeamId}
            AND ut.active = 1

          WHERE
            u.id =
              ${numericResponsibleUserId}

            AND u.active = 1

          LIMIT 1
        `

      const responsible =
        responsibleRows[0]

      if (!responsible) {
        return response.status(400).json({
          error:
            'O responsável precisa ser um Admin ativo pertencente à equipe selecionada.',
        })
      }

      // ---------------------------------------------------
      // Um relatório por equipe/evento.
      //
      // Se já existir, atualizamos somente a atribuição.
      // Não apagamos eventual conteúdo existente.
      // ---------------------------------------------------

      await sql`
        INSERT INTO
          post_event_team_reports (
            event_id,
            team_id,
            status,
            responsible_user_id,
            assigned_by,
            assigned_at,
            updated_at
          )

        VALUES (
          ${numericEventId},
          ${numericTeamId},
          'pending',
          ${numericResponsibleUserId},
          ${admin.id},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (
          event_id,
          team_id
        )

        DO UPDATE SET
          responsible_user_id =
            EXCLUDED.responsible_user_id,

          assigned_by =
            EXCLUDED.assigned_by,

          assigned_at =
            CURRENT_TIMESTAMP,

          updated_at =
            CURRENT_TIMESTAMP
      `

      const responsibleName =
        responsible.name

      return response.status(200).json({
        success: true,

        message:
          `${responsibleName} ficou responsável pelo Pós-Evento da equipe ${team.name}.`,

        assignment: {
          eventId:
            numericEventId,

          teamId:
            numericTeamId,

          teamName:
            team.name,

          responsibleUserId:
            numericResponsibleUserId,

          responsibleUserName:
            responsibleName,
        },
      })
    }



    if (
      operation ===
      'reset-team-financial'
    ) {
      const {
        teamId,
      } = request.body ?? {}

      const numericTeamId =
        Number(teamId)

      if (
        !Number.isInteger(
          numericTeamId
        )
      ) {
        return response.status(400).json({
          error:
            'Equipe inválida.',
        })
      }

      const event =
        await getEvent(
          numericEventId
        )

      if (
        !event ||
        event.event_status !==
          'post_event'
      ) {
        return response.status(409).json({
          error:
            'A decisão financeira só pode ser alterada durante o Pós-Evento.',
        })
      }

      const closureRows =
        await sql`
          SELECT expenses_closed
          FROM post_event_closures
          WHERE event_id = ${numericEventId}
          LIMIT 1
        `

      if (
        Number(
          closureRows[0]?.expenses_closed || 0
        ) === 1
      ) {
        return response.status(409).json({
          error:
            'Os gastos deste evento já foram finalizados e não podem mais ser alterados.',
        })
      }

      // ===================================================
      // RELATÓRIO / RESPONSÁVEL
      // ===================================================

      const reportRows =
        await sql`
          SELECT
            id,
            responsible_user_id,
            financial_status

          FROM post_event_team_reports

          WHERE
            event_id =
              ${numericEventId}

            AND team_id =
              ${numericTeamId}

          LIMIT 1
        `

      const report =
        reportRows[0]

      if (!report) {
        return response.status(404).json({
          error:
            'Prestação da equipe não encontrada.',
        })
      }

      // ===================================================
      // AUTORIZAÇÃO
      // ===================================================

      if (
        isProjectAdmin(admin) &&
        event.project_id !== null &&
        Number(event.project_id) !==
          Number(admin.projectId)
      ) {
        return forbidden(response)
      }

      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        if (!isTeamAdmin(admin)) {
          return forbidden(response)
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

        if (
          event.project_id === null &&
          Number(
            report.responsible_user_id
          ) !==
          Number(admin.id)
        ) {
          return response.status(403).json({
            error:
              'Você não é o responsável selecionado para o Pós-Evento desta equipe.',
          })
        }

        if (
          event.project_id !== null &&
          Number(event.project_id) !==
            Number(admin.projectId)
        ) {
          return forbidden(response)
        }
      }

      // ===================================================
      // RESET DA DECISÃO
      // ===================================================
      // Mantém o responsável e reabre apenas a parte
      // financeira da equipe.
      // ===================================================

      await sql`
        UPDATE post_event_team_reports

        SET
          status = 'pending',
          financial_status = 'pending',
          financial_completed_by = NULL,
          financial_completed_at = NULL,
          submitted_by = NULL,
          submitted_at = NULL,
          updated_at = CURRENT_TIMESTAMP

        WHERE
          event_id =
            ${numericEventId}

          AND team_id =
            ${numericTeamId}
      `

      return response.status(200).json({
        ok: true,
        message:
          'Decisão financeira reaberta com sucesso.',
      })
    }


    if (
      operation ===
      'complete-team-financial'
    ) {
      const {
        teamId,
        financialStatus,
      } = request.body ?? {}

      const numericTeamId =
        Number(teamId)

      const allowedStatuses =
        new Set([
          'expenses',
          'no_expenses',
          'donation',
        ])

      if (
        !Number.isInteger(
          numericTeamId
        ) ||
        !allowedStatuses.has(
          financialStatus
        )
      ) {
        return response.status(400).json({
          error:
            'Situação financeira inválida.',
        })
      }

      const event =
        await getEvent(
          numericEventId
        )

      if (
        !event ||
        event.event_status !==
          'post_event'
      ) {
        return response.status(409).json({
          error:
            'A situação financeira só pode ser concluída durante o Pós-Evento.',
        })
      }

      const closureRows =
        await sql`
          SELECT expenses_closed
          FROM post_event_closures
          WHERE event_id = ${numericEventId}
          LIMIT 1
        `

      if (
        Number(
          closureRows[0]?.expenses_closed || 0
        ) === 1
      ) {
        return response.status(409).json({
          error:
            'Os gastos deste evento já foram finalizados e não podem mais ser alterados.',
        })
      }

      // ===================================================
      // AUTORIZAÇÃO
      // ===================================================

      if (!isGlobalAdmin(admin)) {
        if (!isTeamAdmin(admin)) {
          return forbidden(response)
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

        // Evento geral:
        // somente o responsável escolhido pode concluir.
        if (
          event.project_id === null
        ) {
          const assignmentRows =
            await sql`
              SELECT
                responsible_user_id

              FROM post_event_team_reports

              WHERE
                event_id =
                  ${numericEventId}

                AND team_id =
                  ${numericTeamId}

              LIMIT 1
            `

          if (
            Number(
              assignmentRows[0]
                ?.responsible_user_id
            ) !==
            Number(admin.id)
          ) {
            return response.status(403).json({
              error:
                'Você não é o responsável selecionado para o Pós-Evento desta equipe.',
            })
          }
        } else if (
          Number(event.project_id) !==
          Number(admin.projectId)
        ) {
          return forbidden(response)
        }
      }

      // ===================================================
      // COM GASTOS
      // ===================================================
      // Precisa existir pelo menos um gasto ativo.
      // ===================================================

      const expenseRows =
        await sql`
          SELECT
            COUNT(*)::int
              AS total

          FROM team_expenses

          WHERE
            event_id =
              ${numericEventId}

            AND team_id =
              ${numericTeamId}

            AND active = 1
        `

      const activeExpenseCount =
        Number(
          expenseRows[0]?.total || 0
        )

      // ===================================================
      // COM GASTOS
      // ===================================================

      if (
        financialStatus ===
          'expenses' &&
        activeExpenseCount === 0
      ) {
        return response.status(409).json({
          error:
            'Registre pelo menos um gasto antes de concluir como "Com gastos".',
        })
      }

      // ===================================================
      // SEM GASTOS / DOAÇÃO
      // ===================================================
      // Não permitimos encerrar como R$ 0 enquanto ainda
      // existirem despesas ativas vinculadas à equipe.
      // ===================================================

      if (
        (
          financialStatus ===
            'no_expenses' ||
          financialStatus ===
            'donation'
        ) &&
        activeExpenseCount > 0
      ) {
        return response.status(409).json({
          error:
            'Existem gastos ativos para esta equipe. Resolva ou cancele os lançamentos antes de marcar como "Sem gastos" ou "Doação".',
        })
      }

      // ===================================================
      // RELATÓRIO ATUAL
      // ===================================================
      // Um relatório já aprovado não deve voltar para
      // "submitted" apenas porque o responsável clicou
      // novamente em Concluir financeiro.
      //
      // Para alterar uma prestação aprovada, ela precisa
      // primeiro ser reaberta pelo fluxo "Alterar decisão".
      // ===================================================

      const currentReportRows =
        await sql`
          SELECT
            id,
            status,
            financial_status

          FROM post_event_team_reports

          WHERE
            event_id =
              ${numericEventId}

            AND team_id =
              ${numericTeamId}

          LIMIT 1
        `

      const currentReport =
        currentReportRows[0]

      if (
        currentReport?.status ===
          'approved'
      ) {
        return response.status(409).json({
          error:
            'Esta prestação já foi aprovada. Use "Alterar decisão" antes de fazer uma nova alteração.',
        })
      }


      // ===================================================
      // Garante que exista o relatório-base.
      // ===================================================

      // ===================================================
      // STATUS DA PRESTAÇÃO FINANCEIRA
      // ===================================================
      //
      // Sem gastos / Doação:
      // não existe comprovante para revisar.
      // A prestação é aprovada automaticamente.
      //
      // Com gastos:
      // entra como submitted para revisão do
      // Admin de Projeto / Admin Geral.
      // ===================================================

      const financialReportStatus =
        financialStatus === 'expenses'
          ? 'submitted'
          : 'approved'

      await sql`
        INSERT INTO post_event_team_reports (
          event_id,
          team_id,
          status,
          financial_status,
          financial_completed_at,
          financial_completed_by,
          submitted_by,
          submitted_at,
          updated_at
        )

        VALUES (
          ${numericEventId},
          ${numericTeamId},
          ${financialReportStatus},
          ${financialStatus},
          CURRENT_TIMESTAMP,
          ${admin.id},
          ${admin.id},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (
          event_id,
          team_id
        )

        DO UPDATE SET
          status =
            EXCLUDED.status,

          financial_status =
            EXCLUDED.financial_status,

          financial_completed_at =
            CURRENT_TIMESTAMP,

          financial_completed_by =
            EXCLUDED.financial_completed_by,

          submitted_by =
            EXCLUDED.submitted_by,

          submitted_at =
            CURRENT_TIMESTAMP,

          returned_by =
            NULL,

          returned_at =
            NULL,

          return_reason =
            NULL,

          updated_at =
            CURRENT_TIMESTAMP
      `

      const labels = {
        expenses:
          'Com gastos',

        no_expenses:
          'Sem gastos',

        donation:
          'Doação',
      }

      return response.status(200).json({
        success: true,

        message:
          `Situação financeira concluída: ${labels[financialStatus]}.`,

        financialStatus,
      })
    }


    // =====================================================
    // ENCERRAMENTO ADMINISTRATIVO DO PÓS-EVENTO
    // =====================================================

    if (
      operation ===
      'close-post-event'
    ) {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(response)
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
        event.event_status === 'closed'
      ) {
        return response.status(409).json({
          error:
            'Este Pós-Evento já foi encerrado.',
        })
      }

      if (
        event.event_status !== 'post_event'
      ) {
        return response.status(409).json({
          error:
            'O evento precisa estar em Pós-Evento para ser encerrado.',
        })
      }

      if (
        isProjectAdmin(admin) &&
        event.project_id !== null &&
        Number(event.project_id) !==
          Number(admin.projectId)
      ) {
        return forbidden(response)
      }

      const closureRows =
        await sql`
          SELECT
            id,
            expenses_closed
          FROM post_event_closures
          WHERE event_id = ${numericEventId}
          LIMIT 1
        `

      const closure =
        closureRows[0]

      if (!closure) {
        return response.status(409).json({
          error:
            'O Pós-Evento ainda não foi iniciado.',
        })
      }

      if (
        Number(
          closure.expenses_closed || 0
        ) !== 1
      ) {
        return response.status(409).json({
          error:
            'Finalize primeiro a prestação financeira do evento.',
        })
      }

      const teamRows =
        await sql`
          SELECT
            COUNT(*)::int AS total_count,

            COUNT(*) FILTER (
              WHERE
                report.status = 'approved'
                AND report.financial_status IN (
                  'expenses',
                  'no_expenses',
                  'donation'
                )
            )::int AS approved_count

          FROM teams team

          LEFT JOIN post_event_team_reports report
            ON report.team_id = team.id
            AND report.event_id = ${numericEventId}

          WHERE team.active = 1
        `

      const totalTeams =
        Number(
          teamRows[0]?.total_count || 0
        )

      const approvedTeams =
        Number(
          teamRows[0]?.approved_count || 0
        )

      if (
        totalTeams === 0 ||
        approvedTeams !== totalTeams
      ) {
        return response.status(409).json({
          error:
            'Ainda existem prestações de equipe pendentes.',
          totalTeams,
          approvedTeams,
        })
      }

      await sql`
        UPDATE events
        SET
          event_status = 'closed',
          post_event_closed_at =
            CURRENT_TIMESTAMP,
          registrations_open = 0,
          active = 0
        WHERE id = ${numericEventId}
      `

      await sql`
        UPDATE post_event_closures
        SET
          status = 'closed',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE event_id = ${numericEventId}
      `

      return response.status(200).json({
        success: true,
        message:
          'Pós-Evento encerrado administrativamente. ✅',
      })
    }


    // =====================================================
    // PERGUNTAS DINÂMICAS DO RELATÓRIO
    // =====================================================


    // -----------------------------------------------------
    // LISTAR PERGUNTAS
    // -----------------------------------------------------

    if (
      operation ===
      'list-report-questions'
    ) {
      const questions =
        await sql`
          SELECT
            id,
            event_id,
            question_text,
            position,
            required,
            active,
            created_by,
            created_at,
            updated_at

          FROM post_event_questions

          WHERE
            event_id =
              ${numericEventId}

            AND active = TRUE

          ORDER BY
            position,
            id
        `

      return response.status(200).json({
        questions,
      })
    }


    // -----------------------------------------------------
    // CRIAR PERGUNTA
    // -----------------------------------------------------

    if (
      operation ===
      'create-report-question'
    ) {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(response)
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

      // Evento específico:
      // Admin de Projeto só configura o próprio projeto.
      //
      // Evento Geral:
      // qualquer Admin de Projeto/Geral autorizado ao
      // Pós-Evento pode configurar.
      if (
        isProjectAdmin(admin) &&
        event.project_id !== null &&
        Number(
          event.project_id
        ) !==
        Number(
          admin.projectId
        )
      ) {
        return forbidden(response)
      }

      const {
        questionText,
        required = true,
      } = request.body ?? {}

      const cleanQuestion =
        questionText
          ?.trim()

      if (!cleanQuestion) {
        return response.status(400).json({
          error:
            'Digite a pergunta.',
        })
      }

      if (
        cleanQuestion.length > 500
      ) {
        return response.status(400).json({
          error:
            'A pergunta está muito longa.',
        })
      }

      const positionRows =
        await sql`
          SELECT
            COALESCE(
              MAX(position),
              0
            )::int
              AS max_position

          FROM post_event_questions

          WHERE
            event_id =
              ${numericEventId}

            AND active = TRUE
        `

      const nextPosition =
        Number(
          positionRows[0]
            ?.max_position || 0
        ) + 1

      const rows =
        await sql`
          INSERT INTO post_event_questions (
            event_id,
            question_text,
            position,
            required,
            active,
            created_by,
            created_at,
            updated_at
          )

          VALUES (
            ${numericEventId},
            ${cleanQuestion},
            ${nextPosition},
            ${Boolean(required)},
            TRUE,
            ${admin.id},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          RETURNING
            id,
            event_id,
            question_text,
            position,
            required,
            active,
            created_by,
            created_at,
            updated_at
        `

      return response.status(201).json({
        success: true,

        message:
          'Pergunta adicionada! ✨',

        question:
          rows[0],
      })
    }


    // -----------------------------------------------------
    // EDITAR PERGUNTA
    // -----------------------------------------------------

    if (
      operation ===
      'update-report-question'
    ) {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(response)
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
        isProjectAdmin(admin) &&
        event.project_id !== null &&
        Number(
          event.project_id
        ) !==
        Number(
          admin.projectId
        )
      ) {
        return forbidden(response)
      }

      const {
        questionId,
        questionText,
        required,
        position,
      } = request.body ?? {}

      const numericQuestionId =
        Number(questionId)

      const cleanQuestion =
        questionText
          ?.trim()

      const numericPosition =
        Number(position)

      if (
        !Number.isInteger(
          numericQuestionId
        ) ||
        !cleanQuestion
      ) {
        return response.status(400).json({
          error:
            'Pergunta inválida.',
        })
      }

      if (
        cleanQuestion.length > 500
      ) {
        return response.status(400).json({
          error:
            'A pergunta está muito longa.',
        })
      }

      const existing =
        await sql`
          SELECT
            id

          FROM post_event_questions

          WHERE
            id =
              ${numericQuestionId}

            AND event_id =
              ${numericEventId}

            AND active = TRUE

          LIMIT 1
        `

      if (!existing[0]) {
        return response.status(404).json({
          error:
            'Pergunta não encontrada.',
        })
      }

      const safePosition =
        Number.isInteger(
          numericPosition
        ) &&
        numericPosition > 0
          ? numericPosition
          : null

      const rows =
        await sql`
          UPDATE post_event_questions

          SET
            question_text =
              ${cleanQuestion},

            required =
              ${Boolean(required)},

            position =
              COALESCE(
                ${safePosition},
                position
              ),

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id =
              ${numericQuestionId}

            AND event_id =
              ${numericEventId}

          RETURNING
            id,
            event_id,
            question_text,
            position,
            required,
            active,
            created_by,
            created_at,
            updated_at
        `

      return response.status(200).json({
        success: true,

        message:
          'Pergunta atualizada.',

        question:
          rows[0],
      })
    }


    // -----------------------------------------------------
    // DESATIVAR PERGUNTA
    // -----------------------------------------------------
    //
    // Não usamos DELETE físico.
    // Respostas antigas permanecem preservadas.
    // -----------------------------------------------------

    if (
      operation ===
      'delete-report-question'
    ) {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(response)
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
        isProjectAdmin(admin) &&
        event.project_id !== null &&
        Number(
          event.project_id
        ) !==
        Number(
          admin.projectId
        )
      ) {
        return forbidden(response)
      }

      const {
        questionId,
      } = request.body ?? {}

      const numericQuestionId =
        Number(questionId)

      if (
        !Number.isInteger(
          numericQuestionId
        )
      ) {
        return response.status(400).json({
          error:
            'Pergunta inválida.',
        })
      }

      const rows =
        await sql`
          UPDATE post_event_questions

          SET
            active = FALSE,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id =
              ${numericQuestionId}

            AND event_id =
              ${numericEventId}

            AND active = TRUE

          RETURNING id
        `

      if (!rows[0]) {
        return response.status(404).json({
          error:
            'Pergunta não encontrada.',
        })
      }

      return response.status(200).json({
        success: true,

        message:
          'Pergunta removida da configuração.',
      })
    }


    // =====================================================
    // FORMULÁRIO DINÂMICO DO FECHAMENTO DA EQUIPE
    // =====================================================

    if (
      operation ===
      'team-report-form'
    ) {
      const {
        teamId,
      } = request.body ?? {}

      const numericTeamId =
        Number(teamId)

      if (
        !Number.isInteger(
          numericTeamId
        )
      ) {
        return response.status(400).json({
          error:
            'Equipe inválida.',
        })
      }

      const questions =
        await sql`
          SELECT
            question.id,
            question.question_text,
            question.position,
            question.required,

            COALESCE(
              answer.answer_text,
              ''
            ) AS answer_text

          FROM post_event_questions question

          LEFT JOIN post_event_answers answer
            ON answer.question_id =
              question.id

            AND answer.event_id =
              ${numericEventId}

            AND answer.team_id =
              ${numericTeamId}

          WHERE
            question.event_id =
              ${numericEventId}

            AND question.active = TRUE

          ORDER BY
            question.position,
            question.id
        `

      const reportRows =
        await sql`
          SELECT
            id,
            status,
            returned_by,
            returned_at,
            return_reason,

            COALESCE(
              financial_status,
              'pending'
            ) AS financial_status,

            rating,
            rating_comment

          FROM post_event_team_reports

          WHERE
            event_id =
              ${numericEventId}

            AND team_id =
              ${numericTeamId}

          LIMIT 1
        `

      return response.status(200).json({
        questions,

        report:
          reportRows[0] || {
            status:
              'pending',

            financial_status:
              'pending',

            rating:
              null,

            rating_comment:
              '',
          },
      })
    }


    // =====================================================
    // SALVAR RASCUNHO — RELATÓRIO + AVALIAÇÃO
    // =====================================================

    if (
      operation ===
      'save-team-report-draft'
    ) {
      if (!isTeamAdmin(admin)) {
        return forbidden(response)
      }

      const {
        teamId,
        answers = [],
        rating,
        ratingComment,
      } = request.body ?? {}

      const numericTeamId =
        Number(teamId)

      const numericRating =
        Number(rating)

      if (
        !Number.isInteger(
          numericTeamId
        )
      ) {
        return response.status(400).json({
          error:
            'Equipe inválida.',
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
        await getEvent(
          numericEventId
        )

      if (
        !event ||
        event.event_status !==
          'post_event'
      ) {
        return response.status(409).json({
          error:
            'O fechamento só pode ser preenchido durante o Pós-Evento.',
        })
      }

      const existingRows =
        await sql`
          SELECT
            id,
            status,
            responsible_user_id

          FROM post_event_team_reports

          WHERE
            event_id =
              ${numericEventId}

            AND team_id =
              ${numericTeamId}

          LIMIT 1
        `

      const existing =
        existingRows[0]

      if (
        event.project_id === null &&
        Number(
          existing
            ?.responsible_user_id
        ) !==
        Number(admin.id)
      ) {
        return response.status(403).json({
          error:
            'Você não é o responsável selecionado para esta equipe.',
        })
      }

      if (
        existing?.status ===
        'approved'
      ) {
        return response.status(409).json({
          error:
            'Este fechamento já foi aprovado e está bloqueado.',
        })
      }

      // ---------------------------------------------------
      // RESPOSTAS
      // ---------------------------------------------------

      if (Array.isArray(answers)) {
        for (
          const item of answers
        ) {
          const questionId =
            Number(
              item?.questionId
            )

          if (
            !Number.isInteger(
              questionId
            )
          ) {
            continue
          }

          const questionRows =
            await sql`
              SELECT id

              FROM post_event_questions

              WHERE
                id =
                  ${questionId}

                AND event_id =
                  ${numericEventId}

                AND active = TRUE

              LIMIT 1
            `

          if (!questionRows[0]) {
            continue
          }

          const cleanAnswer =
            typeof item?.answer ===
              'string'
              ? item.answer.trim()
              : ''

          await sql`
            INSERT INTO post_event_answers (
              event_id,
              team_id,
              question_id,
              answer_text,
              answered_by,
              created_at,
              updated_at
            )

            VALUES (
              ${numericEventId},
              ${numericTeamId},
              ${questionId},
              ${cleanAnswer},
              ${admin.id},
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )

            ON CONFLICT (
              question_id,
              team_id
            )

            DO UPDATE SET
              answer_text =
                EXCLUDED.answer_text,

              answered_by =
                EXCLUDED.answered_by,

              updated_at =
                CURRENT_TIMESTAMP
          `
        }
      }

      // ---------------------------------------------------
      // AVALIAÇÃO
      // ---------------------------------------------------

      const safeRating =
        Number.isInteger(
          numericRating
        ) &&
        numericRating >= 1 &&
        numericRating <= 5
          ? numericRating
          : null

      await sql`
        INSERT INTO post_event_team_reports (
          event_id,
          team_id,
          status,
          rating,
          rating_comment,
          updated_at
        )

        VALUES (
          ${numericEventId},
          ${numericTeamId},
          'pending',
          ${safeRating},
          ${ratingComment?.trim() || null},
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (
          event_id,
          team_id
        )

        DO UPDATE SET
          rating =
            EXCLUDED.rating,

          rating_comment =
            EXCLUDED.rating_comment,

          updated_at =
            CURRENT_TIMESTAMP
      `

      return response.status(200).json({
        success: true,
        message:
          'Rascunho salvo. ✨',
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

      // O relatório agora utiliza perguntas dinâmicas.
      // Os campos legados continuam preservados apenas
      // para compatibilidade histórica.

      const cleanSummary =
        typeof summary === 'string'
          ? summary.trim()
          : ''

      const existing = await sql`
        SELECT
          id,
          status,
          responsible_user_id,
          financial_status,
          rating

        FROM post_event_team_reports

        WHERE
          event_id = ${numericEventId}

          AND team_id =
            ${numericTeamId}

        LIMIT 1
      `

      // ===================================================
      // EVENTO GERAL
      // ===================================================
      // Pertencer à equipe não é suficiente.
      // Somente o Admin explicitamente escolhido para
      // aquela equipe + evento pode enviar o relatório.
      // ===================================================

      if (
        event.project_id === null
      ) {
        if (
          !existing[0]
        ) {
          return response.status(409).json({
            error:
              'Ainda não existe responsável definido para esta equipe no evento geral.',
          })
        }

        if (
          Number(
            existing[0]
              .responsible_user_id
          ) !== Number(admin.id)
        ) {
          return response.status(403).json({
            error:
              'Você não é o responsável selecionado para o Pós-Evento desta equipe.',
          })
        }
      }

      if (
        !existing[0] ||
        !existing[0].financial_status ||
        existing[0].financial_status ===
          'pending'
      ) {
        return response.status(409).json({
          error:
            'Conclua primeiro a situação financeira da equipe.',
        })
      }

      // ===================================================
      // ETAPA 2 — RELATÓRIO
      // ===================================================

      const requiredQuestionRows =
        await sql`
          SELECT
            question.id,
            question.question_text,

            COALESCE(
              answer.answer_text,
              ''
            ) AS answer_text

          FROM post_event_questions question

          LEFT JOIN post_event_answers answer
            ON answer.question_id =
              question.id

            AND answer.event_id =
              ${numericEventId}

            AND answer.team_id =
              ${numericTeamId}

          WHERE
            question.event_id =
              ${numericEventId}

            AND question.active = TRUE

            AND question.required = TRUE
        `

      const missingRequiredQuestions =
        requiredQuestionRows.filter(
          (question) =>
            !String(
              question.answer_text ||
              ''
            ).trim()
        )

      if (
        missingRequiredQuestions.length > 0
      ) {
        return response.status(409).json({
          error:
            'Responda todas as perguntas obrigatórias antes de enviar o fechamento.',

          missingQuestions:
            missingRequiredQuestions.map(
              (question) => ({
                id:
                  question.id,

                question:
                  question.question_text,
              })
            ),
        })
      }

      // ===================================================
      // ETAPA 3 — AVALIAÇÃO
      // ===================================================

      if (
        !Number.isInteger(
          Number(
            existing[0]?.rating
          )
        ) ||
        Number(
          existing[0]?.rating
        ) < 1 ||
        Number(
          existing[0]?.rating
        ) > 5
      ) {
        return response.status(409).json({
          error:
            'Faça a avaliação de 1 a 5 estrelas antes de enviar o fechamento.',
        })
      }


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

          returned_by = NULL,
          returned_at = NULL,
          return_reason = NULL,

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
          'Fechamento da equipe enviado! 🤝',
      })
    }

    if (operation === 'return-team-report') {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return forbidden(response)
      }

      const {
        reportId,
        reason,
      } = request.body ?? {}

      const numericReportId =
        Number(reportId)

      const cleanReason =
        typeof reason === 'string'
          ? reason.trim()
          : ''

      if (
        !Number.isInteger(
          numericReportId
        )
      ) {
        return response.status(400).json({
          error:
            'Fechamento inválido.',
        })
      }

      if (!cleanReason) {
        return response.status(400).json({
          error:
            'Informe o motivo da devolução.',
        })
      }

      if (cleanReason.length > 1000) {
        return response.status(400).json({
          error:
            'O motivo da devolução é muito longo.',
        })
      }

      const reportRows = await sql`
        SELECT
          report.id,
          report.event_id,
          report.status,
          event.project_id

        FROM post_event_team_reports report

        JOIN events event
          ON event.id =
            report.event_id

        WHERE
          report.id =
            ${numericReportId}

          AND report.event_id =
            ${numericEventId}

        LIMIT 1
      `

      const report =
        reportRows[0]

      if (!report) {
        return response.status(404).json({
          error:
            'Fechamento não encontrado.',
        })
      }

      if (
        isProjectAdmin(admin) &&
        !isGlobalAdmin(admin) &&
        report.project_id !== null &&
        Number(report.project_id) !==
          Number(admin.projectId)
      ) {
        return forbidden(response)
      }

      if (
        report.status !== 'submitted'
      ) {
        return response.status(409).json({
          error:
            'Somente fechamentos enviados podem ser devolvidos.',
        })
      }

      await sql`
        UPDATE post_event_team_reports

        SET
          status = 'pending',

          returned_by =
            ${admin.id},

          returned_at =
            CURRENT_TIMESTAMP,

          return_reason =
            ${cleanReason},

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id =
            ${numericReportId}
      `

      return response.status(200).json({
        success: true,

        message:
          'Fechamento devolvido para ajustes. ↩️',
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

          returned_by = NULL,
          returned_at = NULL,
          return_reason = NULL,

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
