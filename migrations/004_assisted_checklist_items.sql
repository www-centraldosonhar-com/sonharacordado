-- Checklists de Assistidos reutilizam activity_checklist_items,
-- mas seus itens não possuem event_registration.

ALTER TABLE activity_checklist_items
ALTER COLUMN registration_id DROP NOT NULL;

ALTER TABLE activity_checklist_items
ADD COLUMN IF NOT EXISTS assisted_person_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'activity_checklist_items_assisted_person_fkey'
  ) THEN
    ALTER TABLE activity_checklist_items
    ADD CONSTRAINT
      activity_checklist_items_assisted_person_fkey
    FOREIGN KEY (assisted_person_id)
    REFERENCES assisted_people(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS
  activity_checklist_items_assisted_person_unique
ON activity_checklist_items (
  checklist_id,
  assisted_person_id
)
WHERE assisted_person_id IS NOT NULL;
