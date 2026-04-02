SET CONSTRAINTS ALL DEFERRED;

UPDATE journal_entries SET id = '004-Q2-26' WHERE id = '133-Q1-26';
UPDATE journal_entries SET id = '005-Q2-26' WHERE id = '134-Q1-26';
UPDATE journal_entries SET id = '006-Q2-26' WHERE id = '135-Q1-26';
UPDATE journal_entries SET id = '007-Q2-26' WHERE id = '136-Q1-26';
UPDATE journal_entries SET id = '008-Q2-26' WHERE id = '137-Q1-26';
UPDATE journal_entries SET id = '009-Q2-26' WHERE id = '138-Q1-26';
UPDATE journal_entries SET id = '010-Q2-26' WHERE id = '139-Q1-26';

UPDATE journal_lines SET entry_id = '004-Q2-26' WHERE entry_id = '133-Q1-26';
UPDATE journal_lines SET entry_id = '005-Q2-26' WHERE entry_id = '134-Q1-26';
UPDATE journal_lines SET entry_id = '006-Q2-26' WHERE entry_id = '135-Q1-26';
UPDATE journal_lines SET entry_id = '007-Q2-26' WHERE entry_id = '136-Q1-26';
UPDATE journal_lines SET entry_id = '008-Q2-26' WHERE entry_id = '137-Q1-26';
UPDATE journal_lines SET entry_id = '009-Q2-26' WHERE entry_id = '138-Q1-26';
UPDATE journal_lines SET entry_id = '010-Q2-26' WHERE entry_id = '139-Q1-26';

UPDATE auxiliary_movement_details SET journal_entry_id = '004-Q2-26' WHERE journal_entry_id = '133-Q1-26';
UPDATE auxiliary_movement_details SET journal_entry_id = '005-Q2-26' WHERE journal_entry_id = '134-Q1-26';
UPDATE auxiliary_movement_details SET journal_entry_id = '006-Q2-26' WHERE journal_entry_id = '135-Q1-26';
UPDATE auxiliary_movement_details SET journal_entry_id = '007-Q2-26' WHERE journal_entry_id = '136-Q1-26';
UPDATE auxiliary_movement_details SET journal_entry_id = '008-Q2-26' WHERE journal_entry_id = '137-Q1-26';
UPDATE auxiliary_movement_details SET journal_entry_id = '009-Q2-26' WHERE journal_entry_id = '138-Q1-26';
UPDATE auxiliary_movement_details SET journal_entry_id = '010-Q2-26' WHERE journal_entry_id = '139-Q1-26';

UPDATE kardex_movements SET journal_entry_id = '004-Q2-26' WHERE journal_entry_id = '133-Q1-26';
UPDATE kardex_movements SET journal_entry_id = '005-Q2-26' WHERE journal_entry_id = '134-Q1-26';
UPDATE kardex_movements SET journal_entry_id = '006-Q2-26' WHERE journal_entry_id = '135-Q1-26';
UPDATE kardex_movements SET journal_entry_id = '007-Q2-26' WHERE journal_entry_id = '136-Q1-26';
UPDATE kardex_movements SET journal_entry_id = '008-Q2-26' WHERE journal_entry_id = '137-Q1-26';
UPDATE kardex_movements SET journal_entry_id = '009-Q2-26' WHERE journal_entry_id = '138-Q1-26';
UPDATE kardex_movements SET journal_entry_id = '010-Q2-26' WHERE journal_entry_id = '139-Q1-26';

UPDATE inventory_movements SET journal_entry_id = '004-Q2-26' WHERE journal_entry_id = '133-Q1-26';
UPDATE inventory_movements SET journal_entry_id = '005-Q2-26' WHERE journal_entry_id = '134-Q1-26';
UPDATE inventory_movements SET journal_entry_id = '006-Q2-26' WHERE journal_entry_id = '135-Q1-26';
UPDATE inventory_movements SET journal_entry_id = '007-Q2-26' WHERE journal_entry_id = '136-Q1-26';
UPDATE inventory_movements SET journal_entry_id = '008-Q2-26' WHERE journal_entry_id = '137-Q1-26';
UPDATE inventory_movements SET journal_entry_id = '009-Q2-26' WHERE journal_entry_id = '138-Q1-26';
UPDATE inventory_movements SET journal_entry_id = '010-Q2-26' WHERE journal_entry_id = '139-Q1-26';