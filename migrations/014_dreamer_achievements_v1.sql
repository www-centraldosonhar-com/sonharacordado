-- =========================================================
-- SÓCIO SONHADOR — ACHIEVEMENTS & COSMETICS V1
-- =========================================================
-- Conquistas permanentes, recompensas cosméticas e seleção
-- visual do perfil. As regras são avaliadas no backend com
-- base em eventos já existentes no ecossistema Dreamer.
-- =========================================================

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
);

CREATE TABLE IF NOT EXISTS dreamer_user_achievements (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_code TEXT NOT NULL REFERENCES dreamer_achievement_definitions(code) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT '',
  source_reference TEXT NOT NULL DEFAULT '',
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_code)
);

CREATE INDEX IF NOT EXISTS dreamer_user_achievements_user_idx
  ON dreamer_user_achievements(user_id, unlocked_at DESC);

CREATE TABLE IF NOT EXISTS dreamer_profile_cosmetics (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  equipped_badge_code TEXT,
  equipped_banner_code TEXT,
  equipped_frame_code TEXT,
  equipped_accent_code TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO dreamer_achievement_definitions (
  code, title, description, icon, category, season_slug,
  rule_type, rule_value, reward_type, reward_code, reward_label, sort_order
) VALUES
  (
    'dreamer_welcome',
    'Primeiro passo',
    'Entrou no Sócio Sonhador e começou a construir sua jornada de impacto.',
    '♥',
    'journey',
    NULL,
    'dreamer_access',
    '{"min": 1}'::jsonb,
    'badge',
    'badge_primeiro_passo',
    'Badge Primeiro Passo',
    10
  ),
  (
    'first_confirmed_support',
    'Coração em movimento',
    'Teve o primeiro apoio financeiro confirmado dentro do Sócio Sonhador.',
    '♡',
    'impact',
    NULL,
    'confirmed_support_count',
    '{"min": 1}'::jsonb,
    'banner',
    'banner_coracao_em_movimento',
    'Banner Coração em Movimento',
    20
  ),
  (
    'first_validated_fundraising',
    'Mobilizador de sonhos',
    'Criou uma arrecadação externa que foi validada oficialmente.',
    '↗',
    'impact',
    NULL,
    'validated_fundraising_count',
    '{"min": 1}'::jsonb,
    'frame',
    'frame_mobilizador',
    'Moldura Mobilizador',
    30
  ),
  (
    'first_qualified_referral',
    'Conector de sonhos',
    'Trouxe uma nova pessoa que se tornou uma indicação qualificada.',
    '◎',
    'community',
    'olimpiada-sonhadora',
    'qualified_referral_count',
    '{"min": 1}'::jsonb,
    'accent',
    'accent_conector',
    'Destaque Conector',
    40
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
  updated_at = CURRENT_TIMESTAMP;
