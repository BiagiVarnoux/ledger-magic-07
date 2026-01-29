-- Clean up floating point precision errors in journal_lines
UPDATE journal_lines 
SET debit = ROUND(debit::numeric, 2),
    credit = ROUND(credit::numeric, 2);