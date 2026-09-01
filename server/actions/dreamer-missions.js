import process from 'node:process'

import { neon } from '@neondatabase/serverless'

import {
  requireDreamerUser,
} from './_dreamer-access.js'

const sql = neon(process.env.DATABASE_URL)
const OLYMPIAD_SLUG = 'olimpiada-sonhadora'

function cleanText(value, maxLength = 4000) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function cleanPoints(value, { allowNull = false } = {}) {
  if (
    allowNull &&
    (value === null || value === undefined || value === '')
  ) {
    return null
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return NaN
  }

  return Math.round((number + Number.EPSILON) * 100) / 100
}

function cleanDateTime(value) {
  const text = cleanText(value, 80)
  return text || null
}

async function getCampaign() {
  const rows = await sql`
    SELECT id, name, slug, status
    FROM dreamer_campaigns
    WHERE slug = ${OLYMPIAD_SLUG}
    LIMIT 1
  `

  return rows[0] || null
}

async function getTeams(campaignId) {
  return sql`
    SELECT
      team.project_id,
      project.name AS project
    FROM dreamer_campaign_teams team
    JOIN projects project
      ON project.id = team.project_id
    WHERE
      team.campaign_id = ${campaignId}
      AND team.active = 1
    ORDER BY project.id
  `
}

async function getMissions(campaignId, includeInactive = false) {
  const rows = includeInactive
    ? await sql`
        SELECT
          mission.id,
          mission.title,
          mission.description,
          mission.rules_text,
          mission.mission_type,
          mission.max_points,
          mission.starts_at,
          mission.ends_at,
          mission.active,
          mission.created_by,
          mission.created_at
        FROM dreamer_missions mission
        WHERE mission.campaign_id = ${campaignId}
        ORDER BY mission.created_at DESC, mission.id DESC
      `
    : await sql`
        SELECT
          mission.id,
          mission.title,
          mission.description,
          mission.rules_text,
          mission.mission_type,
          mission.max_points,
          mission.starts_at,
          mission.ends_at,
          mission.active,
          mission.created_by,
          mission.created_at
        FROM dreamer_missions mission
        WHERE
          mission.campaign_id = ${campaignId}
          AND mission.active = 1
        ORDER BY
          CASE
            WHEN mission.ends_at IS NULL THEN 0
            WHEN mission.ends_at >= CURRENT_TIMESTAMP THEN 0
            ELSE 1
          END,
          COALESCE(mission.starts_at, mission.created_at),
          mission.id
      `

  if (!rows.length) return []

  const missionIds = rows.map(row => row.id)

  const results = await sql`
    SELECT
      result.id,
      result.mission_id,
      result.project_id,
      project.name AS project,
      result.points,
      result.source_reference,
      result.created_at
    FROM dreamer_mission_results result
    JOIN projects project
      ON project.id = result.project_id
    WHERE
      result.mission_id = ANY(${missionIds})
      AND result.user_id IS NULL
    ORDER BY result.project_id
  `

  const resultsByMission = new Map()

  for (const result of results) {
    const key = Number(result.mission_id)
    const current = resultsByMission.get(key) || []
    current.push(result)
    resultsByMission.set(key, current)
  }

  return rows.map(mission => ({
    ...mission,
    max_points:
      mission.max_points === null
        ? null
        : Number(mission.max_points),
    results:
      resultsByMission.get(Number(mission.id)) || [],
  }))
}

async function requireAdmin(currentUser, response) {
  if (!currentUser.isDreamerAdmin) {
    response.status(403).json({
      error: 'Apenas Admins do Sócio podem gerenciar missões.',
    })
    return false
  }

  return true
}

