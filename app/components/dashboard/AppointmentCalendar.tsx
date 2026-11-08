"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiPut, type Pagination } from "@/app/lib/api/client";
import { calendarDate, calendarInstant, parseDay } from "@/app/lib/calendar";
import AgendaDay from "./AgendaDay";
import { businessName, compactTime, dayLength, serviceName, tones, toneFor, type Appointment, type Block } from "./agenda-events";

const weekdays = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const monthLabel = new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric", timeZone: "UTC" });
const dateLabel = new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function dayKey(day: Date) {
    return day.toISOString().slice(0, 10);
}

function monthDays(month: Date) {
    const offset = (month.getUTCDay() + 6) % 7;
    const start = +month - offset * dayLength;
    const nextMonth = new Date(month);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const weeks = Math.ceil((+nextMonth - start) / (7 * dayLength));
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(start + i * dayLength));
}

async function loadAppointments(params: URLSearchParams) {
    const appointments: Appointment[] = [];

    for (let page = 1; ; page++) {
        params.set("page", String(page));
        const result = await apiGet<{ appointments: Appointment[]; pagination: Pagination }>(`/api/v1/appointment?${params}`);
        if (!result.ok) return result;
        appointments.push(...result.data.appointments);
        if (!result.data.pagination.hasNextPage) return { ok: true as const, data: appointments };
    }
}

type CalendarProps =
    | { mode: "personal" }
    | { mode: "business"; ownerId: number; businessId: number; onManageAvailability: () => void };

const control = "inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600";

