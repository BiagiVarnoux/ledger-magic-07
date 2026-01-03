/**
 * Spreadsheet Formula Engine
 * Supports Excel-like formulas: =SUM(A1:A10), =A1*B2, =AVERAGE(C1:C5), etc.
 */

export interface CellData {
  row: number;
  col: number;
  value: string;
  formula: string | null;
  cellType: 'text' | 'number' | 'formula' | 'header';
  computedValue?: string | number;
  error?: string;
}

export type CellGrid = Map<string, CellData>;

// Convert column index to letter (0 = A, 1 = B, etc.)
export function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

// Convert letter to column index (A = 0, B = 1, etc.)
export function letterToCol(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

// Get cell key from row and col
export function getCellKey(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

// Parse cell reference (e.g., "A1" -> { row: 0, col: 0 })
export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return {
    col: letterToCol(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1,
  };
}

// Parse range reference (e.g., "A1:A10" -> array of cell refs)
export function parseRange(range: string): { row: number; col: number }[] {
  const [start, end] = range.split(':');
  const startRef = parseCellRef(start);
  const endRef = parseCellRef(end);
  
  if (!startRef || !endRef) return [];
  
  const cells: { row: number; col: number }[] = [];
  const minRow = Math.min(startRef.row, endRef.row);
  const maxRow = Math.max(startRef.row, endRef.row);
  const minCol = Math.min(startRef.col, endRef.col);
  const maxCol = Math.max(startRef.col, endRef.col);
  
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push({ row, col });
    }
  }
  
  return cells;
}

