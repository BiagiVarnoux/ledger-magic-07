import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Package, X, Check } from 'lucide-react';

interface Product {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  unidad_medida: string;
}

interface ProductSelectorPanelProps {
  selectedProductIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onClose?: () => void;
}

export function ProductSelectorPanel({
  selectedProductIds,
  onSelectionChange,
  onClose,
}: ProductSelectorPanelProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, codigo, nombre, categoria, unidad_medida')
        .eq('is_active', true)
        .order('nombre');
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  const filteredProducts = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const toggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      onSelectionChange(selectedProductIds.filter((id) => id !== productId));
    } else {
      onSelectionChange([...selectedProductIds, productId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredProducts.map((p) => p.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" />
          Seleccionar Productos
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Seleccionar todos
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            Limpiar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedProductIds.length} de {products.length} productos seleccionados
        </p>
      </div>

      {/* Selected products summary */}
      {selectedProductIds.length > 0 && (
        <div className="p-3 border-b bg-muted/30">
          <p className="text-xs font-medium mb-2">Productos seleccionados:</p>
          <div className="flex flex-wrap gap-1">
            {selectedProducts.slice(0, 5).map((p) => (
              <Badge key={p.id} variant="secondary" className="text-xs">
                {p.codigo}
                <button
                  onClick={() => toggleProduct(p.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedProducts.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{selectedProducts.length - 5} más
              </Badge>
            )}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            Cargando productos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No se encontraron productos
          </div>
        ) : (
          <div className="divide-y">
            {filteredProducts.map((product) => {
              const isSelected = selectedProductIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => toggleProduct(product.id)}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {product.codigo}
                      </span>
                      <span className="font-medium truncate">{product.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{product.unidad_medida}</span>
                      {product.categoria && (
                        <>
                          <span>•</span>
                          <span>{product.categoria}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
