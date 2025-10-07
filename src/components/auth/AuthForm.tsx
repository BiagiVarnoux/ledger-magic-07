import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('¡Sesión iniciada exitosamente!');
      } else {
        // Si hay código de invitación, validarlo primero
        if (invitationCode) {
          const { data: codeData, error: codeError } = await supabase
            .from('invitation_codes')
            .select('*')
            .eq('code', invitationCode)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

          if (codeError || !codeData) {
            toast.error('Código de invitación inválido o expirado');
            setLoading(false);
            return;
          }

          // Crear cuenta
          await signUp(email, password);

          // Esperar un momento para que se cree el usuario
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Obtener el ID del nuevo usuario
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Marcar código como usado y crear acceso compartido
            await supabase.from('invitation_codes').update({ 
              used: true, 
              used_by: user.id 
            }).eq('id', codeData.id);

            await supabase.from('shared_access').insert({
              owner_id: codeData.owner_id,
              viewer_id: user.id,
              can_view_accounts: codeData.can_view_accounts,
              can_view_journal: codeData.can_view_journal,
              can_view_auxiliary: codeData.can_view_auxiliary,
              can_view_ledger: codeData.can_view_ledger,
              can_view_reports: codeData.can_view_reports,
            });

            // Asignar rol de viewer
            await supabase.from('user_roles').insert({
              user_id: user.id,
              role: 'viewer'
            });
          }

          toast.success('¡Cuenta creada con código de invitación! Revisa tu email para confirmar.');
        } else {
          await signUp(email, password);
          toast.success('¡Cuenta creada exitosamente! Revisa tu email para confirmar.');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Ingresa a tu sistema de contabilidad' 
              : 'Crea una nueva cuenta para empezar'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="invitationCode">Código de Invitación (opcional)</Label>
                <Input
                  id="invitationCode"
                  type="text"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  placeholder="Ingresa tu código de invitación"
                />
                <p className="text-xs text-muted-foreground">
                  Si tienes un código de invitación, ingrésalo aquí. Si no, se creará una cuenta principal.
                </p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm"
            >
              {isLogin 
                ? '¿No tienes cuenta? Créala aquí' 
                : '¿Ya tienes cuenta? Inicia sesión'
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}