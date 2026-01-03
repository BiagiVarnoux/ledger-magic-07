import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, FileSpreadsheet, Pencil, Trash2, Eye } from 'lucide-react';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import {
  CellGrid,
  createEmptyGrid,
  gridToArray,
  arrayToGrid,
  getCellKey,
} from '@/lib/spreadsheet-engine';

interface CostSheet {
  id: string;
  nombre: string;
  fecha: string;
  referencia_importacion: string | null;
  status: 'borrador' | 'finalizada';
  user_id: string;
  created_at: string;
}

const IMPORT_TEMPLATE = [
  // Header row
  { row: 0, col: 0, value: 'HOJA DE COSTEO DE IMPORTACIÓN', cellType: 'header' as const },
  // Column headers
  { row: 2, col: 0, value: 'Descripción', cellType: 'header' as const },
  { row: 2, col: 1, value: 'Cantidad', cellType: 'header' as const },
  { row: 2, col: 2, value: 'Precio Unit.', cellType: 'header' as const },
  { row: 2, col: 3, value: 'Subtotal', cellType: 'header' as const },
  // Product rows placeholders
  { row: 3, col: 0, value: 'Producto 1', cellType: 'text' as const },
  { row: 3, col: 1, value: '0', cellType: 'number' as const },
  { row: 3, col: 2, value: '0', cellType: 'number' as const },
  { row: 3, col: 3, value: '', formula: '=B4*C4', cellType: 'formula' as const },
  { row: 4, col: 0, value: 'Producto 2', cellType: 'text' as const },
  { row: 4, col: 1, value: '0', cellType: 'number' as const },
  { row: 4, col: 2, value: '0', cellType: 'number' as const },
  { row: 4, col: 3, value: '', formula: '=B5*C5', cellType: 'formula' as const },
  // FOB Total
  { row: 6, col: 0, value: 'TOTAL FOB', cellType: 'header' as const },
  { row: 6, col: 3, value: '', formula: '=SUM(D4:D5)', cellType: 'formula' as const },
  // Shipping costs
  { row: 8, col: 0, value: 'FLETE', cellType: 'text' as const },
  { row: 8, col: 3, value: '0', cellType: 'number' as const },
  { row: 9, col: 0, value: 'SEGURO (1% CIF)', cellType: 'text' as const },
  { row: 9, col: 3, value: '', formula: '=D7*0.01', cellType: 'formula' as const },
  // CIF
  { row: 11, col: 0, value: 'TOTAL CIF', cellType: 'header' as const },
  { row: 11, col: 3, value: '', formula: '=D7+D9+D10', cellType: 'formula' as const },
  // Duties
  { row: 13, col: 0, value: 'DAI (Arancel)', cellType: 'text' as const },
  { row: 13, col: 1, value: '15', cellType: 'number' as const },
  { row: 13, col: 2, value: '%', cellType: 'text' as const },
  { row: 13, col: 3, value: '', formula: '=D12*B14/100', cellType: 'formula' as const },
  { row: 14, col: 0, value: 'IVA', cellType: 'text' as const },
  { row: 14, col: 1, value: '12', cellType: 'number' as const },
  { row: 14, col: 2, value: '%', cellType: 'text' as const },
  { row: 14, col: 3, value: '', formula: '=(D12+D14)*B15/100', cellType: 'formula' as const },
  // Local costs
  { row: 16, col: 0, value: 'AGENTE ADUANAL', cellType: 'text' as const },
  { row: 16, col: 3, value: '0', cellType: 'number' as const },
  { row: 17, col: 0, value: 'TRANSPORTE LOCAL', cellType: 'text' as const },
  { row: 17, col: 3, value: '0', cellType: 'number' as const },
  { row: 18, col: 0, value: 'OTROS GASTOS', cellType: 'text' as const },
  { row: 18, col: 3, value: '0', cellType: 'number' as const },
  // Total
  { row: 20, col: 0, value: 'COSTO TOTAL', cellType: 'header' as const },
  { row: 20, col: 3, value: '', formula: '=D12+D14+D15+D17+D18+D19', cellType: 'formula' as const },
];

