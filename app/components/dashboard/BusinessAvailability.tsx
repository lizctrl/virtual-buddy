"use client";

import { useEffect, useState, type FormEvent } from "react";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import { apiDelete, apiGet, apiPost } from "@/app/lib/api/client";
import { weekDays } from "@/app/lib/calendar";
import ScheduleBlocks from "./ScheduleBlocks";
import { loadCatalogs, type Catalog } from "./business-catalogs";
import { panelPrimary, panelSecondary } from "./panel-styles";

const weekdays = [
    ...weekDays.slice(1),
    weekDays[0]
].map((value, index) => ({
    value,
    label: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][index]
}));

const dateLabel = new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeZone: "UTC" });
const quietAction = "rounded-md px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50";

interface TimeWindow {
    id: number;
    startTime: string;
    endTime: string;
}

interface WeeklyWindow extends TimeWindow {
    weekDay: string;
}

interface DatedWindow extends TimeWindow {
    date: string;
    status: string;
}

type ScheduleResource = "workingHours" | "availability";

export default function BusinessAvailability({ businessId }: { businessId: number }) {
    const [catalogs, setCatalogs] = useState<Catalog[] | null>(null);
    const [serviceId, setServiceId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        loadCatalogs(businessId).then(result => {
            if (!active) return;
            if (result.ok) setCatalogs(result.data);
            else setError(result.message);
        });
        return () => { active = false; };
    }, [businessId, retry]);

    const services = catalogs?.flatMap(catalog => catalog.services.map(service => ({
        value: service.id, label: `${service.name} · ${catalog.name}`
    }))) ?? [];
    const selected = services.find(service => service.value === serviceId) ?? services[0];

    return (
        <section lang="es" aria-labelledby="availability-title" className="rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-indigo-100 bg-white px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <span className="shrink-0 rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
                        <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 1.5" />
                        </svg>
                    </span>
                    <div>
                        <h2 id="availability-title" className="text-lg font-bold text-slate-900">Disponibilidad</h2>
                        <p className="text-xs text-slate-600">Define cuándo tus clientes pueden reservar.</p>
                    </div>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">Hora de Costa Rica</span>
            </header>

            <div className="space-y-4 p-3 sm:p-4">
                <ScheduleBlocks businessId={businessId} />

                <section aria-labelledby="service-schedule-title" className="min-w-0 rounded-xl border border-indigo-100 bg-white">
                    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                        <div>
                            <h3 id="service-schedule-title" className="font-bold text-slate-900">Horarios por servicio</h3>
                            <p className="mt-1 text-sm text-slate-600">Elige un servicio para ver y ajustar su disponibilidad.</p>
                        </div>
                        {selected && (
                            <div className="w-full min-w-0 sm:w-56">
                                <Select id="availability-service" label="Servicio" value={selected.value} options={services}
                                    onChange={event => setServiceId(Number(event.target.value))}
                                    className="min-h-10 w-full min-w-0 bg-white text-sm" />
                            </div>
                        )}
                    </header>

                    {error ? (
                        <div role="alert" className="flex flex-wrap items-center gap-3 p-4 text-sm text-rose-800">
                            <p>No se pudieron cargar los servicios. {error}</p>
                            <button type="button" className={panelSecondary} onClick={() => { setError(""); setRetry(n => n + 1); }}>Reintentar</button>
                        </div>
                    ) : !catalogs ? (
                        <p role="status" className="p-4 text-sm text-slate-600">Cargando servicios…</p>
                    ) : selected ? (
                        <ServiceSchedule key={selected.value} serviceId={selected.value} />
                    ) : (
                        <p className="m-4 rounded-xl border border-dashed border-indigo-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                            Agrega un servicio en Catálogos y servicios para configurar su horario.
                        </p>
                    )}
                </section>
            </div>
        </section>
    );
}

