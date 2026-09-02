CREATE TABLE IF NOT EXISTS dreamer_stories (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL,
  summary VARCHAR(420) NOT NULL DEFAULT '',
  story_text TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  story_date DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dreamer_stories_status_check CHECK (status IN ('draft', 'published')),
  CONSTRAINT dreamer_stories_featured_check CHECK (featured IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_dreamer_stories_public
  ON dreamer_stories (status, featured, sort_order, story_date DESC);
