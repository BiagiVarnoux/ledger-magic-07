import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { KardexMovement } from '@/accounting/types';
import { supabase } from '@/integrations/supabase/client';
import { fmt, todayISO } from '@/accounting/utils';

export function KardexCPP() {
  const { accounts } = useAccounting();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [kardexId, setKardexId] = useState<string>('');
  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fecha: todayISO(),
    concepto: '',
    entrada: '0',
    salidas: '0',
    costo_total: '0',
  });

  // Filter for active asset accounts only
  const assetAccounts = useMemo(() => 
    accounts.filter(a => a.is_active && a.type === 'ACTIVO'),
    [accounts]
  );

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Load or create kardex when account is selected
  useEffect(() => {
    if (!selectedAccountId) {
      setKardexId('');
      setMovements([]);
      return;
    }

    const loadKardex = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Try to find existing kardex for this account
        const { data: existingKardex, error: kardexError } = await supabase
          .from('kardex_entries')
          .select('id')
          .eq('account_id', selectedAccountId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (kardexError) throw kardexError;

        let currentKardexId = existingKardex?.id;

        // If no kardex exists, create one
        if (!currentKardexId) {
          const { data: newKardex, error: createError } = await supabase
            .from('kardex_entries')
            .insert({
              account_id: selectedAccountId,
              user_id: user.id
            })
            .select()
            .single();

          if (createError) throw createError;
          currentKardexId = newKardex.id;
        }

        setKardexId(currentKardexId);

        // Load movements
        const { data: movementsData, error: movError } = await supabase
          .from('kardex_movements')
          .select('*')
          .eq('kardex_id', currentKardexId)
          .order('fecha', { ascending: true });

        if (movError) throw movError;
        setMovements(movementsData || []);
      } catch (error: any) {
        toast.error('Error al cargar kárdex: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadKardex();
  }, [selectedAccountId]);

  // Calculate CPP for each movement
  const movementsWithCPP = useMemo(() => {
    let saldoAcumulado = 0;
    let saldoValoradoAcumulado = 0;

    return movements.map((mov) => {
      const entrada = mov.entrada || 0;
      const salidas = mov.salidas || 0;
      const costoTotal = mov.costo_total || 0;

      // Para entradas: calcular nuevo CPP
      if (entrada > 0) {
        saldoValoradoAcumulado += costoTotal;
        saldoAcumulado += entrada;
        
        const nuevoCPP = saldoAcumulado > 0 ? saldoValoradoAcumulado / saldoAcumulado : 0;
        
        return {
          ...mov,
          saldo: saldoAcumulado,
          costo_unitario: nuevoCPP,
          saldo_valorado: saldoValoradoAcumulado
        };
      }

      // Para salidas: usar CPP actual
      if (salidas > 0) {
        const cppActual = saldoAcumulado > 0 ? saldoValoradoAcumulado / saldoAcumulado : 0;
        saldoAcumulado -= salidas;
        const costoSalida = salidas * cppActual;
        saldoValoradoAcumulado -= costoSalida;

        return {
          ...mov,
          saldo: saldoAcumulado,
          costo_unitario: cppActual,
          costo_total: costoSalida,
          saldo_valorado: saldoValoradoAcumulado
        };
      }

      return {
        ...mov,
        saldo: saldoAcumulado,
        costo_unitario: saldoAcumulado > 0 ? saldoValoradoAcumulado / saldoAcumulado : 0,
        saldo_valorado: saldoValoradoAcumulado
      };
    });
  }, [movements]);

  const handleOpenModal = () => {
    setFormData({
      fecha: todayISO(),
      concepto: '',
      entrada: '0',
      salidas: '0',
      costo_total: '0',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!kardexId) {
      toast.error('Selecciona una cuenta primero');
      return;
    }

    if (!formData.concepto.trim()) {
      toast.error('El concepto es requerido');
      return;
    }

    const entrada = parseFloat(formData.entrada) || 0;
    const salidas = parseFloat(formData.salidas) || 0;

    if (entrada === 0 && salidas === 0) {
      toast.error('Debe haber entrada o salida');
      return;
    }

    if (entrada > 0 && salidas > 0) {
      toast.error('No puede haber entrada y salida al mismo tiempo');
      return;
    }

    const costoTotal = parseFloat(formData.costo_total) || 0;

    if (entrada > 0 && costoTotal === 0) {
      toast.error('Para entradas, el costo total es requerido');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('kardex_movements')
        .insert({
          kardex_id: kardexId,
          user_id: user.id,
          fecha: formData.fecha,
          concepto: formData.concepto.trim(),
          entrada,
          salidas,
          costo_total: costoTotal,
          saldo: 0, // Will be recalculated
          costo_unitario: 0, // Will be recalculated
          saldo_valorado: 0 // Will be recalculated
        });

      if (error) throw error;

      // Reload movements
      const { data: movementsData, error: movError } = await supabase
        .from('kardex_movements')
        .select('*')
        .eq('kardex_id', kardexId)
        .order('fecha', { ascending: true });

      if (movError) throw movError;
      setMovements(movementsData || []);
      
      toast.success('Movimiento agregado exitosamente');
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return;

    try {
      const { error } = await supabase
        .from('kardex_movements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Reload movements
      const { data: movementsData, error: movError } = await supabase
        .from('kardex_movements')
        .select('*')
        .eq('kardex_id', kardexId)
        .order('fecha', { ascending: true });

      if (movError) throw movError;
      setMovements(movementsData || []);
      
      toast.success('Movimiento eliminado');
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message);
    }
  };

  const handleExport = () => {
    if (movementsWithCPP.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = ['Fecha', 'Concepto', 'Entrada', 'Salidas', 'Saldo', 'Costo Unitario', 'Costo Total', 'Saldo Valorado'];
    const rows = movementsWithCPP.map(m => [
      m.fecha,
      m.concepto,
      m.entrada.toString(),
      m.salidas.toString(),
      m.saldo.toFixed(2),
      m.costo_unitario.toFixed(2),
      m.costo_total.toFixed(2),
      m.saldo_valorado.toFixed(2)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kardex_${selectedAccountId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Kárdex exportado');
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Seleccionar Cuenta para Kárdex</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cuenta de Activo</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta de activo" />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hay cuentas de activo activas
                    </SelectItem>
                  ) : (
                    assetAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.id} — {acc.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {assetAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Primero debes crear cuentas de activo en el Catálogo de Cuentas
                </p>
              )}
            </div>
            <div className="flex items-end gap-2">
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleOpenModal} 
                    disabled={!selectedAccountId || loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Movimiento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Movimiento de Kárdex</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={formData.fecha}
                        onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label>Concepto</Label>
                      <Input
                        value={formData.concepto}
                        onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
                        placeholder="Ej. Compra Lote 1, Venta P2P"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Entrada (Unidades)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.entrada}
                          onChange={(e) => setFormData(prev => ({ ...prev, entrada: e.target.value, salidas: '0' }))}
                          placeholder="0"
                        />
                      </div>
                      
                      <div>
                        <Label>Salidas (Unidades)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.salidas}
                          onChange={(e) => setFormData(prev => ({ ...prev, salidas: e.target.value, entrada: '0' }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Costo Total (Bs.)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.costo_total}
                        onChange={(e) => setFormData(prev => ({ ...prev, costo_total: e.target.value }))}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Para entradas: monto total de la compra. Para salidas: se calcula automáticamente.
                      </p>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSave}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="outline" 
                onClick={handleExport}
                disabled={!selectedAccountId || movements.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>
              Kárdex de {selectedAccount?.name} ({selectedAccount?.id}) — Costo Promedio Ponderado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : (
              <div className="border rounded-xl overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Entrada</TableHead>
                      <TableHead className="text-right">Salidas</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Costo Unitario</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                      <TableHead className="text-right">Saldo Valorado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsWithCPP.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No hay movimientos registrados. Agrega el primer movimiento.
                        </TableCell>
                      </TableRow>
                    ) : (
                      movementsWithCPP.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell>{mov.fecha}</TableCell>
                          <TableCell>{mov.concepto}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {mov.entrada > 0 ? fmt(mov.entrada) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {mov.salidas > 0 ? fmt(mov.salidas) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {fmt(mov.saldo)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(mov.costo_unitario)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(mov.costo_total)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {fmt(mov.saldo_valorado)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(mov.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
