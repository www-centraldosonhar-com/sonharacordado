import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { requireDreamerUser } from './_dreamer-access.js'

const sql = neon(process.env.DATABASE_URL)

const COSMETIC_COLUMNS = {
  badge: 'equipped_badge_code',
  banner: 'equipped_banner_code',
  frame: 'equipped_frame_code',
  accent: 'equipped_accent_code',
}

function minimumFromRule(value) {
  if (!value || typeof value !== 'object') return 1
  const min = Number(value.min)
  return Number.isFinite(min) && min > 0 ? min : 1
}

async function getMetrics(userId) {
  const [supportRows, fundraisingRows, referralRows] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS total
      FROM dreamer_contributions
      WHERE contributor_user_id = ${userId}
        AND status = 'confirmed'
    `,
    sql`
      SELECT COUNT(*)::int AS total
      FROM dreamer_fundraising_entries
      WHERE submitted_by = ${userId}
        AND status = 'validated'
    `,
    sql`
      SELECT COUNT(*)::int AS total
      FROM dreamer_referrals dr
      WHERE dr.referrer_user_id = ${userId}
        AND dr.status = 'qualified'
        AND NOT EXISTS (
          SELECT 1
          FROM user_permissions up
          WHERE up.user_id = dr.referred_user_id
            AND up.permission = 'volunteer'
            AND up.active = 1
        )
    `,
  ])

  return {
    dreamer_access: 1,
    confirmed_support_count: Number(supportRows[0]?.total || 0),
    validated_fundraising_count: Number(fundraisingRows[0]?.total || 0),
    qualified_referral_count: Number(referralRows[0]?.total || 0),
  }
}

async function syncAchievements(userId) {
  const [definitions, metrics] = await Promise.all([
    sql`
      SELECT code, rule_type, rule_value
      FROM dreamer_achievement_definitions
      WHERE active = 1
      ORDER BY sort_order, id
    `,
    getMetrics(userId),
  ])

  for (const definition of definitions) {
    const current = Number(metrics[definition.rule_type] || 0)
    const minimum = minimumFromRule(definition.rule_value)

    if (current < minimum) continue

    await sql`
      INSERT INTO dreamer_user_achievements (
        user_id,
        achievement_code,
        source_type,
        source_reference
      ) VALUES (
        ${userId},
        ${definition.code},
        ${definition.rule_type},
        ${String(current)}
      )
      ON CONFLICT (user_id, achievement_code) DO NOTHING
    `
  }

  const defaultBadgeRows = await sql`
    SELECT dad.reward_code
    FROM dreamer_user_achievements dua
    JOIN dreamer_achievement_definitions dad
      ON dad.code = dua.achievement_code
    WHERE dua.user_id = ${userId}
      AND dad.active = 1
      AND dad.reward_type = 'badge'
    ORDER BY dad.sort_order, dua.unlocked_at
    LIMIT 1
  `

  await sql`
    INSERT INTO dreamer_profile_cosmetics (
      user_id,
      equipped_badge_code
    ) VALUES (
      ${userId},
      ${defaultBadgeRows[0]?.reward_code || null}
    )
    ON CONFLICT (user_id) DO NOTHING
  `

  return metrics
}

async function buildImpactTimeline(userId) {
  const [profileRows, contributionRows, fundraisingRows, referralRows, achievementRows] = await Promise.all([
    sql`
      SELECT joined_at
      FROM dreamer_profiles
      WHERE user_id = ${userId}
        AND active = 1
      LIMIT 1
    `,
    sql`
      SELECT dc.id, dc.amount, dc.confirmed_at AS happened_at,
             p.name AS project, campaign.name AS campaign_name
      FROM dreamer_contributions dc
      LEFT JOIN projects p ON p.id = dc.project_id
      LEFT JOIN dreamer_campaigns campaign ON campaign.id = dc.campaign_id
      WHERE dc.contributor_user_id = ${userId}
        AND dc.status = 'confirmed'
        AND dc.confirmed_at IS NOT NULL
      ORDER BY dc.confirmed_at DESC
      LIMIT 12
    `,
    sql`
      SELECT dfe.id, dfe.title, dfe.net_amount, dfe.reviewed_at AS happened_at,
             p.name AS project
      FROM dreamer_fundraising_entries dfe
      JOIN projects p ON p.id = dfe.project_id
      WHERE dfe.submitted_by = ${userId}
        AND dfe.status = 'validated'
      ORDER BY dfe.reviewed_at DESC NULLS LAST, dfe.id DESC
      LIMIT 12
    `,
    sql`
      SELECT dr.id, dr.qualified_at AS happened_at, p.name AS project,
             COALESCE(NULLIF(u.full_name, ''), u.name, u.username, 'Novo sonhador') AS referred_name
      FROM dreamer_referrals dr
      JOIN projects p ON p.id = dr.project_id
      JOIN users u ON u.id = dr.referred_user_id
      WHERE dr.referrer_user_id = ${userId}
        AND dr.status = 'qualified'
        AND NOT EXISTS (
          SELECT 1
          FROM user_permissions up
          WHERE up.user_id = dr.referred_user_id
            AND up.permission = 'volunteer'
            AND up.active = 1
        )
      ORDER BY dr.qualified_at DESC NULLS LAST, dr.id DESC
      LIMIT 12
    `,
    sql`
      SELECT dua.id, dua.unlocked_at AS happened_at,
             dad.title, dad.icon, dad.reward_label
      FROM dreamer_user_achievements dua
      JOIN dreamer_achievement_definitions dad
        ON dad.code = dua.achievement_code
      WHERE dua.user_id = ${userId}
        AND dad.active = 1
      ORDER BY dua.unlocked_at DESC
      LIMIT 12
    `,
  ])

  const timeline = []

  if (profileRows[0]?.joined_at) {
    timeline.push({
      id: 'joined',
      type: 'joined',
      icon: '♥',
      title: 'Entrou para o Sócio Sonhador',
      description: 'Aqui começou sua jornada de pertencimento e impacto.',
      happenedAt: profileRows[0].joined_at,
    })
  }

  for (const item of contributionRows) {
    timeline.push({
      id: `contribution-${item.id}`,
      type: 'contribution',
      icon: '♡',
      title: 'Apoio confirmado',
      description: item.project
        ? `Seu apoio fortaleceu o time ${item.project}.`
        : 'Seu apoio livre foi confirmado para o Sonhar.',
      amount: Number(item.amount || 0),
      campaign: item.campaign_name || null,
      happenedAt: item.happened_at,
    })
  }

  for (const item of fundraisingRows) {
    timeline.push({
      id: `fundraising-${item.id}`,
      type: 'fundraising',
      icon: '↗',
      title: item.title || 'Arrecadação validada',
      description: `Uma arrecadação sua foi validada para ${item.project}.`,
      amount: Number(item.net_amount || 0),
      happenedAt: item.happened_at,
    })
  }

  for (const item of referralRows) {
    timeline.push({
      id: `referral-${item.id}`,
      type: 'referral',
      icon: '◎',
      title: 'Nova conexão qualificada',
      description: `${item.referred_name} passou a contar como indicação qualificada para ${item.project}.`,
      happenedAt: item.happened_at,
    })
  }

  for (const item of achievementRows) {
    timeline.push({
      id: `achievement-${item.id}`,
      type: 'achievement',
      icon: item.icon || '✦',
      title: `Conquista desbloqueada: ${item.title}`,
      description: item.reward_label
        ? `Você também liberou ${item.reward_label}.`
        : 'Uma nova conquista entrou para sua jornada.',
      happenedAt: item.happened_at,
    })
  }

  return timeline
    .filter(item => item.happenedAt)
    .sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    .slice(0, 20)
}

async function buildPayload(user) {
  const metrics = await syncAchievements(user.id)

  const [achievementRows, cosmeticsRows, timeline] = await Promise.all([
    sql`
      SELECT
        dad.code,
        dad.title,
        dad.description,
        dad.icon,
        dad.category,
        dad.season_slug,
        dad.rule_type,
        dad.rule_value,
        dad.reward_type,
        dad.reward_code,
        dad.reward_label,
        dad.sort_order,
        dua.unlocked_at
      FROM dreamer_achievement_definitions dad
      LEFT JOIN dreamer_user_achievements dua
        ON dua.achievement_code = dad.code
       AND dua.user_id = ${user.id}
      WHERE dad.active = 1
      ORDER BY dad.sort_order, dad.id
    `,
    sql`
      SELECT equipped_badge_code, equipped_banner_code,
             equipped_frame_code, equipped_accent_code, updated_at
      FROM dreamer_profile_cosmetics
      WHERE user_id = ${user.id}
      LIMIT 1
    `,
    buildImpactTimeline(user.id),
  ])

  const achievements = achievementRows.map(item => {
    const minimum = minimumFromRule(item.rule_value)
    const current = Number(metrics[item.rule_type] || 0)

    return {
      code: item.code,
      title: item.title,
      description: item.description,
      icon: item.icon,
      category: item.category,
      seasonSlug: item.season_slug,
      rewardType: item.reward_type,
      rewardCode: item.reward_code,
      rewardLabel: item.reward_label,
      unlocked: Boolean(item.unlocked_at),
      unlockedAt: item.unlocked_at || null,
      progress: {
        current: Math.min(current, minimum),
        required: minimum,
      },
    }
  })

  const unlockedCosmetics = achievements
    .filter(item => item.unlocked && item.rewardCode)
    .map(item => ({
      type: item.rewardType,
      code: item.rewardCode,
      label: item.rewardLabel,
      achievementCode: item.code,
      achievementTitle: item.title,
    }))

  const cosmetics = cosmeticsRows[0] || {
    equipped_badge_code: null,
    equipped_banner_code: null,
    equipped_frame_code: null,
    equipped_accent_code: null,
  }

  return {
    summary: {
      unlocked: achievements.filter(item => item.unlocked).length,
      total: achievements.length,
    },
    achievements,
    cosmetics: {
      equipped: {
        badge: cosmetics.equipped_badge_code || null,
        banner: cosmetics.equipped_banner_code || null,
        frame: cosmetics.equipped_frame_code || null,
        accent: cosmetics.equipped_accent_code || null,
      },
      unlocked: unlockedCosmetics,
    },
    impact: timeline,
  }
}

async function equipCosmetic(userId, rewardType, rewardCode) {
  const column = COSMETIC_COLUMNS[rewardType]
  if (!column) {
    throw new Error('Tipo de recompensa visual inválido.')
  }

  let normalizedCode = null
  if (rewardCode) {
    const rows = await sql`
      SELECT dad.reward_code
      FROM dreamer_user_achievements dua
      JOIN dreamer_achievement_definitions dad
        ON dad.code = dua.achievement_code
      WHERE dua.user_id = ${userId}
        AND dad.active = 1
        AND dad.reward_type = ${rewardType}
        AND dad.reward_code = ${String(rewardCode)}
      LIMIT 1
    `

    if (!rows[0]) {
      throw new Error('Essa recompensa ainda não foi desbloqueada.')
    }

    normalizedCode = rows[0].reward_code
  }

  await sql`
    INSERT INTO dreamer_profile_cosmetics (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `

  if (rewardType === 'badge') {
    await sql`
      UPDATE dreamer_profile_cosmetics
      SET equipped_badge_code = ${normalizedCode}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `
  } else if (rewardType === 'banner') {
    await sql`
      UPDATE dreamer_profile_cosmetics
      SET equipped_banner_code = ${normalizedCode}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `
  } else if (rewardType === 'frame') {
    await sql`
      UPDATE dreamer_profile_cosmetics
      SET equipped_frame_code = ${normalizedCode}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `
  } else if (rewardType === 'accent') {
    await sql`
      UPDATE dreamer_profile_cosmetics
      SET equipped_accent_code = ${normalizedCode}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `
  }
}

export default async function handler(request, response) {
  try {
    const user = await requireDreamerUser(request)

    if (!user) {
      return response.status(401).json({ error: 'Não autorizado.' })
    }

    if (request.method === 'GET') {
      return response.status(200).json(await buildPayload(user))
    }

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Método não permitido.' })
    }

    const operation = String(request.body?.operation || '')

    if (operation === 'equip_cosmetic') {
      const rewardType = String(request.body?.rewardType || '')
      const rewardCode = request.body?.rewardCode
        ? String(request.body.rewardCode)
        : null

      await equipCosmetic(user.id, rewardType, rewardCode)

      return response.status(200).json({
        success: true,
        message: rewardCode
          ? 'Visual atualizado na sua jornada.'
          : 'Visual removido da sua jornada.',
        ...(await buildPayload(user)),
      })
    }

    return response.status(400).json({ error: 'Operação de conquistas inválida.' })
  } catch (error) {
    console.error('Dreamer achievements error:', error)
    return response.status(500).json({
      error: error.message || 'Não foi possível carregar suas conquistas.',
    })
  }
}
