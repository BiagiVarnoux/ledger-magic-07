import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Search, Package, Warehouse } from 'lucide-react';
import { formatNumber } from '@/lib/spreadsheet-engine';

interface Product {
  id: string;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  categoria: string | null;
}

interface InventoryLot {
  id: string;
  product_id: string;
  import_lot_id: string | null;
  cantidad_inicial: number;
  cantidad_disponible: number;
  costo_unitario: number;
  fecha_ingreso: string;
}

interface ImportLot {
  id: string;
  numero_lote: string | null;
  sheet_id: string | null;
}

export function InventoryManager() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, codigo, nombre, unidad_medida, categoria')
        .eq('is_active', true)
        .order('nombre');
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  const { data: inventoryLots = [], isLoading: loadingLots } = useQuery({
    queryKey: ['inventory_lots', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_lots')
        .select('*')
        .order('fecha_ingreso', { ascending: false });
      
      if (error) throw error;
      return data as InventoryLot[];
    },
    enabled: !!user,
  });

  const { data: importLots = [] } = useQuery({
    queryKey: ['import_lots', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_lots')
        .select('id, numero_lote, sheet_id');
      
      if (error) throw error;
      return data as ImportLot[];
    },
    enabled: !!user,
  });

  // Group lots by product
  const productInventory = products
    .map((product) => {
      const lots = inventoryLots.filter((lot) => lot.product_id === product.id);
      const totalStock = lots.reduce((sum, lot) => sum + lot.cantidad_disponible, 0);
      const totalValue = lots.reduce(
        (sum, lot) => sum + lot.cantidad_disponible * lot.costo_unitario,
        0
      );
      const avgCost = totalStock > 0 ? totalValue / totalStock : 0;
      
      return {
        ...product,
        lots,
        totalStock,
        totalValue,
        avgCost,
      };
    })
    .filter((p) => p.lots.length > 0 || searchTerm); // Only show products with inventory unless searching

  const filteredProducts = productInventory.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate totals
  const totalInventoryValue = filteredProducts.reduce(
    (sum, p) => sum + p.totalValue,
    0
  );
  const totalProducts = filteredProducts.filter((p) => p.totalStock > 0).length;

  const isLoading = loadingProducts || loadingLots;

  const getImportLotNumber = (importLotId: string | null) => {
    if (!importLotId) return '-';
    const lot = importLots.find((l) => l.id === importLotId);
    return lot?.numero_lote || 'Sin número';
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Warehouse className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
        <p>Cargando inventario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              productos con existencia
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Q{formatNumber(totalInventoryValue)}</div>
            <p className="text-xs text-muted-foreground">
              valor estimado en quetzales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lotes Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inventoryLots.filter((l) => l.cantidad_disponible > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              lotes con existencia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Inventory by Product */}
      {filteredProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay inventario registrado</p>
            <p className="text-sm text-muted-foreground">
              Finaliza una hoja de costeo para crear lotes de inventario
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {filteredProducts.map((product) => (
            <AccordionItem
              key={product.id}
              value={product.id}
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full mr-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {product.codigo}
                        </span>
                        <span className="font-medium">{product.nombre}</span>
                      </div>
                      {product.categoria && (
                        <span className="text-xs text-muted-foreground">
                          {product.categoria}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="font-semibold">
                        {formatNumber(product.totalStock, 0)} {product.unidad_medida}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Existencia
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">
                        Q{formatNumber(product.avgCost)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Costo Prom.
                      </div>
                    </div>
                    <Badge variant={product.totalStock > 0 ? 'default' : 'secondary'}>
                      {product.lots.length} lotes
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha Ingreso</TableHead>
                      <TableHead>Lote Importación</TableHead>
                      <TableHead className="text-right">Cant. Inicial</TableHead>
                      <TableHead className="text-right">Disponible</TableHead>
                      <TableHead className="text-right">Costo Unit.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>
                          {new Date(lot.fecha_ingreso).toLocaleDateString('es-GT')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {getImportLotNumber(lot.import_lot_id)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(lot.cantidad_inicial, 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(lot.cantidad_disponible, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          Q{formatNumber(lot.costo_unitario)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          Q{formatNumber(lot.cantidad_disponible * lot.costo_unitario)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(product.totalStock, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        Q{formatNumber(product.avgCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        Q{formatNumber(product.totalValue)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
