import process from 'node:process'
import { neon } from '@neondatabase/serverless'

import { requireDreamerUser } from './_dreamer-access.js'
import { calculateAttendanceFrequency } from './_dreamer-frequency.js'
import { referralPointsByProject } from './dreamer-referrals.js'

const sql = neon(process.env.DATABASE_URL)
const OLYMPIAD_SLUG = 'olimpiada-sonhadora'

function number(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100
}

function cleanText(value, max = 4000) {
  return String(value || '').trim().slice(0, max)
}

async function getCampaign() {
  const rows = await sql`
    SELECT id, name, slug, status, starts_at, ends_at
    FROM dreamer_campaigns
    WHERE slug = ${OLYMPIAD_SLUG}
    LIMIT 1
  `
  return rows[0] || null
}

async function getClosure(campaignId) {
  const rows = await sql`
    SELECT
      closure.*,
      COALESCE(NULLIF(closed_user.full_name, ''), closed_user.name, closed_user.username) AS closed_by_name,
      COALESCE(NULLIF(finance_user.full_name, ''), finance_user.name, finance_user.username) AS sent_to_finance_by_name,
      COALESCE(NULLIF(received_user.full_name, ''), received_user.name, received_user.username) AS finance_received_by_name
    FROM dreamer_campaign_closures closure
    LEFT JOIN users closed_user ON closed_user.id = closure.closed_by
    LEFT JOIN users finance_user ON finance_user.id = closure.sent_to_finance_by
    LEFT JOIN users received_user ON received_user.id = closure.finance_received_by
    WHERE closure.campaign_id = ${campaignId}
    LIMIT 1
  `
  return rows[0] || null
}

