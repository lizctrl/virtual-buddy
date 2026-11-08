"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/layout/AppLayout";
import AppIcon from "@/app/components/ui/AppIcon";
import Input from "@/app/components/ui/Input";
import { panelPrimary, panelSecondary } from "@/app/components/dashboard/panel-styles";
import { apiGet, apiPost, apiPut } from "@/app/lib/api/client";
import { parseProfilePicture } from "@/app/lib/profile-picture";
import type { User } from "@/app/types/types";

function ProfileAvatar({ picture, initials }: { picture: string; initials: string }) {
    const [failed, setFailed] = useState(false);

    return (
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-indigo-100 text-xl font-bold text-indigo-800 shadow-sm sm:size-24">
            {picture && !failed ? (
                // User-supplied image URLs are loaded directly by the browser.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
            ) : (
                <span aria-hidden="true">{initials}</span>
            )}
        </div>
    );
}

function AccountDetails({ user, onSave }: { user: User; onSave: (user: User) => void }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    function edit(open: boolean) {
        setEditing(open);
        setError("");
        setNotice("");
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        const values = new FormData(event.currentTarget);
        setSaving(true);
        setError("");
        const result = await apiPut<{ user: User }>(`/api/v1/user/${user.id}`, {
            name: values.get("name"),
            last_name: values.get("last_name"),
            phone: values.get("phone")
        });
        setSaving(false);
        if (!result.ok) {
            setError(result.message);
            return;
        }
        onSave(result.data.user);
        setEditing(false);
        setNotice("Datos de la cuenta guardados.");
    }

    return (
        <section aria-labelledby="account-details-title" className="min-w-0 rounded-xl border border-indigo-100 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="account-details-title" className="font-bold text-slate-900">Datos de la cuenta</h3>
                {!editing && (
                    <button type="button" className={panelSecondary} onClick={() => edit(true)}>Editar datos</button>
                )}
            </div>
            {editing ? (
                <form onSubmit={save} className="mt-3 space-y-3">
                    <Input id="account-name" name="name" label="Nombre" defaultValue={user.name}
                        autoComplete="given-name" autoFocus required disabled={saving} className="w-full min-w-0 text-sm" />
                    <Input id="account-last-name" name="last_name" label="Apellidos" defaultValue={user.last_name}
                        autoComplete="family-name" disabled={saving} className="w-full min-w-0 text-sm" />
                    <Input id="account-phone" name="phone" label="Teléfono" defaultValue={user.phone}
                        type="tel" autoComplete="tel" disabled={saving} className="w-full min-w-0 text-sm" />
                    <div className="text-sm">
                        <p className="text-xs font-medium text-slate-600">Correo de inicio de sesión</p>
                        <p className="mt-1 break-all text-slate-900">{user.email}</p>
                    </div>
                    {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className={panelPrimary} disabled={saving}>{saving ? "Guardando…" : "Guardar datos"}</button>
                        <button type="button" className={panelSecondary} disabled={saving} onClick={() => edit(false)}>Cancelar edición</button>
                    </div>
                </form>
            ) : (
                <dl className="mt-3 divide-y divide-slate-100 text-sm">
                    <div className="pb-3">
                        <dt className="text-xs font-medium text-slate-600">Nombre completo</dt>
                        <dd className="mt-1 font-semibold break-words text-slate-900">{user.name} {user.last_name}</dd>
                    </div>
                    <div className="py-3">
                        <dt className="text-xs font-medium text-slate-600">Correo electrónico</dt>
                        <dd className="mt-1 font-semibold break-all text-slate-900">{user.email}</dd>
                    </div>
                    <div className="pt-3">
                        <dt className="text-xs font-medium text-slate-600">Teléfono</dt>
                        <dd className="mt-1 font-semibold break-words text-slate-900">{user.phone || "Sin registrar"}</dd>
                    </div>
                </dl>
            )}
            {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        </section>
    );
}

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [savedPicture, setSavedPicture] = useState("");
    const [picture, setPicture] = useState("");
    const [error, setError] = useState<{ message: string; status: number } | null>(null);
    const [saveError, setSaveError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        async function load() {
            const account = await apiGet<User>("/api/v1/auth/me");
            if (!active) return;
            if (!account.ok) {
                setError({ message: account.message, status: account.status });
                setLoading(false);
                return;
            }

            const result = await apiGet<{ profiles: { picture: string }[] }>(
                "/api/v1/profile?picture=true&state=true&sortBy=id&sortOrder=desc&limit=1"
            );
            if (!active) return;
            if (result.ok) {
                const image = result.data.profiles[0]?.picture ?? "";
                setSavedPicture(image);
                setPicture(image);
                setUser(account.data);
            } else {
                setError({ message: result.message, status: result.status });
            }
            setLoading(false);
        }
        void load();
        return () => { active = false; };
    }, [retry]);

    function editPicture(value: string) {
        setPicture(value);
        setNotice("");
        setSaveError("");
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user || saving || picture.trim() === savedPicture) return;
        const value = parseProfilePicture(picture);
        if (value === null) {
            setSaveError("Usa una dirección de imagen que empiece con https:// o http://.");
            return;
        }

        setSaving(true);
        setSaveError("");
        setNotice("");
        const result = await apiPost<{ profile: { picture: string } }>("/api/v1/profile", { picture: value });
        if (result.ok) {
            setSavedPicture(result.data.profile.picture);
            setPicture(result.data.profile.picture);
            setNotice("Perfil guardado.");
        } else {
            setSaveError(result.message);
        }
        setSaving(false);
    }

    const name = user ? `${user.name} ${user.last_name}`.trim() : "";
    const initials = name.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? "").join("").toLocaleUpperCase("es-CR") || "?";
    const preview = parseProfilePicture(picture) ?? (parseProfilePicture(savedPicture) || "");

    return (
        <AppLayout account={user ?? undefined}>
            <section lang="es" aria-labelledby="profile-title" className="mx-auto max-w-5xl rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
                <header className="flex items-center gap-3 rounded-t-2xl border-b border-indigo-100 bg-white px-4 py-4 sm:px-6">
                    <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700"><AppIcon name="profile" /></span>
                    <div>
                        <h1 id="profile-title" className="text-lg font-bold text-slate-900">Mi perfil</h1>
                        <p className="mt-0.5 text-xs text-slate-600">Edita tus datos y personaliza tu foto.</p>
                    </div>
                </header>

                <div className="space-y-4 p-3 sm:p-5">
                    {loading && <p role="status" className="rounded-xl bg-white p-4 text-sm text-slate-600">Cargando tu perfil…</p>}
                    {error && (
                        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 text-sm">
                            {error.status === 401 ? (
                                <>
                                    <p className="text-slate-700">Inicia sesión para ver tu perfil.</p>
                                    <Link href="/login" className={panelSecondary}>Iniciar sesión</Link>
                                </>
                            ) : (
                                <>
                                    <p className="text-rose-800">No se pudo cargar tu perfil. {error.message}</p>
                                    <button type="button" className={panelSecondary} onClick={() => { setError(null); setLoading(true); setRetry(n => n + 1); }}>Reintentar</button>
                                </>
                            )}
                        </div>
                    )}

                    {user && (
                        <>
                            <div className="relative isolate flex min-w-0 flex-wrap items-center gap-4 overflow-hidden rounded-xl bg-indigo-950 px-4 py-5 text-white sm:px-6">
                                <svg aria-hidden="true" viewBox="0 0 240 128" className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden h-full text-indigo-300 opacity-35 sm:block" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M84 128V70a52 52 0 0 1 104 0v58m-89 0V70a37 37 0 0 1 74 0v58m-59 0V70a22 22 0 0 1 44 0v58M205 0v25a30 30 0 0 0 30 30h5m-20-55v25a15 15 0 0 0 15 15h5" />
                                    <circle cx="43" cy="47" r="8" /><path d="M33 92h20M43 82v20" strokeLinecap="round" />
                                </svg>
                                <ProfileAvatar key={preview} picture={preview} initials={initials} />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold tracking-widest text-indigo-200 uppercase">Mi cuenta</p>
                                    <h2 className="mt-1 text-2xl font-bold break-words">{name}</h2>
                                    <p className="mt-1 text-sm break-all text-indigo-100">{user.email}</p>
                                </div>
                            </div>

                            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                                <AccountDetails user={user} onSave={setUser} />

                                <section className="min-w-0 rounded-xl border border-indigo-100 bg-white p-4 sm:p-5">
                                    <h3 className="font-bold text-slate-900">Foto de perfil</h3>
                                    <p id="profile-picture-hint" className="mt-1 text-sm text-slate-600">Pega el enlace de una imagen para previsualizarla en tu tarjeta.</p>

                                    <form onSubmit={handleSave} className="mt-4 space-y-3">
                                        <Input id="picture" name="picture" type="url" label="Enlace de la imagen" placeholder="https://…"
                                            value={picture} onChange={event => editPicture(event.target.value)} disabled={saving}
                                            aria-describedby="profile-picture-hint" className="w-full min-w-0 text-sm" />
                                        <div className="flex flex-wrap gap-2">
                                            <button type="submit" className={panelPrimary} disabled={saving || picture.trim() === savedPicture}>
                                                {saving ? "Guardando…" : "Guardar foto"}
                                            </button>
                                            {!!picture && (
                                                <button type="button" className={panelSecondary} disabled={saving} onClick={() => editPicture("")}>
                                                    Usar iniciales
                                                </button>
                                            )}
                                        </div>
                                        {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
                                        {saveError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{saveError}</p>}
                                    </form>
                                </section>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </AppLayout>
    );
}
