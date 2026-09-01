-- =========================================================
-- 009 - DREAMER MISSIONS V2
-- Adds configurable rules/maximum points and protects
-- against duplicate team scoring for the same mission.
-- =========================================================

ALTER TABLE dreamer_missions
  ADD COLUMN IF NOT EXISTS rules_text TEXT NOT NULL DEFAULT '';

ALTER TABLE dreamer_missions
  ADD COLUMN IF NOT EXISTS max_points NUMERIC(10,2);

CREATE UNIQUE INDEX IF NOT EXISTS dreamer_mission_team_result_unique
  ON dreamer_mission_results (mission_id, project_id)
  WHERE user_id IS NULL;