async function buildSummary(campaign) {
  const referralPointsMap = await referralPointsByProject(campaign.id)
  const frequency = await calculateAttendanceFrequency(campaign.id)
  const frequencyPointsMap = new Map(
    frequency.ranking.map(team => [
      Number(team.projectId),
      number(team.frequencyPoints),
    ])
  )

  const teamRows = await sql`
    SELECT
      team.project_id,
      project.name AS project,
      team.volunteer_count,
      COALESCE((
        SELECT SUM(entry.gross_amount)
        FROM dreamer_fundraising_entries entry
        WHERE entry.campaign_id = team.campaign_id
          AND entry.project_id = team.project_id
          AND entry.status = 'validated'
      ), 0) AS external_gross,
      COALESCE((
        SELECT SUM(entry.cost_amount)
        FROM dreamer_fundraising_entries entry
        WHERE entry.campaign_id = team.campaign_id
          AND entry.project_id = team.project_id
          AND entry.status = 'validated'
      ), 0) AS external_cost,
      COALESCE((
        SELECT SUM(entry.net_amount)
        FROM dreamer_fundraising_entries entry
        WHERE entry.campaign_id = team.campaign_id
          AND entry.project_id = team.project_id
          AND entry.status = 'validated'
      ), 0) AS external_net,
      COALESCE((
        SELECT SUM(contribution.amount)
        FROM dreamer_contributions contribution
        WHERE contribution.campaign_id = team.campaign_id
          AND contribution.project_id = team.project_id
          AND contribution.status = 'confirmed'
      ), 0) AS direct_total,
      COALESCE((
        SELECT SUM(result.points)
        FROM dreamer_mission_results result
        JOIN dreamer_missions mission ON mission.id = result.mission_id
        WHERE mission.campaign_id = team.campaign_id
          AND result.project_id = team.project_id
          AND result.user_id IS NULL
      ), 0) AS mission_points,
      COALESCE((
        SELECT SUM(adjustment.points)
        FROM dreamer_score_adjustments adjustment
        WHERE adjustment.campaign_id = team.campaign_id
          AND adjustment.project_id = team.project_id
      ), 0) AS adjustment_points
    FROM dreamer_campaign_teams team
    JOIN projects project ON project.id = team.project_id
    WHERE team.campaign_id = ${campaign.id}
      AND team.active = 1
    ORDER BY project.id
  `

  const teams = teamRows.map(row => {
    const volunteerCount = number(row.volunteer_count)
    const externalGross = number(row.external_gross)
    const externalCost = number(row.external_cost)
    const externalNet = number(row.external_net)
    const directTotal = number(row.direct_total)
    const netTotal = externalNet + directTotal
    const fundraisingPoints = volunteerCount > 0
      ? netTotal / volunteerCount
      : 0
    const missionPoints = number(row.mission_points)
    const referralPoints = number(
      referralPointsMap.get(Number(row.project_id))
    )
    const frequencyPoints = number(
      frequencyPointsMap.get(Number(row.project_id))
    )
    const adjustmentPoints = number(row.adjustment_points)

    return {
      projectId: Number(row.project_id),
      project: row.project,
      volunteerCount,
      externalGross: round(externalGross),
      externalCost: round(externalCost),
      externalNet: round(externalNet),
      directTotal: round(directTotal),
      grossTotal: round(externalGross + directTotal),
      costTotal: round(externalCost),
      netTotal: round(netTotal),
      fundraisingPoints: round(fundraisingPoints),
      missionPoints: round(missionPoints),
      referralPoints: round(referralPoints),
      frequencyPoints: round(frequencyPoints),
      adjustmentPoints: round(adjustmentPoints),
      totalPoints: round(
        fundraisingPoints +
        missionPoints +
        referralPoints +
        frequencyPoints +
        adjustmentPoints
      ),
    }
  })

  const ranking = [...teams]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((team, index) => ({ ...team, position: index + 1 }))

  const fundraisingPendingRows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'correction_requested')::int AS correction_requested,
      COUNT(*) FILTER (
        WHERE status IN ('pending', 'correction_requested')
          AND possible_duplicate = 1
      )::int AS duplicates
    FROM dreamer_fundraising_entries
    WHERE campaign_id = ${campaign.id}
  `

  const contributionRows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (
        WHERE status = 'pending_payment_review'
      )::int AS pending_payment_review,
      COUNT(*) FILTER (
        WHERE status = 'correction_requested'
      )::int AS correction_requested,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed
    FROM dreamer_contributions
    WHERE campaign_id = ${campaign.id}
      AND source_type = 'app'
  `

  const missionRows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE active = 1)::int AS active,
      COUNT(*)::int AS total
    FROM dreamer_missions
    WHERE campaign_id = ${campaign.id}
  `

  const fundraisingPending = fundraisingPendingRows[0] || {}
  const contributions = contributionRows[0] || {}
  const missions = missionRows[0] || {}

  const blockers = []
  const warnings = []

  if (number(fundraisingPending.pending) > 0) {
    blockers.push(`${fundraisingPending.pending} arrecadação(ões) aguardando validação.`)
  }
  if (number(fundraisingPending.correction_requested) > 0) {
    blockers.push(`${fundraisingPending.correction_requested} arrecadação(ões) aguardando correção.`)
  }
  if (number(fundraisingPending.duplicates) > 0) {
    blockers.push(`${fundraisingPending.duplicates} possível(is) duplicidade(s) ainda sem resolução.`)
  }

  if (number(contributions.pending_payment_review) > 0) {
    blockers.push(`${contributions.pending_payment_review} doação(ões) PIX aguardando revisão de comprovante.`)
  }
  if (number(contributions.correction_requested) > 0) {
    blockers.push(`${contributions.correction_requested} doação(ões) PIX aguardando correção de comprovante.`)
  }
  if (number(contributions.pending) > 0) {
    warnings.push(`${contributions.pending} intenção(ões) de doação ainda aguardam comprovante; não entram no fechamento.`)
  }
  if (frequency.eventCount === 0) {
    warnings.push('Nenhum evento de frequência foi calculado até o momento.')
  }
  if (number(missions.active) > 0) {
    warnings.push(`${missions.active} missão(ões) ainda estão ativas. Confira se os resultados finais já foram lançados.`)
  }
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() > Date.now()) {
    warnings.push('A data prevista de término da campanha ainda não chegou.')
  }

  const totals = ranking.reduce(
    (acc, team) => ({
      gross: round(acc.gross + team.grossTotal),
      costs: round(acc.costs + team.costTotal),
      net: round(acc.net + team.netTotal),
    }),
    { gross: 0, costs: 0, net: 0 }
  )

  return {
    generatedAt: new Date().toISOString(),
    campaign: {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      status: campaign.status,
      startsAt: campaign.starts_at,
      endsAt: campaign.ends_at,
    },
    totals,
    ranking,
    frequency: {
      eventCount: frequency.eventCount,
      ranking: frequency.ranking,
    },
    pending: {
      fundraising: number(fundraisingPending.pending),
      corrections: number(fundraisingPending.correction_requested),
      duplicates: number(fundraisingPending.duplicates),
      directContributions: number(contributions.pending),
      directContributionReviews: number(contributions.pending_payment_review),
      directContributionCorrections: number(contributions.correction_requested),
    },
    blockers,
    warnings,
    canClose: blockers.length === 0,
  }
}

function normalizeClosure(row) {
  if (!row) return null
  return {
    ...row,
    gross_total: number(row.gross_total),
    cost_total: number(row.cost_total),
    net_total: number(row.net_total),
  }
}

export default async function handler(request, response) {
  const currentUser = await requireDreamerUser(request)
  if (!currentUser) {
    return response.status(401).json({ error: 'Não autorizado.' })
  }
  if (!currentUser.isDreamerAdmin) {
    return response.status(403).json({
      error: 'Apenas Admins do Sócio podem fechar campanhas.',
    })
  }

  try {
    const campaign = await getCampaign()
    if (!campaign) {
      return response.status(404).json({ error: 'Olimpíada Sonhadora não encontrada.' })
    }

    if (request.method === 'GET') {
      const closure = normalizeClosure(await getClosure(campaign.id))
      const summary = ['closed', 'sent_to_finance', 'finance_received'].includes(closure?.status)
        ? closure.snapshot_data
        : await buildSummary(campaign)

      return response.status(200).json({ campaign, closure, summary })
    }

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Método não permitido.' })
    }

    const operation = cleanText(request.body?.operation, 80)

    if (operation === 'close') {
      const existing = await getClosure(campaign.id)
      if (existing && ['closed', 'sent_to_finance', 'finance_received'].includes(existing.status)) {
        return response.status(409).json({ error: 'Esta campanha já foi fechada.' })
      }

      const summary = await buildSummary(campaign)
      if (!summary.canClose) {
        return response.status(409).json({
          error: 'Existem pendências obrigatórias antes do fechamento.',
          blockers: summary.blockers,
        })
      }

      const confirmation = cleanText(request.body?.confirmation, 200)
      if (confirmation !== campaign.name) {
        return response.status(400).json({
          error: `Digite exatamente “${campaign.name}” para confirmar o fechamento.`,
        })
      }

      const notes = cleanText(request.body?.notes, 4000)
      const snapshotJson = JSON.stringify(summary)

      const rows = await sql`
        WITH saved AS (
          INSERT INTO dreamer_campaign_closures (
            campaign_id,
            closed_by,
            status,
            gross_total,
            cost_total,
            net_total,
            snapshot_data,
            closure_notes,
            closed_at,
            updated_at
          ) VALUES (
            ${campaign.id},
            ${currentUser.id},
            'closed',
            ${summary.totals.gross},
            ${summary.totals.costs},
            ${summary.totals.net},
            ${snapshotJson}::jsonb,
            ${notes},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (campaign_id)
          DO UPDATE SET
            closed_by = EXCLUDED.closed_by,
            status = 'closed',
            gross_total = EXCLUDED.gross_total,
            cost_total = EXCLUDED.cost_total,
            net_total = EXCLUDED.net_total,
            snapshot_data = EXCLUDED.snapshot_data,
            closure_notes = EXCLUDED.closure_notes,
            closed_at = CURRENT_TIMESTAMP,
            sent_to_finance_at = NULL,
            sent_to_finance_by = NULL,
            finance_notes = '',
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        )
        UPDATE dreamer_campaigns
        SET status = 'closed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${campaign.id}
        RETURNING id
      `

      if (!rows[0]) {
        throw new Error('Não foi possível congelar a campanha.')
      }

      return response.status(200).json({
        success: true,
        message: 'Olimpíada fechada. O placar oficial foi congelado.',
        closure: normalizeClosure(await getClosure(campaign.id)),
      })
    }

    if (operation === 'send_to_finance') {
      const closure = await getClosure(campaign.id)
      if (!closure || closure.status !== 'closed') {
        return response.status(409).json({
          error: 'Feche a campanha antes de encaminhar ao Financeiro.',
        })
      }

      const financeNotes = cleanText(request.body?.financeNotes, 4000)
      await sql`
        UPDATE dreamer_campaign_closures
        SET status = 'sent_to_finance',
            sent_to_finance_at = CURRENT_TIMESTAMP,
            sent_to_finance_by = ${currentUser.id},
            finance_notes = ${financeNotes},
            updated_at = CURRENT_TIMESTAMP
        WHERE campaign_id = ${campaign.id}
          AND status = 'closed'
      `

      return response.status(200).json({
        success: true,
        message: 'Fechamento marcado como encaminhado ao Financeiro.',
        closure: normalizeClosure(await getClosure(campaign.id)),
      })
    }

    return response.status(400).json({ error: 'Operação de fechamento inválida.' })
  } catch (error) {
    console.error('Dreamer closure error:', error)
    return response.status(500).json({
      error: error.message || 'Não foi possível processar o fechamento.',
    })
  }
}
