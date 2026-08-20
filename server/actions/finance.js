import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql =
  neon(process.env.DATABASE_URL)


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

  const expensesAmount =
    Number(
      expenses
        .expenses_amount || 0
    )


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
      teamRows.map(
        (team) => ({
          ...team,

          amount:
            Number(
              team.amount || 0
            ),
        })
      ),

    closure:
      closureRows[0] ||
      null,
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
