ALTER TABLE journal_lines DROP CONSTRAINT journal_lines_entry_id_fkey;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_entry_id_fkey 
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id);