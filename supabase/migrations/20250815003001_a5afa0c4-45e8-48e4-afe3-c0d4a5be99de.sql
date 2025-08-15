-- Permitir que diferentes usuarios tengan cuentas con el mismo código
-- Primero, eliminar la foreign key que depende de la clave primaria
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_account_id_fkey;

-- Eliminar la clave primaria actual
ALTER TABLE accounts DROP CONSTRAINT accounts_pkey;

-- Asegurar que user_id no sea nulo (requerido para la clave primaria)
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;

-- Agregar una nueva clave primaria compuesta de id y user_id
ALTER TABLE accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id, user_id);

-- Recrear la foreign key pero ahora solo validando que existe una cuenta con ese id
-- (sin importar el user_id, ya que las RLS policies se encargan de la seguridad)
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_account_valid 
CHECK (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = journal_lines.account_id));