export default async function handler(request, response) {
  const currentUser = await requireDreamerUser(request)

  if (!currentUser) {
    return response.status(401).json({
      error: 'Você não possui acesso ao Sócio Sonhador.',
    })
  }

  try {
    const campaign = await getCampaign()

    if (!campaign) {
      return response.status(404).json({
        error: 'Campanha Olimpíada Sonhadora não encontrada.',
      })
    }

    const teams = await getTeams(campaign.id)

    if (request.method === 'GET') {
      const scope = String(request.query?.scope || 'public')

      if (scope === 'admin') {
        if (!(await requireAdmin(currentUser, response))) return

        const missions = await getMissions(campaign.id, true)

        return response.status(200).json({
          campaign,
          teams,
          missions,
        })
      }

      const missions = await getMissions(campaign.id, false)

      return response.status(200).json({
        campaign,
        teams,
        missions,
      })
    }

    if (request.method !== 'POST') {
      return response.status(405).json({
        error: 'Método não permitido.',
      })
    }

    if (!(await requireAdmin(currentUser, response))) return

    if (campaign.status === 'closed') {
      return response.status(409).json({
        error:
          'A Olimpíada já foi fechada. Missões e pontuações não podem mais ser alteradas.',
      })
    }

    const operation = cleanText(request.body?.operation, 80)

    if (operation === 'create') {
      const title = cleanText(request.body?.title, 160)
      const description = cleanText(request.body?.description, 3000)
      const rulesText = cleanText(request.body?.rulesText, 5000)
      const missionType = cleanText(request.body?.missionType || 'special', 80)
      const maxPoints = cleanPoints(request.body?.maxPoints, {
        allowNull: true,
      })
      const startsAt = cleanDateTime(request.body?.startsAt)
      const endsAt = cleanDateTime(request.body?.endsAt)
      const active = request.body?.active === false ? 0 : 1

      if (!title) {
        return response.status(400).json({
          error: 'Informe o nome da missão.',
        })
      }

      if (Number.isNaN(maxPoints) || (maxPoints !== null && maxPoints < 0)) {
        return response.status(400).json({
          error: 'A pontuação máxima da missão é inválida.',
        })
      }

      if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
        return response.status(400).json({
          error: 'O término da missão não pode ser anterior ao início.',
        })
      }

      const rows = await sql`
        INSERT INTO dreamer_missions (
          campaign_id,
          title,
          description,
          rules_text,
          mission_type,
          max_points,
          starts_at,
          ends_at,
          active,
          created_by
        ) VALUES (
          ${campaign.id},
          ${title},
          ${description},
          ${rulesText},
          ${missionType},
          ${maxPoints},
          ${startsAt},
          ${endsAt},
          ${active},
          ${currentUser.id}
        )
        RETURNING id
      `

      return response.status(201).json({
        ok: true,
        missionId: rows[0]?.id,
        message: 'Missão criada com sucesso.',
      })
    }

    if (operation === 'update') {
      const missionId = Number(request.body?.missionId)
      const title = cleanText(request.body?.title, 160)
      const description = cleanText(request.body?.description, 3000)
      const rulesText = cleanText(request.body?.rulesText, 5000)
      const missionType = cleanText(request.body?.missionType || 'special', 80)
      const maxPoints = cleanPoints(request.body?.maxPoints, {
        allowNull: true,
      })
      const startsAt = cleanDateTime(request.body?.startsAt)
      const endsAt = cleanDateTime(request.body?.endsAt)
      const active = request.body?.active === false ? 0 : 1

      if (!Number.isInteger(missionId) || missionId <= 0 || !title) {
        return response.status(400).json({
          error: 'Missão inválida.',
        })
      }

      if (Number.isNaN(maxPoints) || (maxPoints !== null && maxPoints < 0)) {
        return response.status(400).json({
          error: 'A pontuação máxima da missão é inválida.',
        })
      }

      if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
        return response.status(400).json({
          error: 'O término da missão não pode ser anterior ao início.',
        })
      }

      const updated = await sql`
        UPDATE dreamer_missions
        SET
          title = ${title},
          description = ${description},
          rules_text = ${rulesText},
          mission_type = ${missionType},
          max_points = ${maxPoints},
          starts_at = ${startsAt},
          ends_at = ${endsAt},
          active = ${active}
        WHERE
          id = ${missionId}
          AND campaign_id = ${campaign.id}
        RETURNING id
      `

      if (!updated.length) {
        return response.status(404).json({
          error: 'Missão não encontrada.',
        })
      }

      return response.status(200).json({
        ok: true,
        message: 'Missão atualizada.',
      })
    }

    if (operation === 'score') {
      const missionId = Number(request.body?.missionId)
      const projectId = Number(request.body?.projectId)
      const points = cleanPoints(request.body?.points)
      const sourceReference = cleanText(
        request.body?.sourceReference,
        2000
      )

      if (
        !Number.isInteger(missionId) || missionId <= 0 ||
        !Number.isInteger(projectId) || projectId <= 0 ||
        Number.isNaN(points) || points < 0
      ) {
        return response.status(400).json({
          error: 'Pontuação inválida.',
        })
      }

      const missionRows = await sql`
        SELECT id, max_points
        FROM dreamer_missions
        WHERE
          id = ${missionId}
          AND campaign_id = ${campaign.id}
        LIMIT 1
      `

      const mission = missionRows[0]

      if (!mission) {
        return response.status(404).json({
          error: 'Missão não encontrada.',
        })
      }

      const teamExists = teams.some(
        team => Number(team.project_id) === projectId
      )

      if (!teamExists) {
        return response.status(400).json({
          error: 'Equipe inválida para esta campanha.',
        })
      }

      const maxPoints =
        mission.max_points === null
          ? null
          : Number(mission.max_points)

      if (maxPoints !== null && points > maxPoints) {
        return response.status(400).json({
          error: `A pontuação não pode ultrapassar ${maxPoints} pontos.`,
        })
      }

      await sql`
        INSERT INTO dreamer_mission_results (
          mission_id,
          project_id,
          user_id,
          points,
          source_reference
        ) VALUES (
          ${missionId},
          ${projectId},
          NULL,
          ${points},
          ${sourceReference}
        )
        ON CONFLICT (mission_id, project_id)
        WHERE user_id IS NULL
        DO UPDATE SET
          points = EXCLUDED.points,
          source_reference = EXCLUDED.source_reference,
          created_at = CURRENT_TIMESTAMP
      `

      return response.status(200).json({
        ok: true,
        message: 'Pontuação da missão salva.',
      })
    }

    return response.status(400).json({
      error: 'Operação de missão não reconhecida.',
    })
  } catch (error) {
    console.error('Dreamer missions error:', error)

    return response.status(500).json({
      error: 'Não foi possível processar as missões agora.',
    })
  }
}
