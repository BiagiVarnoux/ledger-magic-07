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
        // Crear cuenta
        await signUp(email, password);

        // Esperar un momento para que se cree el usuario
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Obtener el ID del nuevo usuario
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Si hay código de invitación, validarlo y redimirlo usando la función segura
          if (invitationCode) {
            const { data: result, error: redeemError } = await supabase.rpc(
              'redeem_invitation_code',
              { 
                _code: invitationCode.trim(),
                _user_id: user.id 
              }
            );

            if (redeemError || !result?.success) {
              toast.error(result?.error || 'Error al validar el código de invitación');
              setLoading(false);
              return;
            }

            toast.success('¡Cuenta creada con código de invitación! Revisa tu email para confirmar.');
          } else {
            toast.success('¡Cuenta creada exitosamente! Revisa tu email para confirmar.');
          }
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