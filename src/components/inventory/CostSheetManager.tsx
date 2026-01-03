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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, FileSpreadsheet, Trash2, Eye, Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import { ProductSelectorPanel } from './ProductSelectorPanel';
import {
  CellGrid,
  createEmptyGrid,
  gridToArray,
  arrayToGrid,
  extractProductRows,
  SheetMetadata,
  createDefaultMetadata,
} from '@/lib/spreadsheet-engine';

interface CostSheet {
  id: string;
  nombre: string;
  fecha: string;
  referencia_importacion: string | null;
  status: 'borrador' | 'finalizada';
  user_id: string;
  created_at: string;
  metadata: SheetMetadata | null;
}

interface Product {
  id: string;
  codigo: string;
  nombre: string;
  unidad_medida: string;
}

const DEFAULT_COLS = 8;
const DEFAULT_ROWS = 30;

export function CostSheetManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CostSheet | null>(null);
  const [grid, setGrid] = useState<CellGrid>(createEmptyGrid(DEFAULT_ROWS, DEFAULT_COLS));
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetRef, setNewSheetRef] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [headerRows, setHeaderRows] = useState<number[]>([0]);
  const [sheetCols, setSheetCols] = useState(DEFAULT_COLS);

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

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, codigo, nombre, unidad_medida')
        .eq('is_active', true)
        .order('nombre');
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  const selectedProducts = allProducts.filter(p => selectedProductIds.includes(p.id));

  const createMutation = useMutation({
    mutationFn: async ({
      nombre,
      referencia,
    }: {
      nombre: string;
      referencia: string;
    }) => {
      const metadata = createDefaultMetadata();
      
      const { data: sheet, error: sheetError } = await supabase
        .from('cost_sheets')
        .insert({
          nombre,
          referencia_importacion: referencia || null,
          user_id: user!.id,
          metadata: metadata as unknown as Record<string, unknown>,
        })
        .select()
        .single();

      if (sheetError) throw sheetError;
      return sheet;
    },
    onSuccess: (sheet) => {
      queryClient.invalidateQueries({ queryKey: ['cost_sheets'] });
      toast.success('Hoja de costeo creada');
      setIsCreateOpen(false);
      setNewSheetName('');
      setNewSheetRef('');
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
    mutationFn: async ({ 
      sheetId, 
      cells, 
      metadata 
    }: { 
      sheetId: string; 
      cells: ReturnType<typeof gridToArray>;
      metadata: SheetMetadata;
    }) => {
      // Delete existing cells
      await supabase.from('cost_sheet_cells').delete().eq('sheet_id', sheetId);

      // Insert new cells
      if (cells.length > 0) {
        const { error } = await supabase.from('cost_sheet_cells').insert(
          cells.map((cell) => ({
            sheet_id: sheetId,
            row_index: cell.row_index,
            col_index: cell.col_index,
            value: cell.value,
            formula: cell.formula,
            cell_type: cell.cell_type,
            style: cell.style,
            user_id: user!.id,
          }))
        );
        if (error) throw error;
      }

      // Update metadata
      const { error: metaError } = await supabase
        .from('cost_sheets')
        .update({ metadata: metadata as unknown as Record<string, unknown> })
        .eq('id', sheetId);
      
      if (metaError) throw metaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_sheets'] });
      toast.success('Cambios guardados');
    },
    onError: (error: Error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async ({ 
      sheetId, 
      productRows,
      sheetName,
    }: { 
      sheetId: string; 
      productRows: Array<{ productId: string; price: number; quantity: number }>;
      sheetName: string;
    }) => {
      // Create import lots and inventory lots for each product row
      for (const row of productRows) {
        // Create import lot
        const { data: importLot, error: importError } = await supabase
          .from('import_lots')
          .insert({
            product_id: row.productId,
            cantidad: row.quantity,
            costo_unitario: row.price,
            costo_total: row.quantity * row.price,
            sheet_id: sheetId,
            numero_lote: sheetName,
            user_id: user!.id,
          })
          .select()
          .single();

        if (importError) throw importError;

        // Create inventory lot
        const { error: invError } = await supabase
          .from('inventory_lots')
          .insert({
            product_id: row.productId,
            import_lot_id: importLot.id,
            cantidad_inicial: row.quantity,
            cantidad_disponible: row.quantity,
            costo_unitario: row.price,
            user_id: user!.id,
          });

        if (invError) throw invError;
      }

      // Update sheet status
      const { error: statusError } = await supabase
        .from('cost_sheets')
        .update({ status: 'finalizada' })
        .eq('id', sheetId);

      if (statusError) throw statusError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_sheets'] });
      queryClient.invalidateQueries({ queryKey: ['import_lots'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_lots'] });
      toast.success('Hoja finalizada y lotes creados');
      setIsEditorOpen(false);
      setSelectedSheet(null);
    },
    onError: (error: Error) => {
      toast.error(`Error al finalizar: ${error.message}`);
    },
  });

  const openSheetEditor = async (sheet: CostSheet) => {
    setSelectedSheet(sheet);
    
    // Load metadata
    const metadata = (sheet.metadata as SheetMetadata) || createDefaultMetadata();
    setSelectedProductIds(metadata.selectedProductIds || []);
    setHeaderRows(metadata.headerRows || [0]);
    
    // Load cells
    const { data: cells } = await supabase
      .from('cost_sheet_cells')
      .select('*')
      .eq('sheet_id', sheet.id);

    // Determine cols from cells or default
    let maxCol = DEFAULT_COLS;
    if (cells && cells.length > 0) {
      maxCol = Math.max(DEFAULT_COLS, ...cells.map(c => c.col_index + 1));
    }
    setSheetCols(maxCol);

    if (cells && cells.length > 0) {
      const cellsWithStyle = cells.map(c => ({
        ...c,
        style: c.style as { productId?: string } | null,
      }));
      setGrid(arrayToGrid(cellsWithStyle, DEFAULT_ROWS, maxCol));
    } else {
      setGrid(createEmptyGrid(DEFAULT_ROWS, maxCol));
    }
    
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (!selectedSheet) return;
    
    const cells = gridToArray(grid);
    const metadata: SheetMetadata = {
      selectedProductIds,
      headerRows,
      autoNumberColumn: true,
      reservedColumnsEnabled: true,
    };
    
    saveCellsMutation.mutate({ 
      sheetId: selectedSheet.id, 
      cells,
      metadata,
    });
  };

  const handleFinalize = () => {
    if (!selectedSheet) return;
    
    const productRows = extractProductRows(grid, sheetCols);
    
    if (productRows.length === 0) {
      toast.error('No hay productos con precio y cantidad válidos para crear lotes');
      return;
    }

    // Validate all rows have price and quantity
    const invalidRows = productRows.filter(r => r.price <= 0 || r.quantity <= 0);
    if (invalidRows.length > 0) {
      toast.error('Algunos productos tienen precio o cantidad inválidos');
      return;
    }

    if (confirm(`¿Finalizar hoja y crear ${productRows.length} lotes de inventario?`)) {
      finalizeMutation.mutate({
        sheetId: selectedSheet.id,
        productRows,
        sheetName: selectedSheet.nombre,
      });
    }
  };

  const productRowsPreview = extractProductRows(grid, sheetCols);

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
              <Button
                onClick={() => createMutation.mutate({
                  nombre: newSheetName,
                  referencia: newSheetRef,
                })}
                disabled={!newSheetName || createMutation.isPending}
                className="w-full"
              >
                Crear Hoja
              </Button>
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
                    {sheet.status === 'finalizada' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Finalizada
                      </>
                    ) : 'Borrador'}
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
                  {sheet.status !== 'finalizada' && (
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
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Spreadsheet Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span>{selectedSheet?.nombre}</span>
                {selectedSheet?.status === 'finalizada' && (
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Finalizada
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedSheet?.status !== 'finalizada' && (
                  <>
                    <Sheet open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Package className="h-4 w-4 mr-1" />
                          Productos ({selectedProductIds.length})
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0">
                        <ProductSelectorPanel
                          selectedProductIds={selectedProductIds}
                          onSelectionChange={setSelectedProductIds}
                          onClose={() => setIsProductSelectorOpen(false)}
                        />
                      </SheetContent>
                    </Sheet>
                    <Button 
                      onClick={handleSave} 
                      disabled={saveCellsMutation.isPending}
                      variant="outline"
                    >
                      Guardar
                    </Button>
                    <Button 
                      onClick={handleFinalize}
                      disabled={finalizeMutation.isPending || productRowsPreview.length === 0}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Finalizar ({productRowsPreview.length} productos)
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {/* Validation preview */}
          {selectedSheet?.status !== 'finalizada' && productRowsPreview.length > 0 && (
            <div className="px-4 py-2 bg-accent/50 rounded-md text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                {productRowsPreview.length} productos listos para crear lotes de inventario
              </span>
            </div>
          )}
          
          {selectedSheet?.status !== 'finalizada' && selectedProductIds.length === 0 && (
            <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-md text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>
                Selecciona productos para poder asignarlos a las filas de la hoja
              </span>
            </div>
          )}
          
          <div className="flex-1 overflow-auto">
            <SpreadsheetEditor
              grid={grid}
              onGridChange={setGrid}
              initialRows={DEFAULT_ROWS}
              initialCols={sheetCols}
              readOnly={selectedSheet?.status === 'finalizada'}
              selectedProducts={selectedProducts}
              headerRows={headerRows}
              onHeaderRowsChange={selectedSheet?.status !== 'finalizada' ? setHeaderRows : undefined}
              showAutoNumbering={true}
              showReservedColumns={true}
            />
          </div>
          <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
            <p>
              <strong>Fórmulas:</strong> =A1+B1, =SUM(A1:A10), =AVERAGE(B1:B5)
            </p>
            <p>
              <strong>Columnas reservadas:</strong> Las últimas 3 columnas (Producto, Precio U., Cantidad) se vinculan al inventario
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
