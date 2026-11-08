"use client";

import { useEffect, useState, type FormEvent } from "react";
import Input from "@/app/components/ui/Input";
import { apiDelete, apiGet, apiPost } from "@/app/lib/api/client";
import { calendarTimeZone, formatAppointment, parseDay } from "@/app/lib/calendar";
import { compactTime, type Block } from "./agenda-events";
import { panelPrimary, panelSecondary } from "./panel-styles";

const dateLabel = new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeZone: calendarTimeZone });

function blockLabel(block: Block) {
    const start = new Date(block.startsAt);
    const end = new Date(block.endsAt);
    if (compactTime.format(start) !== "00:00" || compactTime.format(end) !== "00:00") {
        return { kind: "Por horas", range: `${formatAppointment(start)} → ${formatAppointment(end)}` };
    }

    const first = dateLabel.format(start);
    const last = dateLabel.format(new Date(+end - 1));
    return { kind: first === last ? "Día completo" : "Días completos", range: first === last ? first : `${first} – ${last}` };
}

export default function ScheduleBlocks({ businessId }: { businessId: number }) {
    const endpoint = `/api/v1/schedule-block?businessId=${businessId}`;
    const [blocks, setBlocks] = useState<Block[] | null>(null);
    const [editing, setEditing] = useState(false);
    const [wholeDays, setWholeDays] = useState(true);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        apiGet<{ blocks: Block[] }>(endpoint).then(result => {
            if (!active) return;
            if (result.ok) setBlocks(result.data.blocks);
            else setLoadError(result.message);
        });
        return () => { active = false; };
    }, [endpoint, retry]);

    function toggleEditor(open: boolean) {
        setEditing(open);
        setWholeDays(true);
        setError("");
        setNotice("");
    }

    async function add(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const data = new FormData(event.currentTarget);
        let startsAt = String(data.get("blockStart"));
        let endsAt = String(data.get("blockEnd"));
        if (wholeDays) {
            const lastDay = parseDay(endsAt);
            if (!lastDay || endsAt < startsAt) {
                setError("Elige una fecha final igual o posterior a la inicial.");
                return;
            }
            lastDay.setUTCDate(lastDay.getUTCDate() + 1);
            startsAt += "T00:00";
            endsAt = lastDay.toISOString().slice(0, 10) + "T00:00";
        }
        setBusy(true);
        setError("");
        setNotice("");
        const result = await apiPost<{ block: Block }>(endpoint, { startsAt, endsAt });
        if (result.ok) {
            const { block } = result.data;
            setBlocks(previous => [...(previous ?? []).filter(item => item.id !== block.id), block]
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
            setEditing(false);
            setNotice("Horario bloqueado.");
        } else setError(result.message);
        setBusy(false);
    }

    async function remove(id: number) {
        if (busy) return;
        toggleEditor(false);
        setBusy(true);
        const result = await apiDelete(`${endpoint}&id=${id}`);
        if (result.ok) {
            setBlocks(previous => previous?.filter(block => block.id !== id) ?? null);
            setNotice("Bloqueo eliminado.");
        } else setError(result.message);
        setBusy(false);
    }

    const errorMessage = error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>;

    return (
        <section aria-labelledby="schedule-blocks-title" className="min-w-0 rounded-xl border border-indigo-100 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 id="schedule-blocks-title" className="font-bold text-slate-900">Bloqueos del negocio</h3>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">Todos los servicios</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Cierra horas o días. Las citas ya confirmadas siguen en la agenda.</p>
                </div>
                <button type="button" className={panelSecondary} disabled={busy || !blocks} aria-expanded={editing}
                    onClick={() => toggleEditor(!editing)}>
                    <span aria-hidden="true">+</span> Nuevo bloqueo
                </button>
            </header>

            <div className="space-y-3 px-4 py-4 sm:px-5">
                {loadError && (
                    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        <p>No se pudieron cargar los bloqueos. {loadError}</p>
                        <button type="button" className={panelSecondary} onClick={() => { setLoadError(""); setRetry(n => n + 1); }}>Reintentar</button>
                    </div>
                )}
                {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
                {!editing && errorMessage}
                {editing && (
                    <form onSubmit={add} className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:p-4">
                        <fieldset disabled={busy}>
                            <legend className="mb-2 text-sm font-semibold text-slate-900">Tipo de bloqueo</legend>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: true, label: "Días completos" },
                                    { value: false, label: "Por horas" }
                                ].map(option => (
                                    <label key={option.label} className="cursor-pointer">
                                        <input type="radio" name="block-kind" className="peer sr-only" checked={wholeDays === option.value}
                                            onChange={() => { setWholeDays(option.value); setError(""); }} />
                                        <span className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 peer-checked:border-indigo-300 peer-checked:bg-indigo-100 peer-checked:text-indigo-900 peer-focus-visible:outline-2 peer-focus-visible:outline-indigo-700">
                                            {option.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                        <div key={String(wholeDays)} className="grid max-w-xl gap-3 sm:grid-cols-2">
                            <Input id="blockStart" name="blockStart" type={wholeDays ? "date" : "datetime-local"} label="Desde" autoFocus={wholeDays}
                                required disabled={busy} className="min-w-0 w-full bg-white text-sm" />
                            <Input id="blockEnd" name="blockEnd" type={wholeDays ? "date" : "datetime-local"} label={wholeDays ? "Hasta (inclusive)" : "Hasta"}
                                required disabled={busy} className="min-w-0 w-full bg-white text-sm" />
                        </div>
                        {errorMessage}
                        <div className="flex flex-wrap gap-2">
                            <button type="submit" className={panelPrimary} disabled={busy}>{busy ? "Guardando…" : "Bloquear"}</button>
                            <button type="button" className={panelSecondary} disabled={busy} onClick={() => toggleEditor(false)}>Cancelar</button>
                        </div>
                    </form>
                )}
                {!blocks && !loadError && <p role="status" className="text-sm text-slate-600">Cargando bloqueos…</p>}
                {blocks?.length === 0 && <p className="rounded-lg border border-dashed border-indigo-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">No hay bloqueos vigentes.</p>}
                {!!blocks?.length && (
                    <ul className="space-y-2">
                        {blocks.map(block => {
                            const { kind, range } = blockLabel(block);
                            return (
                                <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">{kind}</span>
                                        <span className="text-sm text-slate-800">{range}</span>
                                    </div>
                                    <button type="button" disabled={busy} onClick={() => remove(block.id)}
                                        aria-label={`Quitar bloqueo, ${range}`}
                                        className="rounded-md px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50">
                                        Quitar bloqueo
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
