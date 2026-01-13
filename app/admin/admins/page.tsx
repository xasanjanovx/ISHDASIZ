'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import Header from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus, Loader2, Trash2, Shield } from '@/components/ui/icons';
import { toast } from 'sonner';

interface District {
  id: string;
  name_uz: string;
  name_ru: string;
}

interface AdminProfile {
  id: string;
  full_name: string;
  role: string;
  district_id: string | null;
  created_at: string;
  email?: string;
}

export default function AdminsManagementPage() {
  const { lang } = useLanguage();
  const { user, adminProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'hokimlik_assistant',
    districtId: '',
  });

  useEffect(() => {
    if (!authLoading && (!user || !adminProfile || adminProfile.role !== 'super_admin')) {
      router.push('/admin/login');
    }
  }, [user, adminProfile, authLoading, router]);

  useEffect(() => {
    if (adminProfile?.role === 'super_admin') {
      fetchAdmins();
      fetchDistricts();
    }
  }, [adminProfile]);

  const fetchDistricts = async () => {
    const { data } = await supabase
      .from('districts')
      .select('id, name_uz, name_ru')
      .order('name_uz');

    if (data) setDistricts(data);
  };

  const fetchAdmins = async () => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profiles) {
      setAdmins(profiles.map(profile => ({
        ...profile,
        email: '',
      })));
    }

    setLoading(false);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('No session token');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const functionUrl = `${supabaseUrl}/functions/v1/create-admin`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
          role: formData.role,
          district_id: formData.districtId || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create admin');
      }

      toast.success(lang === 'uz' ? 'Admin yaratildi!' : 'Админ создан!');
      setDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'hokimlik_assistant',
        districtId: '',
      });
      fetchAdmins();
    } catch (error) {
      toast.error(lang === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка');
      console.error(error);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm(lang === 'uz' ? 'Rostdan ham o\'chirmoqchimisiz?' : 'Вы уверены?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_profiles')
        .delete()
        .eq('id', adminId);

      if (error) throw error;

      toast.success(lang === 'uz' ? 'Admin o\'chirildi' : 'Админ удален');
      fetchAdmins();
    } catch (error) {
      toast.error(lang === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка');
      console.error(error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!adminProfile || adminProfile.role !== 'super_admin') {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {lang === 'uz' ? 'Adminlar boshqaruvi' : 'Управление администраторами'}
              </h1>
              <p className="text-slate-600">
                {lang === 'uz'
                  ? 'Adminlar ro\'yxati va yangi admin qo\'shish'
                  : 'Список администраторов и добавление новых'}
              </p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {lang === 'uz' ? 'Yangi admin' : 'Новый админ'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {lang === 'uz' ? 'Yangi admin yaratish' : 'Создать нового админа'}
                  </DialogTitle>
                  <DialogDescription>
                    {lang === 'uz'
                      ? 'Yangi administrator qo\'shish uchun ma\'lumotlarni kiriting'
                      : 'Введите данные для добавления нового администратора'}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      {lang === 'uz' ? 'Parol' : 'Пароль'}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">
                      {lang === 'uz' ? 'To\'liq ism' : 'Полное имя'}
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">
                      {lang === 'uz' ? 'Rol' : 'Роль'}
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="hokimlik_assistant">
                          {lang === 'uz' ? 'Hokimlik yordamchisi' : 'Помощник хокимията'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="district">
                      {lang === 'uz' ? 'Tuman (ixtiyoriy)' : 'Район (опционально)'}
                    </Label>
                    <Select
                      value={formData.districtId}
                      onValueChange={(value) => setFormData({ ...formData, districtId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={lang === 'uz' ? 'Tumanni tanlang' : 'Выберите район'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">
                          {lang === 'uz' ? 'Tuman yo\'q' : 'Без района'}
                        </SelectItem>
                        {districts.map((district) => (
                          <SelectItem key={district.id} value={district.id}>
                            {lang === 'uz' ? district.name_uz : district.name_ru}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full">
                    {lang === 'uz' ? 'Yaratish' : 'Создать'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {admins.map((admin) => (
              <Card key={admin.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{admin.full_name}</CardTitle>
                        <CardDescription>ID: {admin.id.slice(0, 8)}...</CardDescription>
                        <div className="flex gap-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            admin.role === 'super_admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {admin.role === 'super_admin' ? 'Super Admin' : lang === 'uz' ? 'Yordamchi' : 'Помощник'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {admin.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAdmin(admin.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}

            {admins.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500">
                    {lang === 'uz' ? 'Adminlar topilmadi' : 'Администраторы не найдены'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
