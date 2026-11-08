"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { calendarInstant, formatAppointment } from "@/app/lib/calendar";
import { appointmentEnd, appointmentHours, businessName, clientName, compactTime, dayLength, serviceName, toneFor, type Appointment, type Block } from "./agenda-events";

const minutesPerDay = 1440;
const hourHeight = 84;
const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const eventHeight = 42;
const minuteHeight = hourHeight / 60;

interface Event {
    appointment: Appointment;
    start: number;
    end: number;
}

function placeEvents(events: Event[]) {
    const groups: { events: (Event & { lane: number })[]; laneEnds: number[]; end: number }[] = [];

    for (const event of events) {
        let group = groups.at(-1);
        if (!group || event.start >= group.end) {
            group = { events: [], laneEnds: [], end: event.end };
            groups.push(group);
        }
        const available = group.laneEnds.findIndex(end => end <= event.start);
        const lane = available < 0 ? group.laneEnds.length : available;
        group.laneEnds[lane] = event.end;
        group.end = Math.max(group.end, event.end);
        group.events.push({ ...event, lane });
    }

    return groups.flatMap(group => group.events.map(event => ({ ...event, lanes: group.laneEnds.length })));
}

interface Props {
    day: string;
    title: string;
    appointments: Appointment[];
    blocks: Block[];
    loading: boolean;
    loadError: string;
    actionError: { id: number; message: string } | null;
    saving: number | null;
    personal: boolean;
    updateStatus?: (appointment: Appointment, status: string) => void;
    calendar: ReactNode;
}

