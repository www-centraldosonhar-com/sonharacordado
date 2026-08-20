import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from './_session.js'

const sql =
  neon(process.env.DATABASE_URL)

const EXPENSE_BUCKET =
  process.env.REGISTRATION_RECEIPTS_BUCKET ||
  'sonhar-receipts'


function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase Storage não configurado.'
    )
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}


// =========================================================
// FINANCE ACCESS
// =========================================================

async function requireFinance(
  request
) {
  const session =
    await getSessionUser(request)

  if (!session?.userId) {
    return null
  }

  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.project_id,

      EXISTS (
        SELECT 1
        FROM user_permissions up
        WHERE
          up.user_id = u.id
          AND up.permission = 'finance'
          AND up.active = 1
      ) AS has_finance

    FROM users u

    WHERE
      u.id = ${session.userId}
      AND u.active = 1

    LIMIT 1
  `

  const user =
    rows[0]

  if (
    !user ||
    user.has_finance !== true
  ) {
    return null
  }

  return user
}


// =========================================================
// FINANCIAL SUMMARY
// =========================================================

async function getEventFinance(
  eventId
) {
  const eventRows = await sql`
    SELECT
      e.id,
      e.name,
      e.event_date,
      e.registration_fee,
      e.event_status,
      e.project_id,

      p.name AS project_name

    FROM events e

    LEFT JOIN projects p
      ON p.id = e.project_id

    WHERE
      e.id = ${eventId}

    LIMIT 1
  `

  const event =
    eventRows[0]

  if (!event) {
    return null
  }


  const registrationRows =
    await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE
            er.status = 'confirmed'
        )::int
          AS confirmed_count,

        COUNT(*) FILTER (
          WHERE
            er.status = 'confirmed'
            AND er.coupon_id IS NULL
        )::int
          AS paid_count,

        COUNT(*) FILTER (
          WHERE
            er.status = 'confirmed'
            AND er.coupon_id IS NOT NULL
        )::int
          AS free_count,

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

      WHERE
        er.event_id = ${eventId}
    `


  const expenseRows =
    await sql`
      SELECT
        COALESCE(
          SUM(te.amount)
            FILTER (
              WHERE te.active = 1
            ),
          0
        )::numeric(12,2)
          AS expenses_amount

      FROM team_expenses te

      WHERE
        te.event_id = ${eventId}
    `


  const teamRows =
    await sql`
      SELECT
        t.id,
        t.code,
        t.name,

        COALESCE(
          SUM(te.amount)
            FILTER (
              WHERE te.active = 1
            ),
          0
        )::numeric(12,2)
          AS amount

      FROM teams t

      JOIN team_expenses te
        ON te.team_id = t.id

      WHERE
        te.event_id = ${eventId}

      GROUP BY
        t.id,
        t.code,
        t.name

      ORDER BY
        t.name
    `


  const closureRows =
    await sql`
      SELECT
        status,

        expenses_closed,
        expenses_closed_by,
        expenses_closed_at,

        finance_validated,
        finance_validated_by,
        finance_validated_at

      FROM post_event_closures

      WHERE
        event_id = ${eventId}

      LIMIT 1
    `


  const registrations =
    registrationRows[0] || {}

  const expenses =
    expenseRows[0] || {}

  const collectedAmount =
    Number(
      registrations
        .collected_amount || 0
    )

  const closure =
    closureRows[0] ||
    null

  const expensesClosed =
    Number(
      closure?.expenses_closed || 0
    ) === 1

  const rawExpensesAmount =
    Number(
      expenses
        .expenses_amount || 0
    )

  const expensesAmount =
    expensesClosed
      ? rawExpensesAmount
      : 0


  return {
    event,

    registrations: {
      confirmed:
        Number(
          registrations
            .confirmed_count || 0
        ),

      paid:
        Number(
          registrations
            .paid_count || 0
        ),

      free:
        Number(
          registrations
            .free_count || 0
        ),
    },

    collectedAmount,

    expensesAmount,

    balanceAmount:
      collectedAmount -
      expensesAmount,

    expensesByTeam:
      expensesClosed
        ? teamRows.map(
            (team) => ({
              ...team,

              amount:
                Number(
                  team.amount || 0
                ),
            })
          )
        : [],

    expensesClosed,

    closure,
  }
}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  request,
  response
) {
  const user =
    await requireFinance(
      request
    )

  if (!user) {
    return response.status(403).json({
      error:
        'Acesso Financeiro não autorizado.',
    })
  }


  // =====================================================
  // REQUEST PARAMETERS
  // =====================================================
  //
  // GET normalmente envia os parâmetros pela query.
  // POST pode enviar a operação pela query e os dados
  // específicos pelo body.
  //
  // Aceitamos os dois formatos para manter a API
  // consistente e evitar operações perdidas.
  // =====================================================

  const query =
    request.query ?? {}

  const body =
    request.body ?? {}

  const operation =
    query.operation ??
    body.operation

  const eventId =
    query.eventId ??
    body.eventId

  const eventIds =
    query.eventIds ??
    body.eventIds


  try {
    // =====================================================
    // EVENTS
    // =====================================================

    if (
      operation === 'events'
    ) {
      const rows = await sql`
        SELECT
          e.id,
          e.name,
          e.event_date,
          e.event_status,
          e.project_id,

          p.name AS project_name

        FROM events e

        LEFT JOIN projects p
          ON p.id =
            e.project_id

        ORDER BY
          e.event_date DESC,
          e.id DESC
      `

      return response.status(200).json({
        events: rows,
      })
    }


    // =====================================================
    // SUMMARY
    // =====================================================

    if (
      operation === 'summary'
    ) {
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

      const summary =
        await getEventFinance(
          numericEventId
        )

      if (!summary) {
        return response.status(404).json({
          error:
            'Evento não encontrado.',
        })
      }

      return response.status(200).json(
        summary
      )
    }


    // =====================================================
    // FINANCE REQUESTS — LIST
    // =====================================================

    if (
      operation === 'requests'
    ) {
      const rows =
        await sql`
          SELECT
            fr.id,
            fr.project_id,
            fr.event_id,
            fr.subject,
            fr.message,
            fr.priority,
            fr.response_deadline,
            fr.status,
            fr.response_text,
            fr.responded_at,
            fr.resolved_at,
            fr.created_at,

            p.name AS project_name,

            e.name AS event_name,

            creator.name AS created_by_name,

            responder.name AS responded_by_name

          FROM finance_requests fr

          JOIN projects p
            ON p.id = fr.project_id

          LEFT JOIN events e
            ON e.id = fr.event_id

          JOIN users creator
            ON creator.id = fr.created_by

          LEFT JOIN users responder
            ON responder.id = fr.responded_by

          ORDER BY
            CASE
              WHEN fr.status = 'pending'
                AND fr.priority = 'urgent'
                THEN 0
              WHEN fr.status = 'pending'
                THEN 1
              WHEN fr.status = 'answered'
                THEN 2
              ELSE 3
            END,

            fr.created_at DESC
        `

      return response.status(200).json({
        requests: rows,
      })
    }


    // =====================================================
    // FINANCE REQUESTS — CREATE
    // =====================================================

    if (
      operation ===
      'create-request'
    ) {
      if (
        request.method !== 'POST'
      ) {
        return response.status(405).json({
          error:
            'Método não permitido.',
        })
      }

      const projectId =
        Number(
          request.body?.projectId
        )

      const rawEventId =
        request.body?.eventId

      const eventId =
        rawEventId
          ? Number(rawEventId)
          : null

      const subject =
        String(
          request.body?.subject || ''
        ).trim()

      const requestMessage =
        String(
          request.body?.message || ''
        ).trim()

      const priority =
        request.body?.priority ===
          'urgent'
          ? 'urgent'
          : 'normal'

      const responseDeadline =
        request.body
          ?.responseDeadline ||
        null


      if (
        !Number.isInteger(projectId)
      ) {
        return response.status(400).json({
          error:
            'Projeto inválido.',
        })
      }

      if (
        eventId !== null &&
        !Number.isInteger(eventId)
      ) {
        return response.status(400).json({
          error:
            'Evento inválido.',
        })
      }

      if (
        subject.length < 3
      ) {
        return response.status(400).json({
          error:
            'Informe um assunto.',
        })
      }

      if (
        requestMessage.length < 5
      ) {
        return response.status(400).json({
          error:
            'Descreva a solicitação.',
        })
      }


      // Se houver evento, ele precisa pertencer
      // ao projeto escolhido.
      if (eventId !== null) {
        const eventRows =
          await sql`
            SELECT id

            FROM events

            WHERE
              id = ${eventId}

              AND project_id =
                ${projectId}

            LIMIT 1
          `

        if (!eventRows[0]) {
          return response.status(400).json({
            error:
              'O evento não pertence ao projeto selecionado.',
          })
        }
      }


      const inserted =
        await sql`
          INSERT INTO finance_requests (
            project_id,
            event_id,
            created_by,
            subject,
            message,
            priority,
            response_deadline,
            status
          )

          VALUES (
            ${projectId},
            ${eventId},
            ${user.id},
            ${subject},
            ${requestMessage},
            ${priority},
            ${responseDeadline},
            'pending'
          )

          RETURNING id
        `

      return response.status(201).json({
        ok: true,

        requestId:
          inserted[0].id,

        message:
          priority === 'urgent'
            ? 'Solicitação urgente enviada ao Admin de Projeto.'
            : 'Solicitação enviada ao Admin de Projeto.',
      })
    }


    // =====================================================
    // FINANCE REQUESTS — RESOLVE
    // =====================================================

    if (
      operation ===
      'resolve-request'
    ) {
      if (
        request.method !== 'POST'
      ) {
        return response.status(405).json({
          error:
            'Método não permitido.',
        })
      }

      const requestId =
        Number(
          request.body?.requestId
        )

      if (
        !Number.isInteger(requestId)
      ) {
        return response.status(400).json({
          error:
            'Solicitação inválida.',
        })
      }

      const rows =
        await sql`
          SELECT
            id,
            status

          FROM finance_requests

          WHERE id =
            ${requestId}

          LIMIT 1
        `

      const financeRequest =
        rows[0]

      if (!financeRequest) {
        return response.status(404).json({
          error:
            'Solicitação não encontrada.',
        })
      }

      if (
        financeRequest.status !==
        'answered'
      ) {
        return response.status(409).json({
          error:
            'A solicitação precisa ser respondida antes de ser resolvida.',
        })
      }

      await sql`
        UPDATE finance_requests

        SET
          status = 'resolved',
          resolved_by =
            ${user.id},
          resolved_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id =
          ${requestId}
      `

      return response.status(200).json({
        ok: true,

        message:
          'Solicitação marcada como resolvida.',
      })
    }


    // =====================================================
    // CONSOLIDATED BALANCE
    // =====================================================
    //
    // Consolida vários eventos usando exatamente
    // a mesma regra financeira da visão individual:
    //
    // - receita = inscrições confirmadas pagantes;
    // - gratuidade não gera receita;
    // - gasto só entra após expenses_closed = 1.
    // =====================================================

    if (
      operation === 'balance'
    ) {
      const rawEventIds =
        Array.isArray(eventIds)
          ? eventIds
          : typeof eventIds === 'string'
            ? eventIds.split(',')
            : []

      const normalizedEventIds =
        [
          ...new Set(
            rawEventIds
              .map(
                (id) =>
                  Number(id)
              )
              .filter(
                (id) =>
                  Number.isInteger(id) &&
                  id > 0
              )
          ),
        ]

      if (
        normalizedEventIds.length === 0
      ) {
        return response.status(400).json({
          error:
            'Selecione pelo menos um evento.',
        })
      }

      const eventSummaries = []

      for (
        const selectedEventId
        of normalizedEventIds
      ) {
        const eventSummary =
          await getEventFinance(
            selectedEventId
          )

        if (eventSummary) {
          eventSummaries.push(
            eventSummary
          )
        }
      }

      if (
        eventSummaries.length === 0
      ) {
        return response.status(404).json({
          error:
            'Nenhum evento válido foi encontrado.',
        })
      }

      const totals =
        eventSummaries.reduce(
          (accumulator, item) => {
            accumulator.confirmed +=
              Number(
                item.registrations
                  ?.confirmed || 0
              )

            accumulator.paid +=
              Number(
                item.registrations
                  ?.paid || 0
              )

            accumulator.free +=
              Number(
                item.registrations
                  ?.free || 0
              )

            accumulator.collected +=
              Number(
                item.collectedAmount || 0
              )

            accumulator.expenses +=
              Number(
                item.expensesAmount || 0
              )

            return accumulator
          },
          {
            confirmed: 0,
            paid: 0,
            free: 0,
            collected: 0,
            expenses: 0,
          }
        )

      return response.status(200).json({
        eventCount:
          eventSummaries.length,

        registrations: {
          confirmed:
            totals.confirmed,

          paid:
            totals.paid,

          free:
            totals.free,
        },

        collectedAmount:
          totals.collected,

        expensesAmount:
          totals.expenses,

        balanceAmount:
          totals.collected -
          totals.expenses,

        events:
          eventSummaries.map(
            (item) => ({
              id:
                item.event.id,

              name:
                item.event.name,

              eventDate:
                item.event.event_date,

              projectId:
                item.event.project_id,

              projectName:
                item.event.project_name,

              confirmed:
                item.registrations
                  .confirmed,

              paid:
                item.registrations
                  .paid,

              free:
                item.registrations
                  .free,

              collectedAmount:
                item.collectedAmount,

              expensesAmount:
                item.expensesAmount,

              balanceAmount:
                item.balanceAmount,

              expensesClosed:
                item.expensesClosed,
            })
          ),
      })
    }


    // =====================================================
    // CLOSED EXPENSES
    // =====================================================

    if (
      operation === 'expenses'
    ) {
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

      const closureRows =
        await sql`
          SELECT
            expenses_closed,
            expenses_closed_at
          FROM post_event_closures
          WHERE event_id =
            ${numericEventId}
          LIMIT 1
        `

      const closure =
        closureRows[0]

      if (
        Number(
          closure?.expenses_closed || 0
        ) !== 1
      ) {
        return response.status(409).json({
          error:
            'Os gastos deste evento ainda não foram enviados oficialmente ao Financeiro.',
        })
      }

      const rows = await sql`
        SELECT
          te.id,
          te.event_id,
          te.team_id,
          te.description,
          te.amount,
          te.created_at,

          t.code AS team_code,
          t.name AS team_name,

          u.id AS created_by,
          u.name AS created_by_name

        FROM team_expenses te

        JOIN teams t
          ON t.id =
            te.team_id

        JOIN users u
          ON u.id =
            te.created_by

        WHERE
          te.event_id =
            ${numericEventId}

          AND te.active = 1

        ORDER BY
          t.name,
          te.created_at DESC
      `

      return response.status(200).json({
        expenses:
          rows.map(
            (expense) => ({
              ...expense,

              amount:
                Number(
                  expense.amount || 0
                ),
            })
          ),

        closedAt:
          closure.expenses_closed_at,
      })
    }


    // =====================================================
    // EXPENSE RECEIPT
    // =====================================================

    if (
      operation ===
      'expense-receipt'
    ) {
      const expenseId =
        Number(
          request.method === 'GET'
            ? request.query?.expenseId
            : request.body?.expenseId
        )

      if (
        !Number.isInteger(
          expenseId
        )
      ) {
        return response.status(400).json({
          error:
            'Gasto inválido.',
        })
      }

      const rows = await sql`
        SELECT
          te.id,
          te.receipt_path,
          te.active,

          pec.expenses_closed

        FROM team_expenses te

        JOIN post_event_closures pec
          ON pec.event_id =
            te.event_id

        WHERE
          te.id =
            ${expenseId}

        LIMIT 1
      `

      const expense =
        rows[0]

      if (
        !expense ||
        Number(expense.active) !== 1 ||
        Number(
          expense.expenses_closed || 0
        ) !== 1
      ) {
        return response.status(403).json({
          error:
            'Comprovante não disponível.',
        })
      }

      if (
        !expense.receipt_path
      ) {
        return response.status(404).json({
          error:
            'Comprovante não encontrado.',
        })
      }

      const supabase =
        getSupabaseAdmin()

      const {
        data,
        error,
      } =
        await supabase.storage
          .from(EXPENSE_BUCKET)
          .createSignedUrl(
            expense.receipt_path,
            60 * 5
          )

      if (error) {
        throw error
      }

      return response.status(200).json({
        url:
          data.signedUrl,
      })
    }


    return response.status(400).json({
      error:
        'Operação financeira desconhecida.',
    })

  } catch (error) {
    console.error(
      'Finance error:',
      error
    )

    return response.status(500).json({
      error:
        error?.message ||
        'Não foi possível carregar o Financeiro.',
    })
  }
}
