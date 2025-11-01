import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Copy, Plus, Trash2, Users } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface InvitationCode {
  id: string;
  code: string;
  can_view_accounts: boolean;
  can_view_journal: boolean;
  can_view_auxiliary: boolean;
  can_view_ledger: boolean;
  can_view_reports: boolean;
  used: boolean;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}

interface SharedAccess {
  id: string;
  viewer_id: string;
  can_view_accounts: boolean;
  can_view_journal: boolean;
  can_view_auxiliary: boolean;
  can_view_ledger: boolean;
  can_view_reports: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [sharedAccess, setSharedAccess] = useState<SharedAccess[]>([]);
  
  // Form states
  const [permissions, setPermissions] = useState({
    can_view_accounts: true,
    can_view_journal: true,
    can_view_auxiliary: true,
    can_view_ledger: true,
    can_view_reports: true,
  });
  const [expirationDays, setExpirationDays] = useState(7);

  useEffect(() => {
    checkUserRole();
    fetchInvitationCodes();
    fetchSharedAccess();
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setIsOwner(data?.role === 'owner');
    } catch (error) {
      // Role check failed - default to non-owner
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitationCodes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitationCodes(data || []);
    } catch (error) {
      // Failed to fetch invitation codes
    }
  };

  const fetchSharedAccess = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('shared_access')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSharedAccess(data || []);
    } catch (error) {
      // Failed to fetch shared access
    }
  };

  const generateInvitationCode = async () => {
    if (!user || !isOwner) return;

    try {
      const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const { error } = await supabase
        .from('invitation_codes')
        .insert({
          code,
          owner_id: user.id,
          expires_at: expiresAt.toISOString(),
          ...permissions,
        });

      if (error) throw error;

      toast({
        title: 'Código generado',
        description: 'El código de invitación ha sido creado exitosamente.',
      });

      fetchInvitationCodes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteInvitationCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invitation_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Código eliminado',
        description: 'El código de invitación ha sido eliminado.',
      });

      fetchInvitationCodes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Copiado',
      description: 'El código ha sido copiado al portapapeles.',
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acceso Restringido</CardTitle>
            <CardDescription>
              Solo los usuarios principales pueden acceder a esta sección.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Gestiona el acceso de usuarios a tu contabilidad</p>
      </div>

      {/* Generate Invitation Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generar Código de Invitación
          </CardTitle>
          <CardDescription>
            Crea códigos para invitar a otros usuarios con permisos de solo lectura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiration">Días de expiración</Label>
              <Input
                id="expiration"
                type="number"
                min="1"
                value={expirationDays}
                onChange={(e) => setExpirationDays(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Permisos</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="accounts" className="font-normal">Plan de Cuentas</Label>
                <Switch
                  id="accounts"
                  checked={permissions.can_view_accounts}
                  onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_accounts: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="journal" className="font-normal">Libro Diario</Label>
                <Switch
                  id="journal"
                  checked={permissions.can_view_journal}
                  onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_journal: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auxiliary" className="font-normal">Libros Auxiliares</Label>
                <Switch
                  id="auxiliary"
                  checked={permissions.can_view_auxiliary}
                  onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_auxiliary: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ledger" className="font-normal">Libro Mayor</Label>
                <Switch
                  id="ledger"
                  checked={permissions.can_view_ledger}
                  onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_ledger: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="reports" className="font-normal">Reportes</Label>
                <Switch
                  id="reports"
                  checked={permissions.can_view_reports}
                  onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_reports: checked })}
                />
              </div>
            </div>
          </div>

          <Button onClick={generateInvitationCode} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Generar Código
          </Button>
        </CardContent>
      </Card>

      {/* Invitation Codes List */}
      <Card>
        <CardHeader>
          <CardTitle>Códigos de Invitación</CardTitle>
          <CardDescription>Códigos generados para compartir acceso</CardDescription>
        </CardHeader>
        <CardContent>
          {invitationCodes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay códigos de invitación generados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitationCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono text-sm">{code.code}</TableCell>
                    <TableCell>
                      <Badge variant={code.used ? "secondary" : "default"}>
                        {code.used ? 'Usado' : 'Activo'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(code.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {code.can_view_accounts && <Badge variant="outline" className="text-xs">Cuentas</Badge>}
                        {code.can_view_journal && <Badge variant="outline" className="text-xs">Diario</Badge>}
                        {code.can_view_auxiliary && <Badge variant="outline" className="text-xs">Auxiliar</Badge>}
                        {code.can_view_ledger && <Badge variant="outline" className="text-xs">Mayor</Badge>}
                        {code.can_view_reports && <Badge variant="outline" className="text-xs">Reportes</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(code.code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteInvitationCode(code.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shared Access List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuarios con Acceso
          </CardTitle>
          <CardDescription>Usuarios que tienen acceso a tu contabilidad</CardDescription>
        </CardHeader>
        <CardContent>
          {sharedAccess.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay usuarios con acceso compartido
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario ID</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sharedAccess.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell className="font-mono text-sm">{access.viewer_id.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {access.can_view_accounts && <Badge variant="outline" className="text-xs">Cuentas</Badge>}
                        {access.can_view_journal && <Badge variant="outline" className="text-xs">Diario</Badge>}
                        {access.can_view_auxiliary && <Badge variant="outline" className="text-xs">Auxiliar</Badge>}
                        {access.can_view_ledger && <Badge variant="outline" className="text-xs">Mayor</Badge>}
                        {access.can_view_reports && <Badge variant="outline" className="text-xs">Reportes</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(access.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
