"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/language-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminResetPassword() {
  const { lang } = useLanguage(), ru = lang === "ru";
  const [ready, setReady] = useState(false), [expired, setExpired] = useState(false);
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    // getUser validates the recovery session with the authentication server.
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!cancelled) { setReady(Boolean(data.user) && !error); setExpired(Boolean(error) || !data.user); }
    }).catch(() => { if (!cancelled) setExpired(true); });
    return () => { cancelled = true; };
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || password.length < 12 || password !== confirmation || lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword(""); setConfirmation(""); setSaved(true);
    } catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="mx-auto my-10 w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8">
    <p className="mb-3 text-sm font-semibold tracking-wider text-primary">ISHDASIZ · ADMIN</p>
    <h1 className="text-2xl font-bold">{ru ? "Новый пароль" : "Yangi parol"}</h1>
    {!ready && !expired && <p role="status" className="mt-5">{ru ? "Проверяем ссылку…" : "Havola tekshirilmoqda…"}</p>}
    {expired && <p role="alert" className="mt-5">{ru ? "Ссылка недействительна или истекла. Запросите новую на странице входа." : "Havola yaroqsiz yoki muddati tugagan. Kirish sahifasida yangisini so‘rang."}</p>}
    {saved ? <p role="status" className="mt-5 rounded-xl bg-accent p-4 text-primary">{ru ? "Пароль изменён. Можно открыть панель администратора." : "Parol yangilandi. Administrator panelini ochishingiz mumkin."}</p> : ready && <form onSubmit={save} className="mt-5 space-y-5">
      <p className="text-muted-foreground">{ru ? "Используйте не менее 12 символов." : "Kamida 12 ta belgidan foydalaning."}</p>
      <div className="space-y-2"><Label htmlFor="new-password">{ru ? "Новый пароль" : "Yangi parol"}</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">{ru ? "Повторите пароль" : "Parolni takrorlang"}</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></div>
      {confirmation && password !== confirmation && <p role="status" className="text-red-700">{ru ? "Пароли не совпадают." : "Parollar bir xil emas."}</p>}
      {error && <p role="alert" className="text-red-700">{ru ? "Не удалось сохранить пароль. Повторите или запросите новую ссылку." : "Parolni saqlab bo‘lmadi. Qayta urinib ko‘ring yoki yangi havola so‘rang."}</p>}
      <Button type="submit" className="h-12 w-full rounded-full" disabled={busy || password.length < 12 || password !== confirmation}>{busy ? (ru ? "Сохраняем…" : "Saqlanmoqda…") : (ru ? "Сохранить пароль" : "Parolni saqlash")}</Button>
    </form>}
    <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-full"><Link href={saved ? "/admin" : "/admin/login"}>{ru ? "Открыть админку" : "Admin panelni ochish"}</Link></Button>
  </main>;
}
