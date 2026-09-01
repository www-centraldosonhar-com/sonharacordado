import crypto from 'node:crypto'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { requireDreamerUser } from './_dreamer-access.js'

const sql = neon(process.env.DATABASE_URL)
const OLYMPIAD_SLUG = 'olimpiada-sonhadora'

function tierPoints(count) {
  if (count >= 45) return 10
  if (count >= 20) return 5
  if (count >= 5) return 1
  return 0
}

function nextTier(count) {
  if (count < 5) return { target: 5, points: 1 }
  if (count < 20) return { target: 20, points: 5 }
  if (count < 45) return { target: 45, points: 10 }
  return null
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

async function syncQualifications(campaignId) {
  const referrals = await sql`
    SELECT dr.id, dr.project_id, dr.referred_user_id, dr.created_at
    FROM dreamer_referrals dr
    JOIN users referred_user
      ON referred_user.id = dr.referred_user_id
    WHERE dr.campaign_id = ${campaignId}
      AND dr.status = 'registered'
      -- A indicação existe para trazer pessoas novas ao Sócio.
      -- Quem já pertence à Central como voluntário contínuo
      -- nunca pode qualificar nem gerar pontuação.
      AND referred_user.active = 1
      AND referred_user.user_type = 'external'
    ORDER BY dr.created_at ASC, dr.id ASC
  `

  for (const referral of referrals) {
    const contributions = await sql`
      SELECT dc.id
      FROM dreamer_contributions dc
      WHERE dc.campaign_id = ${campaignId}
        AND dc.project_id = ${referral.project_id}
        AND dc.contributor_user_id = ${referral.referred_user_id}
        AND dc.status = 'confirmed'
        AND dc.amount > 3
        AND dc.created_at >= ${referral.created_at}
        AND NOT EXISTS (
          SELECT 1
          FROM dreamer_referrals used
          WHERE used.qualifying_contribution_id = dc.id
        )
      ORDER BY COALESCE(dc.confirmed_at, dc.created_at), dc.id
      LIMIT 1
    `

    if (contributions[0]) {
      await sql`
        UPDATE dreamer_referrals
        SET status = 'qualified',
            qualifying_contribution_id = ${contributions[0].id},
            qualified_at = CURRENT_TIMESTAMP
        WHERE id = ${referral.id}
          AND status = 'registered'
      `
    }
  }
}

export async function referralPointsByProject(campaignId) {
  await syncQualifications(campaignId)
  const rows = await sql`
    SELECT dr.project_id, dr.referrer_user_id, COUNT(*)::int AS qualified_count
    FROM dreamer_referrals dr
    JOIN users referred_user
      ON referred_user.id = dr.referred_user_id
    WHERE dr.campaign_id = ${campaignId}
      AND dr.status = 'qualified'
      AND referred_user.active = 1
      AND referred_user.user_type = 'external'
    GROUP BY dr.project_id, dr.referrer_user_id
  `

  const result = new Map()
  for (const row of rows) {
    const projectId = Number(row.project_id)
    result.set(projectId, (result.get(projectId) || 0) + tierPoints(Number(row.qualified_count)))
  }
  return result
}

export async function acceptReferralCodeForUser({ code, userId }) {
  const cleanCode = String(code || '').trim().toUpperCase()
  if (!cleanCode || !userId) return { accepted: false }

  const codes = await sql`
    SELECT rc.campaign_id, rc.project_id, rc.referrer_user_id, p.name AS project
    FROM dreamer_referral_codes rc
    JOIN projects p ON p.id = rc.project_id
    WHERE UPPER(rc.code) = ${cleanCode}
      AND rc.active = 1
    LIMIT 1
  `
  const invite = codes[0]
  if (!invite) {
    return { accepted: false, reason: 'invalid_code' }
  }

  if (Number(invite.referrer_user_id) === Number(userId)) {
    return { accepted: false, reason: 'self_referral' }
  }

  const referredUsers = await sql`
    SELECT id, active, user_type
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `
  const referredUser = referredUsers[0]

  if (!referredUser || Number(referredUser.active) !== 1) {
    return { accepted: false, reason: 'invalid_user' }
  }

  // Só contas externas podem gerar indicação qualificada.
  // Voluntários contínuos já cadastrados na Central continuam
  // podendo indicar outras pessoas, mas não contam como indicados.
  if (referredUser.user_type !== 'external') {
    return {
      accepted: false,
      reason: 'continuous_volunteer',
      project: invite.project,
    }
  }

  const existing = await sql`
    SELECT id, referrer_user_id
    FROM dreamer_referrals
    WHERE campaign_id = ${invite.campaign_id}
      AND project_id = ${invite.project_id}
      AND referred_user_id = ${userId}
    LIMIT 1
  `
  if (existing[0]) {
    const sameReferrer =
      Number(existing[0].referrer_user_id) === Number(invite.referrer_user_id)

    return {
      accepted: sameReferrer,
      alreadyRegistered: true,
      reason: sameReferrer ? 'already_registered' : 'existing_indicator',
      project: invite.project,
    }
  }

  await sql`
    INSERT INTO dreamer_referrals (
      campaign_id, project_id, referrer_user_id, referred_user_id, status
    ) VALUES (
      ${invite.campaign_id}, ${invite.project_id}, ${invite.referrer_user_id}, ${userId}, 'registered'
    )
  `

  return { accepted: true, project: invite.project }
}

async function createInvite(user, campaign) {
  const projectId = Number(user.dreamerProfile?.preferred_project_id || user.project_id)
  if (!projectId) throw new Error('Escolha um time antes de criar seu convite.')

  const existing = await sql`
    SELECT code
    FROM dreamer_referral_codes
    WHERE campaign_id = ${campaign.id}
      AND project_id = ${projectId}
      AND referrer_user_id = ${user.id}
      AND active = 1
    LIMIT 1
  `
  if (existing[0]) return existing[0].code

  const code = `SONHAR-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
  await sql`
    INSERT INTO dreamer_referral_codes (campaign_id, project_id, referrer_user_id, code)
    VALUES (${campaign.id}, ${projectId}, ${user.id}, ${code})
    ON CONFLICT (campaign_id, project_id, referrer_user_id)
    DO UPDATE SET active = 1
  `

  const row = await sql`
    SELECT code
    FROM dreamer_referral_codes
    WHERE campaign_id = ${campaign.id}
      AND project_id = ${projectId}
      AND referrer_user_id = ${user.id}
    LIMIT 1
  `
  return row[0]?.code || code
}

async function buildPayload(user, campaign) {
  await syncQualifications(campaign.id)
  const projectId = Number(user.dreamerProfile?.preferred_project_id || user.project_id)

  const inviteRows = await sql`
    SELECT code
    FROM dreamer_referral_codes
    WHERE campaign_id = ${campaign.id}
      AND project_id = ${projectId}
      AND referrer_user_id = ${user.id}
      AND active = 1
    LIMIT 1
  `

  const mine = await sql`
    SELECT dr.id, dr.status, dr.created_at, dr.qualified_at,
           u.name, u.full_name, p.name AS project
    FROM dreamer_referrals dr
    JOIN users u ON u.id = dr.referred_user_id
    JOIN projects p ON p.id = dr.project_id
    WHERE dr.campaign_id = ${campaign.id}
      AND dr.referrer_user_id = ${user.id}
      AND dr.project_id = ${projectId}
      AND u.active = 1
      AND u.user_type = 'external'
    ORDER BY dr.created_at DESC
  `

  const qualifiedCount = mine.filter(item => item.status === 'qualified').length
  const points = tierPoints(qualifiedCount)
  const next = nextTier(qualifiedCount)

  let admin = null
  if (user.isDreamerAdmin) {
    const teamRows = await sql`
      SELECT p.id AS project_id, p.name AS project,
             COUNT(dr.id)::int AS registered,
             COUNT(dr.id) FILTER (WHERE dr.status = 'qualified')::int AS qualified
      FROM projects p
      JOIN dreamer_campaign_teams dct ON dct.project_id = p.id AND dct.campaign_id = ${campaign.id}
      LEFT JOIN dreamer_referrals dr
        ON dr.project_id = p.id
       AND dr.campaign_id = ${campaign.id}
       AND EXISTS (
         SELECT 1
         FROM users referred_user
         WHERE referred_user.id = dr.referred_user_id
           AND referred_user.active = 1
           AND referred_user.user_type = 'external'
       )
      GROUP BY p.id, p.name
      ORDER BY p.id
    `

    const rankingRows = await sql`
      SELECT dr.project_id, p.name AS project, dr.referrer_user_id,
             COALESCE(NULLIF(u.full_name, ''), u.name, u.username) AS referrer,
             COUNT(*) FILTER (WHERE dr.status = 'qualified')::int AS qualified,
             COUNT(*)::int AS registered
      FROM dreamer_referrals dr
      JOIN users u ON u.id = dr.referrer_user_id
      JOIN users referred_user ON referred_user.id = dr.referred_user_id
      JOIN projects p ON p.id = dr.project_id
      WHERE dr.campaign_id = ${campaign.id}
        AND referred_user.active = 1
        AND referred_user.user_type = 'external'
      GROUP BY dr.project_id, p.name, dr.referrer_user_id, u.full_name, u.name, u.username
      ORDER BY qualified DESC, registered DESC, referrer ASC
    `

    admin = {
      teams: teamRows.map(row => ({
        ...row,
        points: 0,
      })),
      ranking: rankingRows.map(row => ({
        ...row,
        points: tierPoints(Number(row.qualified)),
      })),
    }
    const pointsMap = await referralPointsByProject(campaign.id)
    admin.teams = admin.teams.map(team => ({
      ...team,
      points: pointsMap.get(Number(team.project_id)) || 0,
    }))
  }

  return {
    campaign,
    projectId,
    inviteCode: inviteRows[0]?.code || '',
    registeredCount: mine.length,
    qualifiedCount,
    points,
    nextTier: next,
    referrals: mine,
    isDreamerAdmin: Boolean(user.isDreamerAdmin),
    admin,
  }
}

export default async function handler(request, response) {
  try {
    const user = await requireDreamerUser(request)
    if (!user) return response.status(401).json({ error: 'Não autorizado.' })

    const campaign = await getCampaign()
    if (!campaign) return response.status(404).json({ error: 'Olimpíada Sonhadora não encontrada.' })

    if (request.method === 'GET') {
      return response.status(200).json(await buildPayload(user, campaign))
    }

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Método não permitido.' })
    }

    if (campaign.status === 'closed') {
      return response.status(409).json({
        error:
          'A Olimpíada já foi fechada. Novas indicações não podem alterar o resultado oficial.',
      })
    }

    const operation = request.body?.operation
    if (operation === 'create_invite') {
      const code = await createInvite(user, campaign)
      return response.status(200).json({ success: true, code, ...(await buildPayload(user, campaign)) })
    }

    if (operation === 'accept_invite') {
      const result = await acceptReferralCodeForUser({
        code: request.body?.code,
        userId: user.id,
      })

      if (!result.accepted) {
        const messages = {
          self_referral:
            'Esse convite pertence à sua própria conta. Compartilhe-o com uma pessoa nova para registrar uma indicação.',
          continuous_volunteer:
            'Voluntários contínuos já cadastrados na Central não geram crédito de indicação. O convite é válido para novas pessoas no Sócio Sonhador.',
          existing_indicator:
            'Este time já possui outro indicador válido vinculado à sua conta.',
          invalid_user:
            'Não foi possível validar sua conta para este convite.',
          invalid_code:
            'Convite inválido ou não disponível.',
        }

        return response.status(400).json({
          error:
            messages[result.reason] ||
            (result.alreadyRegistered
              ? 'Este convite já está registrado na sua conta.'
              : 'Convite inválido ou não disponível.'),
          reason: result.reason || 'invalid_code',
        })
      }

      return response.status(200).json({
        success: true,
        referral: result,
        ...(await buildPayload(user, campaign)),
      })
    }

    return response.status(400).json({ error: 'Operação de indicação inválida.' })
  } catch (error) {
    console.error('Dreamer referrals error:', error)
    return response.status(500).json({ error: error.message || 'Não foi possível processar as indicações.' })
  }
}