function ServiceSchedule({ serviceId }: { serviceId: number }) {
    const [weekly, setWeekly] = useState<WeeklyWindow[] | null>(null);
    const [dated, setDated] = useState<DatedWindow[] | null>(null);
    const [editor, setEditor] = useState<ScheduleResource | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loadError, setLoadError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        const query = `serviceId=${serviceId}&state=true&limit=100`;
        Promise.all([
            apiGet<{ workingHours: WeeklyWindow[] }>(`/api/v1/workingHours?${query}`),
            apiGet<{ availabilities: DatedWindow[] }>(`/api/v1/availability?${query}`)
        ]).then(([hours, slots]) => {
            if (!active) return;
            if (hours.ok) setWeekly(hours.data.workingHours);
            if (slots.ok) setDated(slots.data.availabilities);
            if (!hours.ok || !slots.ok) setLoadError(!hours.ok ? hours.message : slots.message);
        });
        return () => { active = false; };
    }, [serviceId, retry]);

    function open(next: ScheduleResource | null) {
        setEditor(next);
        setError("");
        setNotice("");
    }

    async function add(event: FormEvent<HTMLFormElement>, resource: ScheduleResource) {
        event.preventDefault();
        if (saving) return;
        const values = new FormData(event.currentTarget);
        const startTime = String(values.get("startTime"));
        const endTime = String(values.get("endTime"));
        if (endTime <= startTime) {
            setError("La hora final debe ser posterior a la hora inicial.");
            return;
        }
        setSaving(true);
        setError("");
        setNotice("");
        const interval = { serviceId, startTime, endTime };
        if (resource === "workingHours") {
            const result = await apiPost<{ workingHours: WeeklyWindow }>("/api/v1/workingHours", { ...interval, weekDay: values.get("weekDay") });
            if (!result.ok) {
                setError(result.message);
                setSaving(false);
                return;
            }
            setWeekly(previous => [...(previous ?? []), result.data.workingHours]);
        } else {
            const result = await apiPost<{ availability: DatedWindow }>("/api/v1/availability", { ...interval, date: values.get("date") });
            if (!result.ok) {
                setError(result.message);
                setSaving(false);
                return;
            }
            setDated(previous => [...(previous ?? []), result.data.availability]);
        }
        setEditor(null);
        setSaving(false);
        setNotice(resource === "workingHours" ? "Horario semanal agregado." : "Apertura agregada.");
    }

    async function remove(resource: ScheduleResource, id: number) {
        if (saving) return;
        open(null);
        setSaving(true);
        const result = await apiDelete(`/api/v1/${resource}/${id}`);
        if (!result.ok) setError(result.message);
        else {
            if (resource === "workingHours") setWeekly(previous => previous?.filter(window => window.id !== id) ?? null);
            else setDated(previous => previous?.filter(window => window.id !== id) ?? null);
            setNotice(resource === "workingHours" ? "Horario eliminado." : "Apertura eliminada.");
        }
        setSaving(false);
    }

    const errorMessage = error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>;
    const extraDays = [...new Set((weekly ?? []).map(window => window.weekDay.toLowerCase()))]
        .filter(day => !weekdays.some(weekday => weekday.value.toLowerCase() === day))
        .map(day => ({ value: day, label: day || "Día sin especificar" }));
    const datedSorted = [...(dated ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    return (
        <div className="space-y-3 p-3 sm:p-4">
            {loadError && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    <p>No se pudo cargar el horario completo. {loadError}</p>
                    <button type="button" className={panelSecondary} disabled={saving} onClick={() => { setLoadError(""); setRetry(n => n + 1); }}>Reintentar</button>
                </div>
            )}
            {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
            {!editor && errorMessage}

            <div className="grid items-start gap-3 xl:grid-cols-2">
                <section className="min-w-0 rounded-xl border border-indigo-100 bg-slate-50/70 p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h4 className="font-semibold text-slate-900">Horario semanal</h4>
                            <p className="mt-0.5 text-xs text-slate-600">Se repite cada semana.</p>
                        </div>
                        <button type="button" className={panelSecondary} aria-expanded={editor === "workingHours"} disabled={saving || !weekly}
                            onClick={() => open(editor === "workingHours" ? null : "workingHours")}>
                            <span aria-hidden="true">+</span> Agregar horario
                        </button>
                    </div>
                    {editor === "workingHours" && (
                        <WindowForm resource="workingHours" saving={saving} onSubmit={add} onClose={() => open(null)}>{errorMessage}</WindowForm>
                    )}
                    {weekly ? (
                        <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                            {[...weekdays, ...extraDays].map(day => {
                                const windows = weekly.filter(window => window.weekDay.toLowerCase() === day.value.toLowerCase())
                                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                                return (
                                    <div key={day.value} className="grid min-h-11 grid-cols-[5.1rem_minmax(0,1fr)] items-start gap-1 px-2.5 py-2 text-sm sm:px-3">
                                        <dt className="pt-1 font-medium text-slate-800">{day.label}</dt>
                                        <dd className="space-y-1">
                                            {windows.length ? windows.map(window => (
                                                <div key={window.id} className="flex flex-wrap items-center justify-between gap-x-1">
                                                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold tabular-nums text-indigo-800">{window.startTime} – {window.endTime}</span>
                                                    <button type="button" disabled={saving} className={quietAction}
                                                        aria-label={`Quitar horario del ${day.label}, ${window.startTime} a ${window.endTime}`}
                                                        onClick={() => remove("workingHours", window.id)}>Quitar</button>
                                                </div>
                                            )) : <span className="inline-block pt-1 text-xs text-slate-500">Sin horario semanal</span>}
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                    ) : !loadError && <p role="status" className="mt-3 text-sm text-slate-600">Cargando horario…</p>}
                </section>

                <section className="min-w-0 rounded-xl border border-indigo-100 bg-slate-50/70 p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h4 className="font-semibold text-slate-900">Aperturas puntuales</h4>
                            <p className="mt-0.5 text-xs text-slate-600">Disponibilidad extra en una fecha específica.</p>
                        </div>
                        <button type="button" className={panelSecondary} aria-expanded={editor === "availability"} disabled={saving || !dated}
                            onClick={() => open(editor === "availability" ? null : "availability")}>
                            <span aria-hidden="true">+</span> Agregar apertura
                        </button>
                    </div>
                    {editor === "availability" && (
                        <WindowForm resource="availability" saving={saving} onSubmit={add} onClose={() => open(null)}>{errorMessage}</WindowForm>
                    )}
                    {datedSorted.length > 0 && (
                        <ul className="mt-3 space-y-2">
                            {datedSorted.map(window => {
                                const date = dateLabel.format(new Date(window.date));
                                return (
                                    <li key={window.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{date}</p>
                                            <p className="mt-0.5 text-xs tabular-nums text-slate-600">{window.startTime} – {window.endTime}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${window.status === "available" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                                {window.status === "available" ? "Disponible" : window.status === "blocked" ? "Bloqueada" : window.status}
                                            </span>
                                            <button type="button" disabled={saving} className={quietAction}
                                                aria-label={`Quitar apertura del ${date}, ${window.startTime} a ${window.endTime}`}
                                                onClick={() => remove("availability", window.id)}>Quitar</button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {dated?.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-indigo-200 bg-white px-3 py-4 text-sm text-slate-600">No hay aperturas puntuales.</p>}
                    {!dated && !loadError && <p role="status" className="mt-3 text-sm text-slate-600">Cargando aperturas…</p>}
                </section>
            </div>
        </div>
    );
}

function WindowForm({ resource, saving, onSubmit, onClose, children }: {
    resource: ScheduleResource;
    saving: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>, resource: ScheduleResource) => void;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <form onSubmit={event => onSubmit(event, resource)} className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
            {resource === "workingHours" ? (
                <Select id="schedule-weekday" name="weekDay" label="Día de la semana" options={weekdays} autoFocus disabled={saving} className="w-full bg-white text-sm" />
            ) : (
                <Input id="schedule-date" name="date" type="date" label="Fecha" autoFocus required disabled={saving} className="min-w-0 w-full bg-white text-sm" />
            )}
            <div className="grid grid-cols-2 gap-2">
                <Input id="schedule-start" name="startTime" type="time" label="Desde" required disabled={saving} className="min-w-0 w-full bg-white text-sm" />
                <Input id="schedule-end" name="endTime" type="time" label="Hasta" required disabled={saving} className="min-w-0 w-full bg-white text-sm" />
            </div>
            {children}
            <div className="flex flex-wrap gap-2">
                <button type="submit" className={panelPrimary} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
                <button type="button" className={panelSecondary} disabled={saving} onClick={onClose}>Cancelar</button>
            </div>
        </form>
    );
}
