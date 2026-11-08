"use client";

import { useEffect, useState, type FormEvent } from "react";
import Input from "@/app/components/ui/Input";
import { apiGet, apiPost } from "@/app/lib/api/client";
import { panelPrimary, panelSecondary } from "./panel-styles";

interface Client {
    id: number;
    name: string;
    last_name: string;
    email: string;
    block: { reason: string | null } | null;
}

export default function BusinessModeration({ businessId, businessName }: { businessId: number; businessName: string }) {
    const [clients, setClients] = useState<Client[] | null>(null);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        apiGet<{ clients: Client[] }>(`/api/v1/business/${businessId}/clients`).then(result => {
            if (!active) return;
            if (result.ok) setClients(result.data.clients);
            else setError(result.message);
        });
        return () => { active = false; };
    }, [businessId, retry]);

    async function setStatus(userId: number, status: "banned" | "active", reason?: string) {
        if (saving) return;
        setSaving(true);
        setError("");
        setNotice("");
        const result = await apiPost<{ moderation: { reason: string | null } }>("/api/v1/moderation", { businessId, userId, status, reason });
        setSaving(false);
        if (!result.ok) {
            setError(result.message);
            return;
        }

        const block = status === "banned" ? { reason: result.data.moderation.reason } : null;
        setClients(previous => previous?.map(client => client.id === userId ? { ...client, block } : client) ?? null);
        setSelected(null);
        setNotice(status === "banned" ? "Cliente bloqueado para nuevas reservas." : "Cliente desbloqueado.");
    }

    function block(event: FormEvent<HTMLFormElement>, id: number) {
        event.preventDefault();
        const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
        if (!reason) {
            setError("Escribe un motivo para bloquear al cliente.");
            return;
        }
        void setStatus(id, "banned", reason);
    }

    const query = search.trim().toLocaleLowerCase("es-CR");
    const visible = clients?.filter(client => `${client.name} ${client.last_name} ${client.email}`.toLocaleLowerCase("es-CR").includes(query)) ?? [];

    return (
        <section aria-labelledby="moderation-title" className="rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
            <header className="rounded-t-2xl border-b border-indigo-100 bg-white px-4 py-4 sm:px-6">
                <h2 id="moderation-title" className="font-bold text-slate-900">Moderación · {businessName}</h2>
                <p className="mt-1 text-sm text-slate-600">Bloquea futuras reservas de clientes de este negocio. Las citas existentes siguen en la agenda.</p>
            </header>
            <div className="space-y-3 p-4 sm:p-5">
                {!!clients?.length && (
                    <div className="max-w-sm">
                        <Input id="moderation-search" type="search" label="Buscar cliente" placeholder="Nombre o correo"
                            value={search} disabled={saving} onChange={event => { setSearch(event.target.value); setSelected(null); }}
                            className="w-full bg-white text-sm" />
                    </div>
                )}
                {error && (
                    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                        <p>{error}</p>
                        {!clients && <button type="button" className={panelSecondary} onClick={() => { setError(""); setRetry(n => n + 1); }}>Reintentar</button>}
                    </div>
                )}
                {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
                {!clients && !error && <p role="status" className="text-sm text-slate-600">Cargando clientes…</p>}
                {clients && visible.length === 0 && (
                    <p className="rounded-xl bg-white p-4 text-sm text-slate-600">
                        {query ? "No encontramos clientes con esa búsqueda." : "Los clientes aparecerán cuando tengan una reserva en este negocio."}
                    </p>
                )}
                <ul className="space-y-2">
                    {visible.map(client => (
                        <li key={client.id} className="rounded-xl border border-indigo-100 bg-white p-3 sm:p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold break-words text-slate-900">{client.name} {client.last_name}</p>
                                        {client.block && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-900">Bloqueado</span>}
                                    </div>
                                    <p className="text-sm break-all text-slate-600">{client.email}</p>
                                    {client.block && <p className="mt-2 text-sm break-words whitespace-pre-wrap text-slate-700">Motivo interno · {client.block.reason || "Sin motivo registrado"}</p>}
                                </div>
                                {client.block ? (
                                    <button type="button" className={panelSecondary} disabled={saving}
                                        onClick={() => setStatus(client.id, "active")}>Desbloquear</button>
                                ) : (
                                    <button type="button" className={panelSecondary} aria-expanded={selected === client.id} disabled={saving}
                                        onClick={() => { setError(""); setNotice(""); setSelected(selected === client.id ? null : client.id); }}>
                                        Bloquear cliente
                                    </button>
                                )}
                            </div>
                            {selected === client.id && !client.block && (
                                <form onSubmit={event => block(event, client.id)} className="mt-3 space-y-2 rounded-lg border border-rose-100 bg-rose-50/60 p-3">
                                    <label htmlFor={`block-reason-${client.id}`} className="block text-sm font-semibold text-slate-900">Motivo del bloqueo</label>
                                    <textarea id={`block-reason-${client.id}`} name="reason" rows={2} maxLength={500} required autoFocus disabled={saving}
                                        placeholder="Ej. Inasistencias repetidas" className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm" />
                                    <p className="text-xs text-slate-600">El motivo solo se muestra en el panel del negocio.</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="submit" className={panelPrimary} disabled={saving}>{saving ? "Guardando…" : "Confirmar bloqueo"}</button>
                                        <button type="button" className={panelSecondary} disabled={saving} onClick={() => { setSelected(null); setError(""); }}>Cancelar</button>
                                    </div>
                                </form>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
