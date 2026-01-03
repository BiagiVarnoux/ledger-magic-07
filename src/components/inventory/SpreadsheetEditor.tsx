import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Type } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CellGrid,
  CellData,
  getCellKey,
  colToLetter,
  evaluateFormula,
  recalculateGrid,
  formatNumber,
} from '@/lib/spreadsheet-engine';

interface Product {
  id: string;
  codigo: string;
  nombre: string;
}

interface SpreadsheetEditorProps {
  grid: CellGrid;
  onGridChange: (grid: CellGrid) => void;
  initialRows?: number;
  initialCols?: number;
  readOnly?: boolean;
  selectedProducts?: Product[];
  headerRows?: number[];
  onHeaderRowsChange?: (rows: number[]) => void;
  showAutoNumbering?: boolean;
  showReservedColumns?: boolean;
}

export function SpreadsheetEditor({
  grid,
  onGridChange,
  initialRows = 30,
  initialCols = 8,
  readOnly = false,
  selectedProducts = [],
  headerRows = [0],
  onHeaderRowsChange,
  showAutoNumbering = true,
  showReservedColumns = true,
}: SpreadsheetEditorProps) {
  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate reserved column indices
  const productCol = showReservedColumns ? cols - 3 : -1;
  const priceCol = showReservedColumns ? cols - 2 : -1;
  const quantityCol = showReservedColumns ? cols - 1 : -1;

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  const isHeaderRow = useCallback((rowIndex: number) => {
    return headerRows.includes(rowIndex);
  }, [headerRows]);

  const toggleHeaderRow = useCallback((rowIndex: number) => {
    if (!onHeaderRowsChange) return;
    
    if (headerRows.includes(rowIndex)) {
      onHeaderRowsChange(headerRows.filter(r => r !== rowIndex));
    } else {
      onHeaderRowsChange([...headerRows, rowIndex].sort((a, b) => a - b));
    }
  }, [headerRows, onHeaderRowsChange]);

  const isReservedColumn = useCallback((colIndex: number) => {
    return showReservedColumns && (colIndex === productCol || colIndex === priceCol || colIndex === quantityCol);
  }, [showReservedColumns, productCol, priceCol, quantityCol]);

  const getColumnHeader = useCallback((colIndex: number) => {
    if (showReservedColumns) {
      if (colIndex === productCol) return 'Producto';
      if (colIndex === priceCol) return 'Precio U.';
      if (colIndex === quantityCol) return 'Cantidad';
    }
    return colToLetter(colIndex);
  }, [showReservedColumns, productCol, priceCol, quantityCol]);

  const handleCellClick = useCallback((key: string, rowIndex: number, colIndex: number) => {
    setSelectedCell(key);
    
    // Don't edit header rows (except for text content) or if readonly
    if (readOnly) return;
    
    const cell = grid.get(key);
    
    // For product columns, don't open text editor
    if (showReservedColumns && colIndex === productCol && !isHeaderRow(rowIndex)) {
      return;
    }
    
    setEditValue(cell?.formula || cell?.value || '');
    setEditingCell(key);
  }, [grid, readOnly, showReservedColumns, productCol, isHeaderRow]);

  const handleCellChange = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;

    const cell = grid.get(editingCell);
    if (!cell) return;

    const isFormula = editValue.startsWith('=');
    let cellType = cell.cellType;
    
    // Determine cell type
    if (isFormula) {
      cellType = 'formula';
    } else if (cell.cellType === 'price' || cell.cellType === 'quantity') {
      // Keep price/quantity type for reserved columns
    } else if (!isNaN(parseFloat(editValue)) && editValue.trim() !== '') {
      cellType = 'number';
    } else if (isHeaderRow(cell.row)) {
      cellType = 'header';
    } else {
      cellType = 'text';
    }

    const newCell: CellData = {
      ...cell,
      value: isFormula ? '' : editValue,
      formula: isFormula ? editValue : null,
      cellType,
    };

    const newGrid = new Map(grid);
    newGrid.set(editingCell, newCell);
    
    const recalculated = recalculateGrid(newGrid);
    onGridChange(recalculated);
    
    setEditingCell(null);
  }, [editingCell, editValue, grid, onGridChange, isHeaderRow]);

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

  const handleProductSelect = useCallback((rowIndex: number, productId: string) => {
    const key = getCellKey(rowIndex, productCol);
    const cell = grid.get(key);
    if (!cell) return;

    const product = selectedProducts.find(p => p.id === productId);
    
    const newCell: CellData = {
      ...cell,
      value: product?.nombre || '',
      productId: productId,
      cellType: 'product',
    };

    const newGrid = new Map(grid);
    newGrid.set(key, newCell);
    onGridChange(newGrid);
  }, [grid, onGridChange, productCol, selectedProducts]);

  const getProductName = useCallback((productId: string | undefined) => {
    if (!productId) return '';
    const product = selectedProducts.find(p => p.id === productId);
    return product?.nombre || '';
  }, [selectedProducts]);

  return (
    <div className="overflow-auto border rounded-md bg-background">
      {/* Controls bar */}
      {!readOnly && (
        <div className="flex items-center gap-4 p-2 border-b bg-muted/50 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Columnas:</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCols(Math.max(showReservedColumns ? 4 : 1, cols - 1))}
              disabled={cols <= (showReservedColumns ? 4 : 1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">{cols}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCols(cols + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filas:</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRows(Math.max(1, rows - 1))}
              disabled={rows <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">{rows}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRows(rows + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {selectedCell && onHeaderRowsChange && (
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const cell = grid.get(selectedCell);
                  if (cell) toggleHeaderRow(cell.row);
                }}
              >
                <Type className="h-4 w-4 mr-1" />
                {selectedCell && grid.get(selectedCell) && isHeaderRow(grid.get(selectedCell)!.row) 
                  ? 'Quitar título' 
                  : 'Convertir a título'}
              </Button>
            </div>
          )}
        </div>
      )}

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
              {/* Row number column */}
              {showAutoNumbering && (
                <th className="w-10 min-w-10 border p-1 text-center text-muted-foreground sticky left-0 bg-muted z-20">
                  #
                </th>
              )}
              {/* Data columns */}
              {Array.from({ length: cols }, (_, i) => (
                <th
                  key={i}
                  className={cn(
                    'min-w-24 border p-1 text-center font-medium text-muted-foreground',
                    isReservedColumn(i) && 'bg-primary/10 text-primary'
                  )}
                >
                  {getColumnHeader(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, rowIndex) => {
              const rowIsHeader = isHeaderRow(rowIndex);
              
              return (
                <tr key={rowIndex} className={cn(
                  'hover:bg-muted/30',
                  rowIsHeader && 'bg-muted/50'
                )}>
                  {/* Row number */}
                  {showAutoNumbering && (
                    <td className="border p-1 text-center text-muted-foreground bg-muted sticky left-0 font-mono text-xs z-10">
                      {rowIndex + 1}
                    </td>
                  )}
                  {/* Data cells */}
                  {Array.from({ length: cols }, (_, colIndex) => {
                    const key = getCellKey(rowIndex, colIndex);
                    const cell = grid.get(key);
                    const isSelected = selectedCell === key;
                    const isEditing = editingCell === key;
                    const isProductCell = showReservedColumns && colIndex === productCol && !rowIsHeader;
                    const isPriceCell = showReservedColumns && colIndex === priceCol && !rowIsHeader;
                    const isQuantityCell = showReservedColumns && colIndex === quantityCol && !rowIsHeader;

                    return (
                      <td
                        key={key}
                        className={cn(
                          'border p-0 cursor-pointer transition-colors',
                          isSelected && 'ring-2 ring-primary ring-inset',
                          cell?.error && 'bg-destructive/10',
                          rowIsHeader && 'bg-muted font-semibold',
                          isReservedColumn(colIndex) && !rowIsHeader && 'bg-primary/5',
                          (isPriceCell || isQuantityCell) && 'bg-accent/10'
                        )}
                        onClick={() => handleCellClick(key, rowIndex, colIndex)}
                      >
                        {/* Product dropdown cell */}
                        {isProductCell && !readOnly ? (
                          <Select
                            value={cell?.productId || ''}
                            onValueChange={(value) => handleProductSelect(rowIndex, value)}
                          >
                            <SelectTrigger className="h-8 border-0 bg-transparent font-normal">
                              <SelectValue placeholder="Seleccionar...">
                                {cell?.productId ? getProductName(cell.productId) : 'Seleccionar...'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              {selectedProducts.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">
                                  No hay productos seleccionados
                                </div>
                              ) : (
                                selectedProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <span className="font-mono text-xs text-muted-foreground mr-2">
                                      {product.codigo}
                                    </span>
                                    {product.nombre}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div
                            className={cn(
                              'min-h-8 px-2 py-1 flex items-center',
                              cell?.cellType === 'number' || 
                              cell?.cellType === 'formula' ||
                              cell?.cellType === 'price' ||
                              cell?.cellType === 'quantity'
                                ? 'justify-end font-mono'
                                : 'justify-start',
                            )}
                          >
                            {isEditing && !isProductCell ? (
                              <span className="text-primary/50">...</span>
                            ) : (
                              cell ? getCellDisplay(cell) : ''
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
