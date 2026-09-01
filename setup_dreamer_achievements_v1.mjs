import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS dreamer_achievement_definitions (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '✦',
    category TEXT NOT NULL DEFAULT 'journey',
    season_slug TEXT,
    rule_type TEXT NOT NULL,
    rule_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    reward_type TEXT NOT NULL DEFAULT 'badge',
    reward_code TEXT NOT NULL,
    reward_label TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS dreamer_user_achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_code TEXT NOT NULL REFERENCES dreamer_achievement_definitions(code) ON DELETE CASCADE,
    source_type TEXT NOT NULL DEFAULT '',
    source_reference TEXT NOT NULL DEFAULT '',
    unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_code)
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS dreamer_user_achievements_user_idx
  ON dreamer_user_achievements(user_id, unlocked_at DESC)
`

await sql`
  CREATE TABLE IF NOT EXISTS dreamer_profile_cosmetics (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    equipped_badge_code TEXT,
    equipped_banner_code TEXT,
    equipped_frame_code TEXT,
    equipped_accent_code TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`

const definitions = [
  {
    code: 'dreamer_welcome',
    title: 'Primeiro passo',
    description: 'Entrou no Sócio Sonhador e começou a construir sua jornada de impacto.',
    icon: '♥',
    category: 'journey',
    seasonSlug: null,
    ruleType: 'dreamer_access',
    ruleValue: { min: 1 },
    rewardType: 'badge',
    rewardCode: 'badge_primeiro_passo',
    rewardLabel: 'Badge Primeiro Passo',
    sortOrder: 10,
  },
  {
    code: 'first_confirmed_support',
    title: 'Coração em movimento',
    description: 'Teve o primeiro apoio financeiro confirmado dentro do Sócio Sonhador.',
    icon: '♡',
    category: 'impact',
    seasonSlug: null,
    ruleType: 'confirmed_support_count',
    ruleValue: { min: 1 },
    rewardType: 'banner',
    rewardCode: 'banner_coracao_em_movimento',
    rewardLabel: 'Banner Coração em Movimento',
    sortOrder: 20,
  },
  {
    code: 'first_validated_fundraising',
    title: 'Mobilizador de sonhos',
    description: 'Criou uma arrecadação externa que foi validada oficialmente.',
    icon: '↗',
    category: 'impact',
    seasonSlug: null,
    ruleType: 'validated_fundraising_count',
    ruleValue: { min: 1 },
    rewardType: 'frame',
    rewardCode: 'frame_mobilizador',
    rewardLabel: 'Moldura Mobilizador',
    sortOrder: 30,
  },
  {
    code: 'first_qualified_referral',
    title: 'Conector de sonhos',
    description: 'Trouxe uma nova pessoa que se tornou uma indicação qualificada.',
    icon: '◎',
    category: 'community',
    seasonSlug: 'olimpiada-sonhadora',
    ruleType: 'qualified_referral_count',
    ruleValue: { min: 1 },
    rewardType: 'accent',
    rewardCode: 'accent_conector',
    rewardLabel: 'Destaque Conector',
    sortOrder: 40,
  },
]

for (const item of definitions) {
  await sql`
    INSERT INTO dreamer_achievement_definitions (
      code, title, description, icon, category, season_slug,
      rule_type, rule_value, reward_type, reward_code, reward_label, sort_order
    ) VALUES (
      ${item.code}, ${item.title}, ${item.description}, ${item.icon}, ${item.category}, ${item.seasonSlug},
      ${item.ruleType}, ${JSON.stringify(item.ruleValue)}::jsonb,
      ${item.rewardType}, ${item.rewardCode}, ${item.rewardLabel}, ${item.sortOrder}
    )
    ON CONFLICT (code) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      category = EXCLUDED.category,
      season_slug = EXCLUDED.season_slug,
      rule_type = EXCLUDED.rule_type,
      rule_value = EXCLUDED.rule_value,
      reward_type = EXCLUDED.reward_type,
      reward_code = EXCLUDED.reward_code,
      reward_label = EXCLUDED.reward_label,
      sort_order = EXCLUDED.sort_order,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `
}

console.log('✅ Migration 014_dreamer_achievements_v1 aplicada.')
