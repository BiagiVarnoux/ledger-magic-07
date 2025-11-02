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
import { supabase } from '@/integrations/supabase/client';
import { fmt } from '@/accounting/utils';

interface KardexEntry {
  id: string;
  user_id: string;
  account_id: string;
}

interface KardexMovement {
  id: string;
  kardex_id: string;
  fecha: string;
  concepto: string;
  entrada: number;
  salidas: number;
  saldo: number;
  costo_unitario: number;
  costo_total: number;
  saldo_valorado: number;
}

export function KardexCPP() {
  const { accounts } = useAccounting();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [kardexEntry, setKardexEntry] = useState<KardexEntry | null>(null);
  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    tipo: 'entrada' as 'entrada' | 'salida',
    cantidad: '',
    costo_unitario: ''
  });

  // Filtrar solo cuentas de activos
  const assetAccounts = useMemo(() => 
    accounts.filter(a => a.is_active && a.type === 'ACTIVO'),
    [accounts]
  );

  // Cargar o crear kárdex para la cuenta seleccionada
  useEffect(() => {
    if (!selectedAccountId) {
      setKardexEntry(null);
      setMovements([]);
      return;
    }

    loadKardex();
  }, [selectedAccountId]);

  const loadKardex = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar kárdex existente
      const { data: existingKardex, error: kardexError } = await supabase
        .from('kardex_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_id', selectedAccountId)
        .maybeSingle();

      if (kardexError) throw kardexError;

      if (existingKardex) {
        setKardexEntry(existingKardex);
        loadMovements(existingKardex.id);
      } else {
        // Crear nuevo kárdex
        const { data: newKardex, error: createError } = await supabase
          .from('kardex_entries')
          .insert({ user_id: user.id, account_id: selectedAccountId })
          .select()
          .single();

        if (createError) throw createError;
        setKardexEntry(newKardex);
        setMovements([]);
      }
    } catch (error: any) {
      toast.error('Error al cargar kárdex');
    }
  };

  const loadMovements = async (kardexId: string) => {
    try {
      const { data, error } = await supabase
        .from('kardex_movements')
        .select('*')
        .eq('kardex_id', kardexId)
        .order('fecha', { ascending: true });

      if (error) throw error;
      setMovements(data || []);
    } catch (error: any) {
      toast.error('Error al cargar movimientos');
    }
  };

  const calculateCPP = (
    saldoAnterior: number,
    saldoValoradoAnterior: number,
    entrada: number,
    costoUnitarioEntrada: number
  ): number => {
    if (entrada === 0) return saldoAnterior > 0 ? saldoValoradoAnterior / saldoAnterior : 0;
    
    const totalUnidades = saldoAnterior + entrada;
    const totalValor = saldoValoradoAnterior + (entrada * costoUnitarioEntrada);
    
    return totalUnidades > 0 ? totalValor / totalUnidades : 0;
  };

  const handleSaveMovement = async () => {
    if (!kardexEntry) return;
    
    if (!formData.concepto.trim()) {
      toast.error('El concepto es requerido');
      return;
    }

    const cantidad = parseFloat(formData.cantidad);
    const costoUnitario = parseFloat(formData.costo_unitario);

    if (isNaN(cantidad) || cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (formData.tipo === 'entrada' && (isNaN(costoUnitario) || costoUnitario <= 0)) {
      toast.error('El costo unitario debe ser mayor a 0 para entradas');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener último movimiento para calcular CPP
      const lastMovement = movements.length > 0 ? movements[movements.length - 1] : null;
      const saldoAnterior = lastMovement?.saldo || 0;
      const saldoValoradoAnterior = lastMovement?.saldo_valorado || 0;
      const costoPrevio = lastMovement?.costo_unitario || 0;

      let entrada = 0;
      let salidas = 0;
      let nuevoSaldo = saldoAnterior;
      let nuevoCostoUnitario = costoPrevio;
      let costoTotal = 0;
      let nuevoSaldoValorado = saldoValoradoAnterior;

      if (formData.tipo === 'entrada') {
        entrada = cantidad;
        nuevoSaldo = saldoAnterior + entrada;
        nuevoCostoUnitario = calculateCPP(saldoAnterior, saldoValoradoAnterior, entrada, costoUnitario);
        costoTotal = entrada * costoUnitario;
        nuevoSaldoValorado = nuevoSaldo * nuevoCostoUnitario;
      } else {
        salidas = cantidad;
        if (salidas > saldoAnterior) {
          toast.error('No hay suficiente saldo para esta salida');
          return;
        }
        nuevoSaldo = saldoAnterior - salidas;
        nuevoCostoUnitario = costoPrevio;
        costoTotal = salidas * nuevoCostoUnitario;
        nuevoSaldoValorado = nuevoSaldo * nuevoCostoUnitario;
      }

      const movement = {
        kardex_id: kardexEntry.id,
        user_id: user.id,
        fecha: formData.fecha,
        concepto: formData.concepto.trim(),
        entrada,
        salidas,
        saldo: nuevoSaldo,
        costo_unitario: nuevoCostoUnitario,
        costo_total: costoTotal,
        saldo_valorado: nuevoSaldoValorado
      };

      const { error } = await supabase
        .from('kardex_movements')
        .insert(movement);

      if (error) throw error;

      toast.success('Movimiento agregado exitosamente');
      await loadMovements(kardexEntry.id);
      handleCloseModal();
    } catch (error: any) {
      toast.error('Error al guardar movimiento');
    }
  };

  const handleDeleteMovement = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return;

    try {
      const { error } = await supabase
        .from('kardex_movements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Movimiento eliminado');
      if (kardexEntry) loadMovements(kardexEntry.id);
    } catch (error: any) {
      toast.error('Error al eliminar movimiento');
    }
  };

  const handleExport = () => {
    if (movements.length === 0) {
      toast.error('No hay movimientos para exportar');
      return;
    }

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    const csv = [
      ['Kárdex de Activos (CPP) - ' + (selectedAccount?.name || selectedAccountId)],
      [''],
      ['Fecha', 'Concepto', 'Entrada', 'Salidas', 'Saldo', 'Costo Unitario', 'Costo Total', 'Saldo Valorado'],
      ...movements.map(m => [
        m.fecha,
        m.concepto,
        m.entrada.toFixed(2),
        m.salidas.toFixed(2),
        m.saldo.toFixed(2),
        m.costo_unitario.toFixed(2),
        m.costo_total.toFixed(2),
        m.saldo_valorado.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kardex_${selectedAccountId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Kárdex exportado exitosamente');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      tipo: 'entrada',
      cantidad: '',
      costo_unitario: ''
    });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Seleccionar Cuenta de Activo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Cuenta</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta de activo" />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hay cuentas de activo disponibles
                    </SelectItem>
                  ) : (
                    assetAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.id} — {account.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!selectedAccountId}>
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
                        placeholder="Ej. Compra Lote 1, Venta P2P, etc."
                      />
                    </div>

                    <div>
                      <Label>Tipo de Movimiento</Label>
                      <Select 
                        value={formData.tipo} 
                        onValueChange={(value: 'entrada' | 'salida') => 
                          setFormData(prev => ({ ...prev, tipo: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada (Compra/Incremento)</SelectItem>
                          <SelectItem value="salida">Salida (Venta/Decremento)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.cantidad}
                        onChange={(e) => setFormData(prev => ({ ...prev, cantidad: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>

                    {formData.tipo === 'entrada' && (
                      <div>
                        <Label>Costo Unitario (Bs.)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.costo_unitario}
                          onChange={(e) => setFormData(prev => ({ ...prev, costo_unitario: e.target.value }))}
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Para salidas, se usa el Costo Promedio Ponderado calculado
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={handleCloseModal}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveMovement}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                onClick={handleExport}
                disabled={movements.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && kardexEntry && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>
              Kárdex (CPP) - {accounts.find(a => a.id === selectedAccountId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
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
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No hay movimientos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{new Date(movement.fecha).toLocaleDateString('es-BO')}</TableCell>
                          <TableCell>{movement.concepto}</TableCell>
                          <TableCell className="text-right">
                            {movement.entrada > 0 ? fmt(movement.entrada) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {movement.salidas > 0 ? fmt(movement.salidas) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {fmt(movement.saldo)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(movement.costo_unitario)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(movement.costo_total)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {fmt(movement.saldo_valorado)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteMovement(movement.id)}
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
            </div>
            {movements.length > 0 && (
              <div className="mt-4 flex justify-end">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Saldo Final</div>
                  <div className="text-2xl font-bold text-green-600">
                    {fmt(movements[movements.length - 1]?.saldo_valorado || 0)} Bs.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Unidades: {fmt(movements[movements.length - 1]?.saldo || 0)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
