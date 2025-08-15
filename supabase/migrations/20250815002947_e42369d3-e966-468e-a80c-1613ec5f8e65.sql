-- Permitir que diferentes usuarios tengan cuentas con el mismo código
-- Cambiar la clave primaria para incluir user_id

-- Primero, eliminar la clave primaria actual
ALTER TABLE accounts DROP CONSTRAINT accounts_pkey;

-- Agregar una nueva clave primaria compuesta de id y user_id
ALTER TABLE accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id, user_id);

-- Asegurar que user_id no sea nulo (requerido para la clave primaria)
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;