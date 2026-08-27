-- Forma de saída para casa informada no cadastro oficial de Assistidos.
-- ALTER TABLE é aditivo, não remove nem altera dados existentes.

ALTER TABLE assisted_people
ADD COLUMN IF NOT EXISTS departure_method TEXT NOT NULL DEFAULT '';