// Get numeric value from cell
function getCellNumericValue(grid: CellGrid, row: number, col: number): number {
  const key = getCellKey(row, col);
  const cell = grid.get(key);
  if (!cell) return 0;
  
  const val = cell.computedValue ?? cell.value;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseFloat(val.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Built-in functions
const FUNCTIONS: Record<string, (args: number[]) => number> = {
  SUM: (args) => args.reduce((a, b) => a + b, 0),
  AVERAGE: (args) => args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0,
  MIN: (args) => args.length ? Math.min(...args) : 0,
  MAX: (args) => args.length ? Math.max(...args) : 0,
  COUNT: (args) => args.filter(x => !isNaN(x)).length,
  ABS: (args) => Math.abs(args[0] || 0),
  ROUND: (args) => Math.round(args[0] || 0),
  IF: (args) => args[0] ? args[1] : (args[2] || 0),
};

// Tokenize formula for evaluation
function tokenize(formula: string): string[] {
  const tokens: string[] = [];
  let current = '';
  
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    
    if ('+-*/(),:'.includes(char)) {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(char);
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

// Evaluate a formula expression
function evaluateExpression(expr: string, grid: CellGrid, visited: Set<string>): number {
  expr = expr.trim();
  
  // Check for function call
  const funcMatch = expr.match(/^([A-Z]+)\((.+)\)$/i);
  if (funcMatch) {
    const funcName = funcMatch[1].toUpperCase();
    const argsStr = funcMatch[2];
    const func = FUNCTIONS[funcName];
    
    if (!func) throw new Error(`Función desconocida: ${funcName}`);
    
    // Parse arguments (can be ranges or expressions)
    const args: number[] = [];
    let depth = 0;
    let currentArg = '';
    
    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        args.push(...resolveArg(currentArg.trim(), grid, visited));
        currentArg = '';
        continue;
      }
      currentArg += char;
    }
    
    if (currentArg.trim()) {
      args.push(...resolveArg(currentArg.trim(), grid, visited));
    }
    
    return func(args);
  }
  
  // Check for range (not in function context - return sum)
  if (expr.includes(':') && !expr.includes('(')) {
    const cells = parseRange(expr);
    return cells.reduce((sum, cell) => {
      return sum + getCellNumericValue(grid, cell.row, cell.col);
    }, 0);
  }
  
  // Check for cell reference
  const cellRef = parseCellRef(expr);
  if (cellRef) {
    const key = getCellKey(cellRef.row, cellRef.col);
    if (visited.has(key)) throw new Error('Referencia circular detectada');
    return getCellNumericValue(grid, cellRef.row, cellRef.col);
  }
  
  // Check for number
  const num = parseFloat(expr.replace(/,/g, ''));
  if (!isNaN(num)) return num;
  
  throw new Error(`Expresión inválida: ${expr}`);
}

// Resolve an argument (can be range, cell ref, or number)
function resolveArg(arg: string, grid: CellGrid, visited: Set<string>): number[] {
  arg = arg.trim();
  
  // Check for range
  if (arg.includes(':')) {
    const cells = parseRange(arg);
    return cells.map(cell => getCellNumericValue(grid, cell.row, cell.col));
  }
  
  // Single value
  return [evaluateExpression(arg, grid, visited)];
}

// Simple expression parser for arithmetic
function parseArithmetic(expr: string, grid: CellGrid, visited: Set<string>): number {
  // Handle parentheses first
  while (expr.includes('(')) {
    expr = expr.replace(/\(([^()]+)\)/g, (_, inner) => {
      return parseArithmetic(inner, grid, visited).toString();
    });
  }
  
  // Handle function calls
  const funcRegex = /([A-Z]+)\(([^)]+)\)/gi;
  while (funcRegex.test(expr)) {
    expr = expr.replace(funcRegex, (match) => {
      return evaluateExpression(match, grid, visited).toString();
    });
    funcRegex.lastIndex = 0;
  }
  
  // Replace cell references with values
  expr = expr.replace(/[A-Z]+\d+/gi, (ref) => {
    const cellRef = parseCellRef(ref);
    if (!cellRef) return '0';
    const key = getCellKey(cellRef.row, cellRef.col);
    if (visited.has(key)) throw new Error('Referencia circular detectada');
    return getCellNumericValue(grid, cellRef.row, cellRef.col).toString();
  });
  
  // Evaluate arithmetic expression
  try {
    // Safe eval: only allow numbers and operators
    const sanitized = expr.replace(/[^0-9+\-*/.,\s]/g, '');
    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${sanitized})`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch {
    return 0;
  }
}

// Main evaluation function
export function evaluateFormula(
  formula: string,
  grid: CellGrid,
  currentCell: string
): { value: string | number; error?: string } {
  if (!formula.startsWith('=')) {
    return { value: formula };
  }
  
  const expr = formula.slice(1).trim();
  const visited = new Set<string>([currentCell]);
  
  try {
    const result = parseArithmetic(expr, grid, visited);
    return { value: Math.round(result * 100) / 100 };
  } catch (error) {
    return { 
      value: '#ERROR', 
      error: error instanceof Error ? error.message : 'Error de cálculo' 
    };
  }
}

// Recalculate all cells in the grid
export function recalculateGrid(grid: CellGrid): CellGrid {
  const newGrid = new Map(grid);
  
  // First pass: evaluate all formulas
  for (const [key, cell] of newGrid) {
    if (cell.formula && cell.formula.startsWith('=')) {
      const result = evaluateFormula(cell.formula, newGrid, key);
      newGrid.set(key, {
        ...cell,
        computedValue: result.value,
        error: result.error,
      });
    } else if (cell.cellType === 'number' || !isNaN(parseFloat(cell.value))) {
      newGrid.set(key, {
        ...cell,
        computedValue: parseFloat(cell.value.replace(/,/g, '')) || 0,
      });
    } else {
      newGrid.set(key, {
        ...cell,
        computedValue: cell.value,
      });
    }
  }
  
  // Second pass for dependent formulas (simple dependency resolution)
  for (const [key, cell] of newGrid) {
    if (cell.formula && cell.formula.startsWith('=')) {
      const result = evaluateFormula(cell.formula, newGrid, key);
      newGrid.set(key, {
        ...cell,
        computedValue: result.value,
        error: result.error,
      });
    }
  }
  
  return newGrid;
}

// Format number for display
export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString('es-GT', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
}

// Create empty grid
export function createEmptyGrid(rows: number, cols: number): CellGrid {
  const grid: CellGrid = new Map();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = getCellKey(row, col);
      grid.set(key, {
        row,
        col,
        value: '',
        formula: null,
        cellType: 'text',
      });
    }
  }
  return grid;
}

// Convert grid to array for database storage
export function gridToArray(grid: CellGrid): Array<{
  row_index: number;
  col_index: number;
  value: string;
  formula: string | null;
  cell_type: string;
}> {
  const cells: Array<{
    row_index: number;
    col_index: number;
    value: string;
    formula: string | null;
    cell_type: string;
  }> = [];
  
  for (const [, cell] of grid) {
    if (cell.value || cell.formula) {
      cells.push({
        row_index: cell.row,
        col_index: cell.col,
        value: cell.value,
        formula: cell.formula,
        cell_type: cell.cellType,
      });
    }
  }
  
  return cells;
}

// Convert array from database to grid
export function arrayToGrid(
  cells: Array<{
    row_index: number;
    col_index: number;
    value: string | null;
    formula: string | null;
    cell_type: string;
  }>,
  rows: number = 50,
  cols: number = 10
): CellGrid {
  const grid = createEmptyGrid(rows, cols);
  
  for (const cell of cells) {
    const key = getCellKey(cell.row_index, cell.col_index);
    grid.set(key, {
      row: cell.row_index,
      col: cell.col_index,
      value: cell.value || '',
      formula: cell.formula,
      cellType: (cell.cell_type as CellData['cellType']) || 'text',
    });
  }
  
  return recalculateGrid(grid);
}