export default function AppointmentCalendar(props: CalendarProps) {
    const personal = props.mode === "personal";
    const ownerId = personal ? undefined : props.ownerId;
    const businessId = personal ? undefined : props.businessId;
    const title = personal ? "Mis citas" : "Agenda del negocio";
    const Heading = personal ? "h1" : "h2";
    const today = calendarDate(new Date());
    const [selected, setSelected] = useState(today);
    const [view, setView] = useState<"month" | "day">("month");
    const moveFocus = useRef(false);
    const selectedDayButton = useRef<HTMLButtonElement>(null);
    const backButton = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!moveFocus.current) return;
        moveFocus.current = false;
        const target = view === "month" ? selectedDayButton.current : backButton.current;
        target?.focus({ preventScroll: true });
    }, [view]);

    const monthKey = selected.slice(0, 7);
    const month = parseDay(monthKey + "-01")!;
    const days = monthDays(month);
    const from = calendarInstant(dayKey(days[0]), "00:00").toISOString();
    const to = calendarInstant(dayKey(new Date(+days[days.length - 1] + dayLength)), "00:00").toISOString();

    const [snapshot, setSnapshot] = useState<{ from: string; appointments: Appointment[]; blocks: Block[] } | null>(null);
    const [failure, setFailure] = useState<{ from: string; message: string } | null>(null);
    const data = snapshot?.from === from ? snapshot : null;
    const loadError = failure?.from === from ? failure.message : "";
    const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null);
    const [saving, setSaving] = useState<number | null>(null);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        const params = new URLSearchParams({
            state: "true", dueDateFrom: from, dueDateTo: to, limit: "100", sortBy: "dueDate", sortOrder: "asc"
        });
        if (personal) {
            params.set("mine", "true");
            params.set("business", "true");
        } else {
            params.set("ownerId", String(ownerId));
            params.set("businessId", String(businessId));
        }
        const blockParams = new URLSearchParams({ businessId: String(businessId), from, to });
        Promise.all([
            loadAppointments(params),
            personal
                ? Promise.resolve({ ok: true as const, data: { blocks: [] } })
                : apiGet<{ blocks: Block[] }>(`/api/v1/schedule-block?${blockParams}`)
        ]).then(([appointments, blocks]) => {
            if (!active) return;
            if (!appointments.ok) setFailure({ from, message: appointments.message });
            else if (!blocks.ok) setFailure({ from, message: blocks.message });
            else {
                setFailure(null);
                setSnapshot({ from, appointments: appointments.data, blocks: blocks.data.blocks });
            }
        });
        return () => { active = false; };
    }, [personal, ownerId, businessId, from, to, retry]);

    const byDay = new Map<string, Appointment[]>();
    for (const appointment of data?.appointments ?? []) {
        const key = calendarDate(new Date(appointment.dueDate));
        const items = byDay.get(key) ?? [];
        items.push(appointment);
        byDay.set(key, items);
    }
    const selectedDate = parseDay(selected)!;
    const appointments = byDay.get(selected) ?? [];
    const blocksForDay = (key: string) => {
        const start = calendarInstant(key, "00:00");
        const end = new Date(+start + dayLength);
        return (data?.blocks ?? []).filter(block => new Date(block.startsAt) < end && new Date(block.endsAt) > start);
    };
    const selectedBlocks = blocksForDay(selected);
    const loading = !data && !loadError;

    function selectDay(day: string) {
        setActionError(null);
        setSelected(day);
    }

    function changeView(next: "month" | "day") {
        if (next === view) return;
        moveFocus.current = true;
        setView(next);
    }

    function moveMonth(offset: number) {
        month.setUTCMonth(month.getUTCMonth() + offset);
        selectDay(dayKey(month));
    }

    function movePeriod(offset: number) {
        if (view === "day") selectDay(dayKey(new Date(+selectedDate + offset * dayLength)));
        else moveMonth(offset);
    }

    async function updateStatus(appointment: Appointment, status: string) {
        if (personal || saving !== null) return;
        if (status === "cancelled" && !window.confirm("¿Cancelar la cita y liberar su horario?")) return;
        setActionError(null);
        setSaving(appointment.id);
        const result = await apiPut<{ appointment: { status: string } }>(`/api/v1/appointment/${appointment.id}`, { status });
        if (result.ok) {
            setSnapshot(previous => previous && ({
                ...previous,
                appointments: previous.appointments.map(item =>
                    item.id === appointment.id ? { ...item, status: result.data.appointment.status } : item
                )
            }));
        } else setActionError({ id: appointment.id, message: result.message });
        setSaving(null);
    }

    const monthGrid = (
        <>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-600 uppercase sm:gap-1.5 sm:text-xs" aria-hidden="true">
                {weekdays.map(label => <span key={label}>{label}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1" aria-busy={loading}>
                {days.map(day => {
                    const key = dayKey(day);
                    const entries = [
                        ...blocksForDay(key).map(block => ({ key: `block-${block.id}`, text: "Bloqueo", subtitle: undefined, status: "block" })),
                        ...(byDay.get(key) ?? []).map(a => ({
                            key: `appointment-${a.id}`,
                            text: `${compactTime.format(new Date(a.dueDate))} · ${serviceName(a)}`,
                            subtitle: personal ? businessName(a) : undefined,
                            status: a.status
                        }))
                    ];
                    const dayAppointments = (byDay.get(key) ?? []).length;
                    const dayBlocks = entries.length - dayAppointments;
                    const currentMonth = key.startsWith(monthKey);
                    return (
                        <button key={key} type="button"
                            ref={view === "month" && key === selected ? selectedDayButton : undefined}
                            onClick={() => { selectDay(key); changeView("day"); }}
                            aria-current={key === today ? "date" : undefined}
                            aria-pressed={key === selected}
                            aria-label={`${dateLabel.format(day)}${dayAppointments ? `, ${dayAppointments} ${dayAppointments === 1 ? "cita" : "citas"}` : ""}${dayBlocks ? `, ${dayBlocks} ${dayBlocks === 1 ? "bloqueo" : "bloqueos"}` : ""}`}
                            className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-indigo-700 ${view === "day" ? "min-h-8 justify-center" : "min-h-14 p-1 sm:min-h-24 sm:items-stretch sm:p-1.5"} ${key === selected
                                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                                : currentMonth ? "border-white bg-white hover:border-indigo-300" : "border-transparent bg-white/50 text-slate-500 hover:border-indigo-200"}`}>
                            <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${view === "month" ? "sm:self-end" : ""} ${key === today ? "bg-indigo-700 text-white" : ""}`}>
                                {day.getUTCDate()}
                            </span>
                            <span className={`flex max-w-full items-center gap-0.5 ${view === "month" ? "sm:hidden" : ""}`} aria-hidden="true">
                                {entries.slice(0, 3).map(entry => <span key={entry.key} className={`${view === "day" ? "size-1" : "size-1.5"} rounded-full ${toneFor(entry.status).dot}`} />)}
                            </span>
                            <span className={view === "month" ? "hidden min-w-0 space-y-1 sm:block" : "hidden"} aria-hidden="true">
                                {entries.slice(0, 2).map(entry => (
                                    <span key={entry.key} className={`block truncate rounded px-1.5 py-1 text-[11px] font-medium leading-tight ${toneFor(entry.status).chip}`}>
                                        {entry.subtitle ? (
                                            <><span className="block truncate">{entry.text}</span><span className="block truncate opacity-90">{entry.subtitle}</span></>
                                        ) : entry.text}
                                    </span>
                                ))}
                                {entries.length > 2 && <span className="block px-1 text-[11px] font-semibold text-slate-600">+{entries.length - 2} más</span>}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );

    return (
        <section lang="es" aria-label={title}
            className="rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-indigo-100 bg-white px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
                        <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                            <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2" />
                        </svg>
                    </span>
                    <div>
                        <Heading className="text-lg font-bold text-slate-900">{title}</Heading>
                        <p className="text-xs text-slate-600">Hora de Costa Rica</p>
                    </div>
                </div>
                {props.mode === "business" ? (
                    <button type="button" onClick={props.onManageAvailability}
                        className="rounded-lg bg-indigo-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">
                        Gestionar horarios
                    </button>
                ) : (
                    <Link href="/explore" className={control}>Explorar servicios</Link>
                )}
            </header>

            <div className="p-2.5 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    {view === "day" ? (
                        <button ref={backButton} type="button" onClick={() => changeView("month")}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                            <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 5-7 7 7 7M5 12h14" />
                            </svg>
                            Volver al calendario
                        </button>
                    ) : (
                        <h3 className="px-1 text-base font-bold text-slate-900 first-letter:uppercase sm:text-lg">{monthLabel.format(month)}</h3>
                    )}
                    <div className="flex gap-1.5">
                        <button type="button" aria-label={view === "day" ? "Día anterior" : "Mes anterior"} className={control} onClick={() => movePeriod(-1)}>‹</button>
                        <button type="button" className={control} onClick={() => selectDay(today)}>Hoy</button>
                        <button type="button" aria-label={view === "day" ? "Día siguiente" : "Mes siguiente"} className={control} onClick={() => movePeriod(1)}>›</button>
                    </div>
                </div>

                {loadError && (
                    <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-white p-3 text-sm text-red-800">
                        <p>No se pudo cargar la agenda. {loadError}</p>
                        <button type="button" className={control} onClick={() => { setFailure(null); setRetry(n => n + 1); }}>Reintentar</button>
                    </div>
                )}

                {view === "day" ? (
                    <AgendaDay key={selected} day={selected} title={dateLabel.format(selectedDate)} appointments={appointments}
                        blocks={selectedBlocks} loading={loading} loadError={loadError} actionError={actionError}
                        saving={saving} personal={personal} updateStatus={personal ? undefined : updateStatus}
                        calendar={
                            <section aria-label="Calendario mensual" className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between gap-1">
                                    <h4 className="text-xs font-bold text-slate-900 first-letter:uppercase">{monthLabel.format(month)}</h4>
                                    <div className="flex text-sm text-slate-700">
                                        <button type="button" aria-label="Mes anterior" onClick={() => moveMonth(-1)} className="rounded px-2 py-1 hover:bg-indigo-50">‹</button>
                                        <button type="button" aria-label="Mes siguiente" onClick={() => moveMonth(1)} className="rounded px-2 py-1 hover:bg-indigo-50">›</button>
                                    </div>
                                </div>
                                {monthGrid}
                            </section>
                        }
                    />
                ) : (
                    <>
                        {loading && <p role="status" className="mb-2 px-1 text-sm text-slate-600">Cargando agenda…</p>}
                        {monthGrid}
                    </>
                )}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 pb-1 text-xs text-slate-700">
                        {[tones.confirmed, tones.pending, { ...tones.cancelled, label: "Cancelada o rechazada" }, ...(!personal ? [tones.block] : [])].map(tone => (
                            <span key={tone.label} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${tone.dot}`} />{tone.label}</span>
                        ))}
                    </div>
            </div>
        </section>
    );
}
