import { neon } from '@neondatabase/serverless'

import {
  requireDreamerUser,
} from './_dreamer-access.js'

import {
  getOlympiadCampaign,
} from './_dreamer-frequency.js'

import {
  calculateEventEconomy,
} from './_dreamer-event-economy.js'

const sql = neon(
  process.env.DATABASE_URL
)

function money(value) {
  return Number(
    Number(value || 0).toFixed(2)
  )
}

export default async function dreamerEventEconomyHandler(
  request,
  response
) {
  try {
    if (request.method !== 'GET') {
      return response.status(405).json({
        error: 'Método não permitido.',
      })
    }

    const auth =
      await requireDreamerUser(
        request,
        response
      )

    if (!auth) return

    if (!auth.isDreamerAdmin) {
      return response.status(403).json({
        error:
          'Acesso restrito aos administradores do Sócio Sonhador.',
      })
    }

    const campaign =
      await getOlympiadCampaign()

    if (!campaign) {
      return response.status(404).json({
        error:
          'Campanha da Olimpíada não encontrada.',
      })
    }

    const economyMap =
      await calculateEventEconomy(
        sql,
        campaign.id
      )

    const rows = await sql`
      SELECT
        team.project_id,
        project.name AS project,
        team.volunteer_count,

        event.id AS event_id,
        event.name AS event_name,
        event.event_date,

        COALESCE(
          closure.expenses_closed,
          0
        ) AS expenses_closed,

        COALESCE((
          SELECT SUM(
            CASE
              WHEN registration.status = 'confirmed'
                AND registration.coupon_id IS NULL
              THEN event.registration_fee
              ELSE 0
            END
          )
          FROM event_registrations registration
          WHERE registration.event_id = event.id
        ), 0)::numeric(12,2)
          AS collected_amount,

        COALESCE((
          SELECT SUM(expense.amount)
          FROM team_expenses expense
          WHERE expense.event_id = event.id
            AND expense.active = 1
        ), 0)::numeric(12,2)
          AS expenses_amount

      FROM dreamer_campaign_teams team

      JOIN projects project
        ON project.id = team.project_id

      JOIN events event
        ON event.project_id =
          team.project_id

      LEFT JOIN post_event_closures closure
        ON closure.event_id = event.id

      WHERE
        team.campaign_id = ${campaign.id}
        AND team.active = 1

      ORDER BY
        team.project_id,
        event.event_date DESC,
        event.id DESC
    `

    const projects = Array.from(
      economyMap.values()
    ).map(project => {
      const projectEvents =
        rows
          .filter(
            row =>
              Number(row.project_id) ===
              project.projectId
          )
          .map(row => {
            const collectedAmount =
              money(row.collected_amount)

            const expensesAmount =
              money(row.expenses_amount)

            const balanceAmount =
              money(
                collectedAmount -
                  expensesAmount
              )

            const calculated =
              Number(
                row.expenses_closed || 0
              ) === 1

            const economyAmount =
              calculated
                ? Math.max(
                    0,
                    balanceAmount
                  )
                : 0

            const economyPoints =
              calculated &&
              project.volunteerCount > 0
                ? money(
                    economyAmount /
                      project.volunteerCount
                  )
                : 0

            return {
              eventId:
                Number(row.event_id),
              eventName:
                row.event_name,
              eventDate:
                row.event_date,
              calculated,
              collectedAmount,
              expensesAmount,
              balanceAmount,
              economyAmount:
                money(economyAmount),
              economyPoints,
            }
          })

      return {
        projectId:
          project.projectId,
        project:
          project.project,
        volunteerCount:
          project.volunteerCount,
        economyAmount:
          project.economyAmount,
        calculatedEvents:
          project.calculatedEvents,
        economyPoints:
          project.economyPoints,
        events:
          projectEvents,
      }
    })

    return response.status(200).json({
      campaign: {
        id: Number(campaign.id),
        name: campaign.name,
        slug: campaign.slug,
      },
      projects,
    })
  } catch (error) {
    console.error(
      'Dreamer event economy error:',
      error
    )

    return response.status(500).json({
      error:
        error?.message ||
        'Não foi possível carregar a Economia de Eventos.',
    })
  }
}
