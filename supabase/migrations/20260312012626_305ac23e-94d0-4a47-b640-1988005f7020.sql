
-- Borrar el movimiento auxiliar duplicado del asiento 012-Q1-26
-- que está registrado en el auxiliar "Banco SOL 2da Linea Crédito"
-- en lugar de "Banco SOL"
DELETE FROM auxiliary_movement_details
WHERE id = '48dafdb0-db69-48df-aa00-65ccf2278982';
