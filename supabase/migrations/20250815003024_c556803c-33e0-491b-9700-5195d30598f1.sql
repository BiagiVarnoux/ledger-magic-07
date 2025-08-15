-- Permitir que diferentes usuarios tengan cuentas con el mismo código
-- Eliminar la foreign key que depende de la clave primaria
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_account_id_fkey;

-- Eliminar la clave primaria actual
ALTER TABLE accounts DROP CONSTRAINT accounts_pkey;

-- Asegurar que user_id no sea nulo (requerido para la clave primaria)
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;

-- Agregar una nueva clave primaria compuesta de id y user_id
ALTER TABLE accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id, user_id);