export default function AgendaDay({ day, title, appointments, blocks, loading, loadError, actionError, saving, personal, updateStatus, calendar }: Props) {
    const relatedName = personal ? businessName : clientName;
    const scroll = useRef<HTMLDivElement>(null);
    const [detail, setDetail] = useState<{ id: number; anchor: DOMRect; trigger: HTMLElement } | null>(null);
    const activeAppointment = appointments.find(appointment => appointment.id === detail?.id);
    const midnight = +calendarInstant(day, "00:00");
    const minute = (instant: string | Date) => (+new Date(instant) - midnight) / 60_000;
    const timedBlocks = blocks.filter(block => +new Date(block.startsAt) > midnight || +new Date(block.endsAt) < midnight + dayLength);
    const wholeDay = blocks.length > timedBlocks.length;
    const events = placeEvents(appointments.map(appointment => {
        const start = Math.min(minute(appointment.dueDate), minutesPerDay - eventHeight / minuteHeight);
        const end = Math.min(minutesPerDay, Math.max(start + eventHeight / minuteHeight, minute(appointmentEnd(appointment))));
        return { appointment, start, end };
    }).sort((a, b) => a.start - b.start));

    const firstMinute = Math.min(
        events[0]?.start ?? Infinity,
        ...timedBlocks.map(block => Math.max(0, minute(block.startsAt)))
    );
    const initialHour = Math.max(0, Math.floor((Number.isFinite(firstMinute) ? firstMinute : 480) / 60) - 1);
    useEffect(() => {
        if (scroll.current) scroll.current.scrollTop = initialHour * hourHeight;
    }, [day, initialHour]);

    function showDetail(appointment: Appointment, anchor: HTMLElement, trigger = anchor) {
        setDetail({ id: appointment.id, anchor: anchor.getBoundingClientRect(), trigger });
    }

    return (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <section aria-label="Horario del día" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <h3 className="font-bold text-slate-900 first-letter:uppercase">{title}</h3>
                    <span className="text-xs text-slate-500">UTC−06:00</span>
                </div>
                {wholeDay && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">Bloqueado todo el día</p>}
                <div ref={scroll} tabIndex={0} aria-label="Línea de tiempo de 24 horas" className="relative max-h-[31rem] overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-indigo-600">
                    <div className="relative" style={{ height: hours.length * hourHeight }}>
                        {hours.map(hour => (
                            <div key={hour} className="flex border-t border-slate-100 first:border-0" style={{ height: hourHeight }}>
                                <span className="w-12 shrink-0 px-1 pt-1 text-right text-[10px] font-semibold tabular-nums text-slate-500 sm:w-16 sm:px-2 sm:text-xs">{hour}</span>
                                <span className="mt-[41px] flex-1 border-t border-dashed border-slate-100" aria-hidden="true" />
                            </div>
                        ))}
                        <div className="pointer-events-none absolute inset-y-0 right-1 left-12 border-l border-slate-100 sm:left-16">
                            {timedBlocks.map(block => {
                                const start = Math.max(0, minute(block.startsAt));
                                const end = Math.min(minutesPerDay, minute(block.endsAt));
                                return <div key={block.id}
                                    className="absolute right-0 left-0 overflow-hidden rounded-md border-l-2 border-amber-400 bg-amber-50/90 px-2 text-xs font-semibold text-amber-900"
                                    style={{ top: start * minuteHeight, height: (end - start) * minuteHeight }}>
                                    Horario bloqueado · {start === 0 ? "00:00" : compactTime.format(new Date(block.startsAt))}–{end === minutesPerDay ? "24:00" : compactTime.format(new Date(block.endsAt))}
                                </div>;
                            })}
                            {events.map(({ appointment, start, end, lane, lanes }) => {
                                const tone = toneFor(appointment.status);
                                return (
                                    <article key={appointment.id}
                                        onDoubleClick={event => {
                                            const card = event.currentTarget;
                                            showDetail(appointment, card, card.querySelector("button") ?? card);
                                        }}
                                        className={`pointer-events-auto absolute flex min-w-0 cursor-default items-start gap-1 overflow-hidden rounded-md border-l-4 border-current px-1.5 py-0.5 ${tone.chip}`}
                                        style={{ top: start * minuteHeight,
                                            height: Math.max(eventHeight, (end - start) * minuteHeight),
                                            left: `calc(${lane / lanes * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-bold">{serviceName(appointment)}</p>
                                            <p className="truncate text-[11px] leading-tight">{appointmentHours(appointment)} · {relatedName(appointment)}</p>
                                            {end - start >= 60 && appointment.description && <p className="mt-1 truncate text-xs">{appointment.description}</p>}
                                        </div>
                                        <button type="button" aria-label={`Ver detalles de ${serviceName(appointment)}, ${relatedName(appointment)}`}
                                            title="Ver detalles" className="shrink-0 rounded px-1.5 py-0.5 text-sm font-bold hover:bg-white/70 focus-visible:outline-2"
                                            onClick={event => showDetail(appointment, event.currentTarget.closest("article") ?? event.currentTarget, event.currentTarget)}>···</button>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            <aside aria-label="Calendario y citas del día" className="min-w-0 space-y-3">
                {calendar}
                <section className="rounded-xl border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-bold text-slate-900">Citas del día <span className="font-medium text-slate-500">· {appointments.length}</span></h4>
                    {loading && <p role="status" className="mt-2 text-xs text-slate-600">Cargando agenda…</p>}
                    {!loading && !loadError && !appointments.length && <p className="mt-2 text-xs text-slate-600">No hay citas para este día.</p>}
                    <ul className="mt-2 divide-y divide-slate-100">
                        {appointments.map(appointment => (
                            <li key={appointment.id}>
                                <button type="button" onClick={event => showDetail(appointment, event.currentTarget)}
                                    className="flex w-full items-start gap-2 rounded-md px-1 py-2 text-left hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${toneFor(appointment.status).dot}`} />
                                    <span className="min-w-0 break-words">
                                        <span className="block text-xs font-semibold text-slate-900">{serviceName(appointment)}</span>
                                        <span className="block text-xs text-slate-600">{appointmentHours(appointment)} · {relatedName(appointment)}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            </aside>

            {activeAppointment && detail && <AppointmentDetail appointment={activeAppointment} anchor={detail.anchor} trigger={detail.trigger}
                close={() => setDetail(null)} actionError={actionError?.id === activeAppointment.id ? actionError.message : ""} saving={saving} personal={personal} updateStatus={updateStatus} />}
        </div>
    );
}

function AppointmentDetail({ appointment, anchor, trigger, close, saving, actionError, personal, updateStatus }: {
    appointment: Appointment;
    anchor: DOMRect;
    trigger: HTMLElement;
    close: () => void;
    saving: number | null;
    actionError: string;
    personal: boolean;
    updateStatus: Props["updateStatus"];
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const headingId = useId();
    const tone = toneFor(appointment.status);
    const duration = Math.round((+appointmentEnd(appointment) - +new Date(appointment.dueDate)) / 60_000);
    const panelWidth = 352;
    const [placement] = useState(() => {
        const width = document.documentElement.clientWidth;
        const side = anchor.right + panelWidth + 12 <= width ? anchor.right + 8 : anchor.left - panelWidth - 8;
        return { "--panel-x": `${Math.max(12, Math.min(side, width - panelWidth - 12))}px`, "--panel-y": `${anchor.top}px` } as CSSProperties;
    });

    useEffect(() => {
        const panel = dialog.current;
        panel?.showModal();
        closeButton.current?.focus();
        return () => {
            panel?.close();
            if (trigger.isConnected) trigger.focus({ preventScroll: true });
        };
    }, [trigger]);

    return (
        <dialog ref={dialog} aria-labelledby={headingId} onCancel={close}
            onClick={event => { if (event.target === event.currentTarget) close(); }}
            style={placement}
            className="fixed inset-x-3 bottom-3 top-auto m-0 w-auto max-h-[calc(100dvh-24px)] max-w-none overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/25 sm:inset-auto sm:top-[clamp(12px,var(--panel-y),calc(100dvh-29rem-12px))] sm:left-[var(--panel-x)] sm:max-h-[min(29rem,calc(100dvh-24px))] sm:w-[22rem] sm:backdrop:bg-slate-950/10">
            <div className="p-4 sm:p-5">
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500">Reserva #{appointment.id}</p>
                        <h4 id={headingId} className="mt-1 break-words text-xl font-bold">{serviceName(appointment)}</h4>
                    </div>
                    <button ref={closeButton} type="button" onClick={close} aria-label="Cerrar detalle"
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-lg leading-tight text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-600">×</button>
                </header>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone.chip}`}>{tone.label}</span>
                    <p className="mt-2 text-sm font-semibold">{formatAppointment(appointment.dueDate)}</p>
                    <p className="text-xs text-slate-600">{appointmentHours(appointment)} · {duration} min{!appointment.endsAt && " aprox."} · Hora de Costa Rica</p>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-600">{personal ? "Negocio" : "Cliente"}</dt>
                        <dd className="mt-0.5 break-words font-semibold">{personal ? businessName(appointment) : clientName(appointment)}</dd>
                        {!personal && appointment.user?.email && <dd className="break-all text-xs text-slate-600">{appointment.user.email}</dd>}
                        {!personal && appointment.user?.phone && <dd className="break-words text-xs text-slate-600">{appointment.user.phone}</dd>}
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-600">Descripción de la cita</dt>
                        <dd className="mt-0.5 break-words whitespace-pre-wrap">{appointment.description || "Sin descripción."}</dd>
                    </div>
                </dl>
                {personal && (
                    <Link href={`/services/${appointment.serviceId}`} className="mt-3 inline-flex rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50">
                        Ver servicio
                    </Link>
                )}
                {actionError && <p role="alert" className="mt-3 text-sm text-red-800">{actionError}</p>}
                {updateStatus && appointment.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                        <button type="button" disabled={saving !== null} onClick={() => updateStatus(appointment, "confirmed")}
                            className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar</button>
                        <button type="button" disabled={saving !== null} onClick={() => updateStatus(appointment, "rejected")}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Rechazar</button>
                    </div>
                )}
                {updateStatus && appointment.status === "confirmed" && new Date(appointment.dueDate) > new Date() && (
                    <button type="button" disabled={saving !== null} onClick={() => updateStatus(appointment, "cancelled")}
                        className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50">Cancelar cita</button>
                )}
            </div>
        </dialog>
    );
}
