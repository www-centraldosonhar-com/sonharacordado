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


  const {
    operation,
    eventId,
  } =
    request.method === 'GET'
      ? request.query ?? {}
      : request.body ?? {}


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
