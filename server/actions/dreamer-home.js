import process from 'node:process'
import { neon } from '@neondatabase/serverless'

import {
  requireDreamerUser,
} from './_dreamer-access.js'

import {
  calculateAttendanceFrequency,
} from './_dreamer-frequency.js'

const sql =
  neon(process.env.DATABASE_URL)

export default async function handler(
  request,
  response
) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error:
        'Método não permitido.',
    })
  }

  const currentUser =
    await requireDreamerUser(request)

  if (!currentUser) {
    return response.status(401).json({
      error:
        'Você não possui acesso ao Sócio Sonhador.',
    })
  }

  try {
    const campaigns = await sql`
      SELECT
        id,
        name,
        slug,
        campaign_type,
        description,
        starts_at,
        ends_at,
        status,
        allows_external_entries,
        allows_direct_contributions,
        uses_team_ranking
      FROM dreamer_campaigns
      WHERE
        slug =
          'olimpiada-sonhadora'
      LIMIT 1
    `

    const campaign =
      campaigns[0] || null

    if (!campaign) {
      return response.status(200).json({
        currentUser,
        campaign: null,
        teams: [],
        totals: {
          raised: 0,
        },
      })
    }

    const teamRows = await sql`
      SELECT
        dct.id AS campaign_team_id,
        dct.project_id,
        p.name AS project_name,
        dct.volunteer_count,

        COALESCE(
          (
            SELECT
              SUM(dc.amount)
            FROM dreamer_contributions dc
            WHERE
              dc.campaign_id =
                dct.campaign_id
              AND dc.project_id =
                dct.project_id
              AND dc.status =
                'confirmed'
          ),
          0
        ) AS direct_total,

        COALESCE(
          (
            SELECT
              SUM(dfe.net_amount)
            FROM dreamer_fundraising_entries dfe
            WHERE
              dfe.campaign_id =
                dct.campaign_id
              AND dfe.project_id =
                dct.project_id
              AND dfe.status =
                'validated'
          ),
          0
        ) AS external_total,

        COALESCE(
          (
            SELECT
              SUM(dmr.points)
            FROM dreamer_mission_results dmr
            JOIN dreamer_missions dm
              ON dm.id =
                dmr.mission_id
            WHERE
              dm.campaign_id =
                dct.campaign_id
              AND dmr.project_id =
                dct.project_id
          ),
          0
        ) AS mission_points,

        COALESCE(
          (
            SELECT
              SUM(dsa.points)
            FROM dreamer_score_adjustments dsa
            WHERE
              dsa.campaign_id =
                dct.campaign_id
              AND dsa.project_id =
                dct.project_id
          ),
          0
        ) AS adjustment_points

      FROM dreamer_campaign_teams dct

      JOIN projects p
        ON p.id =
          dct.project_id

      WHERE
        dct.campaign_id =
          ${campaign.id}
        AND dct.active = 1

      ORDER BY
        p.id
    `

    const teams =
      teamRows.map(
        team => {
          const directTotal =
            Number(
              team.direct_total || 0
            )

          const externalTotal =
            Number(
              team.external_total || 0
            )

          const volunteerCount =
            Number(
              team.volunteer_count || 0
            )

          const missionPoints =
            Number(
              team.mission_points || 0
            )

          const adjustmentPoints =
            Number(
              team.adjustment_points || 0
            )

          const netTotal =
            directTotal +
            externalTotal

          const fundraisingPoints =
            volunteerCount > 0
              ? netTotal /
                volunteerCount
              : 0

          const totalPoints =
            fundraisingPoints +
            missionPoints +
            adjustmentPoints

          return {
            campaignTeamId:
              team.campaign_team_id,

            projectId:
              team.project_id,

            project:
              team.project_name,

            volunteerCount,

            directTotal,
            externalTotal,
            netTotal,

            fundraisingPoints:
              Number(
                fundraisingPoints
                  .toFixed(2)
              ),

            missionPoints,
            adjustmentPoints,

            totalPoints:
              Number(
                totalPoints
                  .toFixed(2)
              ),
          }
        }
      )

    const frequency =
      await calculateAttendanceFrequency(
        campaign.id
      )

    const frequencyPointsByProject =
      new Map(
        frequency.ranking.map(
          team => [
            Number(team.projectId),
            Number(
              team.frequencyPoints || 0
            ),
          ]
        )
      )

    const ranking =
      teams
        .map(team => {
          const frequencyPoints =
            frequencyPointsByProject.get(
              Number(team.projectId)
            ) || 0

          return {
            ...team,
            frequencyPoints,
            totalPoints:
              Number(
                (
                  team.totalPoints +
                  frequencyPoints
                ).toFixed(2)
              ),
          }
        })
        .sort(
          (a, b) =>
            b.totalPoints -
            a.totalPoints
        )
        .map(
          (team, index) => ({
            ...team,
            position:
              index + 1,
          })
        )

    const totalRaised =
      ranking.reduce(
        (
          total,
          team
        ) =>
          total +
          team.netTotal,
        0
      )

    return response.status(200).json({
      currentUser: {
        id:
          currentUser.id,

        name:
          currentUser.name,

        fullName:
          currentUser.full_name,

        username:
          currentUser.username,

        projectId:
          currentUser.project_id,

        project:
          currentUser.project_name,

        dreamerProfile:
          currentUser.dreamerProfile,

        isDreamerAdmin:
          currentUser.isDreamerAdmin,

        canChooseDreamerTeam:
          !currentUser.permissions.includes(
            'volunteer'
          ),
      },

      campaign,

      teams:
        ranking,

      totals: {
        raised:
          Number(
            totalRaised.toFixed(2)
          ),
      },

      frequency,
    })
  } catch (error) {
    console.error(
      'Dreamer home error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível carregar o Sócio Sonhador.',
    })
  }
}