export function CostSheetManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CostSheet | null>(null);
  const [grid, setGrid] = useState<CellGrid>(createEmptyGrid(30, 8));
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetRef, setNewSheetRef] = useState('');

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ['cost_sheets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_sheets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CostSheet[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async ({
      nombre,
      referencia,
      useTemplate,
    }: {
      nombre: string;
      referencia: string;
      useTemplate: boolean;
    }) => {
      // Create the sheet
      const { data: sheet, error: sheetError } = await supabase
        .from('cost_sheets')
        .insert({
          nombre,
          referencia_importacion: referencia || null,
          user_id: user!.id,
        })
        .select()
        .single();

      if (sheetError) throw sheetError;

      // If using template, add the template cells
      if (useTemplate) {
        const cells = IMPORT_TEMPLATE.map((cell) => ({
          sheet_id: sheet.id,
          row_index: cell.row,
          col_index: cell.col,
          value: cell.value,
          formula: cell.formula || null,
          cell_type: cell.cellType,
          user_id: user!.id,
        }));

        const { error: cellsError } = await supabase
          .from('cost_sheet_cells')
          .insert(cells);

        if (cellsError) throw cellsError;
      }

      return sheet;
    },
    onSuccess: (sheet) => {
      queryClient.invalidateQueries({ queryKey: ['cost_sheets'] });
      toast.success('Hoja de costeo creada');
      setIsCreateOpen(false);
      setNewSheetName('');
      setNewSheetRef('');
      // Open the editor
      openSheetEditor(sheet);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cost_sheets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_sheets'] });
      toast.success('Hoja eliminada');
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const saveCellsMutation = useMutation({
    mutationFn: async ({ sheetId, cells }: { sheetId: string; cells: ReturnType<typeof gridToArray> }) => {
      // Delete existing cells
      await supabase.from('cost_sheet_cells').delete().eq('sheet_id', sheetId);

      // Insert new cells
      if (cells.length > 0) {
        const { error } = await supabase.from('cost_sheet_cells').insert(
          cells.map((cell) => ({
            sheet_id: sheetId,
            ...cell,
            user_id: user!.id,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Cambios guardados');
    },
    onError: (error: Error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  const openSheetEditor = async (sheet: CostSheet) => {
    setSelectedSheet(sheet);
    
    // Load cells
    const { data: cells } = await supabase
      .from('cost_sheet_cells')
      .select('*')
      .eq('sheet_id', sheet.id);

    if (cells && cells.length > 0) {
      setGrid(arrayToGrid(cells));
    } else {
      setGrid(createEmptyGrid(30, 8));
    }
    
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (!selectedSheet) return;
    const cells = gridToArray(grid);
    saveCellsMutation.mutate({ sheetId: selectedSheet.id, cells });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Hojas de Costeo</h3>
          <p className="text-sm text-muted-foreground">
            Crea hojas tipo Excel para calcular costos de importación
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Hoja
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Hoja de Costeo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la Hoja *</Label>
                <Input
                  id="nombre"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="Importación Enero 2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referencia">Referencia de Importación</Label>
                <Input
                  id="referencia"
                  value={newSheetRef}
                  onChange={(e) => setNewSheetRef(e.target.value)}
                  placeholder="IMP-2026-001"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    createMutation.mutate({
                      nombre: newSheetName,
                      referencia: newSheetRef,
                      useTemplate: true,
                    })
                  }
                  disabled={!newSheetName}
                >
                  Usar Plantilla
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    createMutation.mutate({
                      nombre: newSheetName,
                      referencia: newSheetRef,
                      useTemplate: false,
                    })
                  }
                  disabled={!newSheetName}
                >
                  Hoja en Blanco
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Cargando hojas...
        </div>
      ) : sheets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay hojas de costeo</p>
            <p className="text-sm text-muted-foreground">
              Crea tu primera hoja para calcular costos de importación
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sheets.map((sheet) => (
            <Card key={sheet.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{sheet.nombre}</CardTitle>
                    <CardDescription>
                      {new Date(sheet.fecha).toLocaleDateString('es-GT')}
                    </CardDescription>
                  </div>
                  <Badge variant={sheet.status === 'finalizada' ? 'default' : 'secondary'}>
                    {sheet.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {sheet.referencia_importacion && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Ref: {sheet.referencia_importacion}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSheetEditor(sheet)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Abrir
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('¿Eliminar esta hoja de costeo?')) {
                        deleteMutation.mutate(sheet.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Spreadsheet Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedSheet?.nombre}</span>
              <Button onClick={handleSave} disabled={saveCellsMutation.isPending}>
                Guardar Cambios
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <SpreadsheetEditor
              grid={grid}
              onGridChange={setGrid}
              initialRows={30}
              initialCols={8}
            />
          </div>
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <p>
              <strong>Fórmulas soportadas:</strong> =A1+B1, =A1*B1, =SUM(A1:A10), =AVERAGE(B1:B5)
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
