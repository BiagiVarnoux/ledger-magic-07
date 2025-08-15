-- Asignar todos los datos existentes al usuario actual
-- Esto permite que veas tus datos que ya tenías en el sistema

UPDATE accounts 
SET user_id = '9c051631-70a2-4ae6-9887-82c89a980cdb'
WHERE user_id IS NULL;

UPDATE journal_entries 
SET user_id = '9c051631-70a2-4ae6-9887-82c89a980cdb'
WHERE user_id IS NULL;