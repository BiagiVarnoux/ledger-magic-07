import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, FileSpreadsheet, Warehouse, ArrowLeftRight } from 'lucide-react';
import { ProductCatalog } from '@/components/inventory/ProductCatalog';
import { CostSheetManager } from '@/components/inventory/CostSheetManager';
import { InventoryManager } from '@/components/inventory/InventoryManager';

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sistema de Inventario</h1>
        <p className="text-muted-foreground">
          Gestiona productos, hojas de costeo e inventario
        </p>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Productos</span>
          </TabsTrigger>
          <TabsTrigger value="cost-sheets" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Hojas de Costeo</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            <span className="hidden sm:inline">Inventario</span>
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Movimientos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductCatalog />
        </TabsContent>

        <TabsContent value="cost-sheets">
          <CostSheetManager />
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryManager />
        </TabsContent>

        <TabsContent value="movements">
          <div className="text-center py-12 text-muted-foreground">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Movimientos de inventario</p>
            <p className="text-sm">Próximamente: Entradas, salidas y transferencias</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
