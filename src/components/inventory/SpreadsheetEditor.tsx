import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  CellGrid,
  CellData,
  getCellKey,
  colToLetter,
  evaluateFormula,
  recalculateGrid,
  formatNumber,
} from '@/lib/spreadsheet-engine';

interface SpreadsheetEditorProps {
  grid: CellGrid;
  onGridChange: (grid: CellGrid) => void;
  rows?: number;
  cols?: number;
  readOnly?: boolean;
}

export function SpreadsheetEditor({
  grid,
  onGridChange,
  rows = 30,
  cols = 8,
  readOnly = false,
}: SpreadsheetEditorProps) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  const handleCellClick = useCallback((key: string) => {
    setSelectedCell(key);
    if (!readOnly) {
      const cell = grid.get(key);
      setEditValue(cell?.formula || cell?.value || '');
      setEditingCell(key);
    }
  }, [grid, readOnly]);

  const handleCellChange = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;

    const cell = grid.get(editingCell);
    if (!cell) return;

    const isFormula = editValue.startsWith('=');
    const newCell: CellData = {
      ...cell,
      value: isFormula ? '' : editValue,
      formula: isFormula ? editValue : null,
      cellType: isFormula ? 'formula' : 
                (!isNaN(parseFloat(editValue)) ? 'number' : 'text'),
    };

    const newGrid = new Map(grid);
    newGrid.set(editingCell, newCell);
    
    const recalculated = recalculateGrid(newGrid);
    onGridChange(recalculated);
    
    setEditingCell(null);
  }, [editingCell, editValue, grid, onGridChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      // Move to next row
      if (selectedCell) {
        const cell = grid.get(selectedCell);
        if (cell) {
          const nextKey = getCellKey(cell.row + 1, cell.col);
          setSelectedCell(nextKey);
          const nextCell = grid.get(nextKey);
          setEditValue(nextCell?.formula || nextCell?.value || '');
          setEditingCell(nextKey);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      // Move to next column
      if (selectedCell) {
        const cell = grid.get(selectedCell);
        if (cell) {
          const nextKey = getCellKey(cell.row, cell.col + 1);
          setSelectedCell(nextKey);
          const nextCell = grid.get(nextKey);
          setEditValue(nextCell?.formula || nextCell?.value || '');
          setEditingCell(nextKey);
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [commitEdit, selectedCell, grid]);

  const getCellDisplay = useCallback((cell: CellData): string => {
    if (cell.error) return cell.error;
    if (cell.computedValue !== undefined) {
      if (typeof cell.computedValue === 'number') {
        return formatNumber(cell.computedValue);
      }
      return String(cell.computedValue);
    }
    return cell.value;
  }, []);

  return (
    <div className="overflow-auto border rounded-md bg-background">
      {/* Formula bar */}
      {selectedCell && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/50">
          <span className="font-mono text-sm font-medium w-12">{selectedCell}</span>
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => handleCellChange(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="font-mono text-sm h-8"
            placeholder="Ingrese valor o fórmula (ej: =A1+B1)"
            disabled={readOnly}
          />
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="border-collapse text-sm min-w-max">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="w-10 min-w-10 border p-1 text-center text-muted-foreground sticky left-0 bg-muted">
                
              </th>
              {Array.from({ length: cols }, (_, i) => (
                <th
                  key={i}
                  className="min-w-24 border p-1 text-center font-medium text-muted-foreground"
                >
                  {colToLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/30">
                <td className="border p-1 text-center text-muted-foreground bg-muted sticky left-0 font-mono text-xs">
                  {rowIndex + 1}
                </td>
                {Array.from({ length: cols }, (_, colIndex) => {
                  const key = getCellKey(rowIndex, colIndex);
                  const cell = grid.get(key);
                  const isSelected = selectedCell === key;
                  const isEditing = editingCell === key;

                  return (
                    <td
                      key={key}
                      className={cn(
                        'border p-0 cursor-pointer transition-colors',
                        isSelected && 'ring-2 ring-primary ring-inset',
                        cell?.error && 'bg-destructive/10',
                        cell?.cellType === 'header' && 'bg-muted font-semibold',
                      )}
                      onClick={() => handleCellClick(key)}
                    >
                      <div
                        className={cn(
                          'min-h-8 px-2 py-1 flex items-center',
                          cell?.cellType === 'number' || cell?.cellType === 'formula'
                            ? 'justify-end font-mono'
                            : 'justify-start',
                        )}
                      >
                        {isEditing ? (
                          <span className="text-primary/50">...</span>
                        ) : (
                          cell ? getCellDisplay(cell) : ''
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
