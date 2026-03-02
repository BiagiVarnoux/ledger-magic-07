import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Account, ACCOUNT_TYPES, SIDES, CLASIFICACION_RESULTADO, CLASIFICACION_FLUJO } from '@/accounting/types';

interface AccountsBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (accounts: Account[]) => Promise<void>;
  existingAccounts: Account[];
}

const CSV_HEADERS = [
  'codigo', 'nombre', 'tipo', 'lado_normal', 'activa',
  'clasificacion_resultado', 'subclasificacion_resultado', 'clasificacion_flujo',
  'es_efectivo', 'es_corriente', 'es_partida_no_monetaria', 'es_capital_trabajo',
  'es_financiera', 'es_extraordinaria', 'afecta_ebitda',
];

function generateTemplate(): string {
  const headers = CSV_HEADERS.join(',');
  const examples = [
    'A.1,Caja MN,ACTIVO,DEBE,true,,,,true,true,false,true,false,false,true',
    'B.1,Cuentas por Pagar,PASIVO,HABER,true,,,no_aplica,false,true,false,true,false,false,true',
    'I.1,Ventas,INGRESO,HABER,true,ingreso_operativo,ventas,no_aplica,false,,false,false,false,false,true',
    'G.1,Gastos Administrativos,GASTO,DEBE,true,gasto_operativo,administrativos,no_aplica,false,,false,false,false,false,true',
  ];
  return [headers, ...examples].join('\n');
}

function parseBool(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'si' || v === 'sí' || v === 'yes';
}

function parseBoolOrNull(val: string): boolean | null {
  const v = val.trim().toLowerCase();
  if (v === '' || v === 'auto') return null;
  return parseBool(val);
}

interface ParsedRow {
  account: Account;
  errors: string[];
  isNew: boolean;
}

function parseCSV(csv: string, existingIds: Set<string>): ParsedRow[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  // Skip header
  const dataLines = lines.slice(1);
  return dataLines.map((line, idx) => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const errors: string[] = [];

    const id = cols[0] || '';
    const name = cols[1] || '';
    const type = (cols[2] || '').toUpperCase();
    const side = (cols[3] || '').toUpperCase();
    const isActive = cols[4] !== undefined ? parseBool(cols[4]) : true;

    if (!id) errors.push('Código vacío');
    if (!name) errors.push('Nombre vacío');
    if (!ACCOUNT_TYPES.includes(type as any)) errors.push(`Tipo inválido: ${type}`);
    if (!SIDES.includes(side as any)) errors.push(`Lado inválido: ${side}`);

    const clasificacionResultado = cols[5] || null;
    if (clasificacionResultado && !CLASIFICACION_RESULTADO.includes(clasificacionResultado as any)) {
      errors.push(`Clasificación resultado inválida: ${clasificacionResultado}`);
    }

    const subclasificacionResultado = cols[6] || null;
    const clasificacionFlujo = cols[7] || 'no_aplica';
    if (clasificacionFlujo && !CLASIFICACION_FLUJO.includes(clasificacionFlujo as any)) {
      errors.push(`Clasificación flujo inválida: ${clasificacionFlujo}`);
    }

    const account: Account = {
      id,
      name,
      type: type as any,
      normal_side: side as any,
      is_active: isActive,
      clasificacion_resultado: clasificacionResultado as any,
      subclasificacion_resultado: subclasificacionResultado as any,
      clasificacion_flujo: clasificacionFlujo as any,
      is_cash_equivalent: cols[8] !== undefined ? parseBool(cols[8]) : false,
      is_current: cols[9] !== undefined ? parseBoolOrNull(cols[9]) : null,
      es_partida_no_monetaria: cols[10] !== undefined ? parseBool(cols[10]) : false,
      es_capital_trabajo: cols[11] !== undefined ? parseBool(cols[11]) : false,
      es_financiera: cols[12] !== undefined ? parseBool(cols[12]) : false,
      es_extraordinaria: cols[13] !== undefined ? parseBool(cols[13]) : false,
      afecta_ebitda: cols[14] !== undefined ? parseBool(cols[14]) : true,
    };

    return { account, errors, isNew: !existingIds.has(id) };
  });
}

export function AccountsBulkUploadModal({ isOpen, onClose, onImport, existingAccounts }: AccountsBulkUploadModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const existingIds = new Set(existingAccounts.map(a => a.id));

  function handleDownloadTemplate() {
    const csv = generateTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_plan_cuentas.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text, existingIds);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const valid = parsedRows.filter(r => r.errors.length === 0);
    if (valid.length === 0) { toast.error('No hay filas válidas para importar'); return; }
    setImporting(true);
    try {
      await onImport(valid.map(r => r.account));
      toast.success(`${valid.length} cuentas importadas correctamente`);
      setParsedRows([]);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Error importando cuentas');
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setParsedRows([]);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  const validCount = parsedRows.filter(r => r.errors.length === 0).length;
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carga Masiva de Cuentas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />Descargar Plantilla CSV
            </Button>
            <div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Formatos de booleanos aceptados: true/false, 1/0, si/no, yes/no. Dejar vacío para usar valor por defecto.
          </p>

          {parsedRows.length > 0 && (
            <>
              <div className="flex gap-3 items-center">
                <Badge variant="default" className="gap-1"><CheckCircle2 className="w-3 h-3" />{validCount} válidas</Badge>
                {errorCount > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />{errorCount} con errores</Badge>}
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Clasif. Resultado</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((r, i) => (
                      <TableRow key={i} className={r.errors.length > 0 ? 'bg-destructive/10' : ''}>
                        <TableCell className="font-mono">{r.account.id}</TableCell>
                        <TableCell>{r.account.name}</TableCell>
                        <TableCell>{r.account.type}</TableCell>
                        <TableCell>{r.account.clasificacion_resultado || '—'}</TableCell>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <span className="text-xs text-destructive">{r.errors.join('; ')}</span>
                          ) : (
                            <Badge variant={r.isNew ? 'default' : 'secondary'}>
                              {r.isNew ? 'Nueva' : 'Actualizar'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {parsedRows.length > 0 && validCount > 0 && (
            <Button onClick={handleImport} disabled={importing}>
              <Upload className="w-4 h-4 mr-2" />
              {importing ? 'Importando...' : `Importar ${validCount} cuentas`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
