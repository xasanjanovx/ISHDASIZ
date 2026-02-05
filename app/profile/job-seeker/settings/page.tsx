'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Settings, Phone, Bell, Shield, Trash2, ChevronRight,
    AlertTriangle, LogOut
} from '@/components/ui/icons';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SettingsPage() {
    const { lang } = useLanguage();

    const [phone, setPhone] = useState('+998 90 123-45-67');
    const [notifications, setNotifications] = useState({
        newMessages: true,
        applicationUpdates: true,
        newVacancies: false,
        marketingEmails: false,
    });

    const handleSavePhone = () => {
        toast.success(lang === 'ru' ? 'Номер телефона сохранён' : 'Telefon raqami saqlandi');
    };

    const handleDeleteAccount = () => {
        console.log('Deleting account...');
        toast.error(lang === 'ru' ? 'Аккаунт удалён' : 'Akkaunt o\'chirildi');
    };


    return (
        <ProfileLayout userType="job_seeker" userName="Ism Familiya">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Настройки' : 'Sozlamalar'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Управляйте настройками аккаунта' : 'Akkaunt sozlamalarini boshqaring'}
                    </p>
                </div>

                {/* Phone Number */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Phone className="w-5 h-5 text-slate-400" />
                            {lang === 'ru' ? 'Номер телефона' : 'Telefon raqami'}
                        </CardTitle>
                        <CardDescription>
                            {lang === 'ru'
                                ? 'Используется для входа и получения уведомлений'
                                : 'Kirish va bildirishnomalar olish uchun ishlatiladi'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3">
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+998 XX XXX-XX-XX"
                                className="max-w-sm"
                            />
                            <Button onClick={handleSavePhone}>
                                {lang === 'ru' ? 'Сохранить' : 'Saqlash'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Bell className="w-5 h-5 text-slate-400" />
                            {lang === 'ru' ? 'Уведомления' : 'Bildirishnomalar'}
                        </CardTitle>
                        <CardDescription>
                            {lang === 'ru'
                                ? 'Настройте, какие уведомления вы хотите получать'
                                : 'Qaysi bildirishnomalarni olishni sozlang'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium text-slate-900">
                                    {lang === 'ru' ? 'Новые сообщения' : 'Yangi xabarlar'}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru'
                                        ? 'Уведомления о новых сообщениях от работодателей'
                                        : 'Ish beruvchilardan yangi xabarlar haqida'}
                                </p>
                            </div>
                            <Switch
                                checked={notifications.newMessages}
                                onCheckedChange={(checked) =>
                                    setNotifications({ ...notifications, newMessages: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                            <div>
                                <p className="font-medium text-slate-900">
                                    {lang === 'ru' ? 'Обновления заявок' : 'Arizalar yangilanishi'}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru'
                                        ? 'Изменения статуса ваших откликов'
                                        : 'Arizalaringiz holati o\'zgarishi'}
                                </p>
                            </div>
                            <Switch
                                checked={notifications.applicationUpdates}
                                onCheckedChange={(checked) =>
                                    setNotifications({ ...notifications, applicationUpdates: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                            <div>
                                <p className="font-medium text-slate-900">
                                    {lang === 'ru' ? 'Новые вакансии' : 'Yangi vakansiyalar'}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru'
                                        ? 'Подходящие вакансии по вашему профилю'
                                        : 'Profilingizga mos vakansiyalar'}
                                </p>
                            </div>
                            <Switch
                                checked={notifications.newVacancies}
                                onCheckedChange={(checked) =>
                                    setNotifications({ ...notifications, newVacancies: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                            <div>
                                <p className="font-medium text-slate-900">
                                    {lang === 'ru' ? 'Маркетинговые рассылки' : 'Marketing xabarlari'}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru'
                                        ? 'Новости и полезные материалы'
                                        : 'Yangiliklar va foydali materiallar'}
                                </p>
                            </div>
                            <Switch
                                checked={notifications.marketingEmails}
                                onCheckedChange={(checked) =>
                                    setNotifications({ ...notifications, marketingEmails: checked })
                                }
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Security */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Shield className="w-5 h-5 text-slate-400" />
                            {lang === 'ru' ? 'Безопасность' : 'Xavfsizlik'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <span className="text-slate-700">
                                {lang === 'ru' ? 'Активные сессии' : 'Faol seanslar'}
                            </span>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </button>
                        <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <span className="text-slate-700">
                                {lang === 'ru' ? 'История входов' : 'Kirish tarixi'}
                            </span>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </button>
                    </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-red-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            {lang === 'ru' ? 'Опасная зона' : 'Xavfli zona'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-900">
                                    {lang === 'ru' ? 'Выйти со всех устройств' : 'Barcha qurilmalardan chiqish'}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru'
                                        ? 'Завершить все активные сессии'
                                        : 'Barcha faol seanslarni yakunlash'}
                                </p>
                            </div>
                            <Button variant="outline" className="gap-2">
                                <LogOut className="w-4 h-4" />
                                {lang === 'ru' ? 'Выйти' : 'Chiqish'}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-red-100">
                            <div>
                                <p className="font-medium text-red-600">
                                    {lang === 'ru' ? 'Удалить аккаунт' : 'Akkauntni o\'chirish'}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru'
                                        ? 'Это действие нельзя отменить'
                                        : 'Bu amalni bekor qilib bo\'lmaydi'}
                                </p>
                            </div>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="gap-2">
                                        <Trash2 className="w-4 h-4" />
                                        {lang === 'ru' ? 'Удалить' : 'O\'chirish'}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {lang === 'ru' ? 'Удалить аккаунт?' : 'Akkauntni o\'chirishni xohlaysizmi?'}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {lang === 'ru'
                                                ? 'Это действие нельзя отменить. Все ваши данные, резюме и заявки будут удалены навсегда.'
                                                : 'Bu amalni bekor qilib bo\'lmaydi. Barcha ma\'lumotlaringiz, rezyumeleringiz va arizalaringiz butunlay o\'chiriladi.'}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            {lang === 'ru' ? 'Отмена' : 'Bekor qilish'}
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteAccount}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            {lang === 'ru' ? 'Удалить' : 'O\'chirish'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ProfileLayout>
    );
}

