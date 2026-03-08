

# Plan: Auto-renumbering of Journal Entry IDs by Chronological Order

## Problem
Currently, new journal entries get the next sequential ID regardless of date. When an entry is recorded with an earlier date, its ID appears out of chronological order (e.g., entry 012 has date 02/16 but entry 011 has date 02/18).

## Solution
After saving a new entry (not editing), re-sort all entries in the same quarter by date and reassign sequential IDs. Update all references across tables.

## Files to Modify

### 1. `src/accounting/utils.ts`
- Add a new function `renumberQuarterEntries(entries: JournalEntry[], quarterIdentifier: string)` that:
  - Filters entries belonging to that quarter
  - Sorts by date ASC, then by `created_at` or current ID as tiebreaker
  - Returns a map of `oldId -> newId` for entries that need renumbering

### 2. `src/pages/journal/Index.tsx` — `handleFinalSave`
- After saving a new entry (not editing), call a renumbering routine:
  1. Reload entries from adapter
  2. Get all entries in the same quarter, sorted by date ASC then current ID ASC
  3. Compute new sequential IDs (001-QX-YY, 002-QX-YY, ...)
  4. For any entry where oldId !== newId, update in Supabase:
     - Update `journal_entries.id` (delete old + insert new since `id` is PK)
     - Update `journal_lines.entry_id`
     - Update `kardex_movements.journal_entry_id`
     - Update `auxiliary_movement_details.journal_entry_id`
     - Update `inventory_movements.journal_entry_id`
  5. Reload entries again to reflect new IDs

### 3. `src/accounting/data-adapter.ts`
- Add a new method `renumberEntry(oldId: string, newId: string): Promise<void>` to `IDataAdapter` that handles the atomic rename of an entry ID across all tables. Implementation:
  - Read the entry + lines
  - Insert new entry with new ID
  - Update all foreign references (`journal_lines`, `kardex_movements`, `auxiliary_movement_details`, `inventory_movements`)
  - Delete old entry

## Renumbering Algorithm

```text
1. After save, get quarterIdentifier from entry date
2. Load all entries in that quarter
3. Sort by (date ASC, created_at ASC)
4. Assign IDs: 001-QX-YY, 002-QX-YY, ...
5. Collect pairs where oldId != newId
6. If no changes needed, skip
7. Otherwise, rename each entry in order (process from end to avoid conflicts)
8. Show toast: "IDs renumerados cronológicamente"
```

## Edge Cases
- Editing an existing entry (date change): should also trigger renumbering
- Voiding an entry: the void entry gets a new ID, so renumber after
- Deleting an entry: should also trigger renumbering to close gaps
- Conflict avoidance: rename to temporary IDs first, then to final IDs, to avoid PK conflicts

