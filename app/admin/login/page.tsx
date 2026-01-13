'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BadgeCheck, Loader2, Lock } from '@/components/ui/icons';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const { t, lang } = useLanguage();
  const { user, adminProfile, loading: authLoading, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && adminProfile) {
      router.push('/admin');
    }
  }, [user, adminProfile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast.error(
          lang === 'uz'
            ? 'Email yoki parol notogri'
            : 'Неверный email или пароль'
        );
        setLoading(false);
        return;
      }

      toast.success(
        lang === 'uz' ? 'Muvaffaqiyatli kirdingiz!' : 'Успешный вход!'
      );
    } catch (err) {
      console.error('Login error:', err);
      toast.error(
        lang === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка'
      );
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sky-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-sky-600" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            ISHDASIZ
            <BadgeCheck className="w-5 h-5 text-sky-600" />
          </CardTitle>
          <CardDescription>{t.admin.loginTitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.admin.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ishdasiz.uz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.admin.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.admin.login}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
