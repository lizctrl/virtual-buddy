"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/layout/AppLayout";
import NotificationIcon, { type NotificationKind } from "@/app/components/ui/NotificationIcon";
import { panelSecondary } from "@/app/components/dashboard/panel-styles";
import { apiGet, type Pagination } from "@/app/lib/api/client";
import { calendarDate, calendarTimeZone, formatAppointment } from "@/app/lib/calendar";

interface Notice {
    id: number;
    createTime: string;
    title: string;
    content: string;
    appointment?: {
        dueDate: string;
        user: { name: string; last_name: string };
        service: { name: string; catalog: { business: { name: string } } };
    };
}

const styles: Record<NotificationKind, string> = {
    bell: "bg-indigo-100 text-indigo-800",
    booking: "bg-indigo-100 text-indigo-800",
    confirmed: "bg-emerald-100 text-emerald-900",
    cancelled: "bg-rose-100 text-rose-900",
    updated: "bg-amber-100 text-amber-950"
};

const presentations = new Map<string, { title: string; kind: NotificationKind }>([
    ["new appointment booked", { title: "Nueva reserva", kind: "booking" }],
    ["cita confirmada", { title: "Cita confirmada", kind: "confirmed" }],
    ["appointment confirmed", { title: "Cita confirmada", kind: "confirmed" }],
    ["cita cancelada", { title: "Cita cancelada", kind: "cancelled" }],
    ["appointment cancelled", { title: "Cita cancelada", kind: "cancelled" }],
    ["appointment rejected", { title: "Cita rechazada", kind: "cancelled" }],
    ["cita actualizada", { title: "Cita actualizada", kind: "updated" }]
]);

const dateLabel = new Intl.DateTimeFormat("es-CR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: calendarTimeZone
});
const timeLabel = new Intl.DateTimeFormat("es-CR", { timeStyle: "short", timeZone: calendarTimeZone });

function NoticeCard({ notice }: { notice: Notice }) {
    const { title, kind } = presentations.get(notice.title.trim().toLowerCase()) ?? { title: notice.title, kind: "bell" };
    const appointment = notice.appointment;
    const legacyBooking = kind === "booking" && appointment && notice.content.startsWith("A client booked ");
    const timestamp = new Date(notice.createTime);

    return (
        <li className="flex min-w-0 items-start gap-3 rounded-xl border border-indigo-100 bg-white p-3.5 shadow-sm sm:gap-4 sm:p-4">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${styles[kind]}`}>
                <NotificationIcon kind={kind} />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <h3 className="max-w-full text-sm font-bold break-words text-slate-900 sm:text-base">{title}</h3>
                    <time dateTime={notice.createTime} className="text-xs whitespace-nowrap text-slate-600">{timeLabel.format(timestamp)}</time>
                </div>
                {legacyBooking ? (
                    <>
                        <p className="mt-1 text-sm break-words text-slate-700">
                            {appointment.user.name} {appointment.user.last_name} · {appointment.service.name} · {appointment.service.catalog.business.name}
                        </p>
                        <p className="mt-1 text-xs break-words text-slate-600">Horario actual de la cita · {formatAppointment(appointment.dueDate)}</p>
                    </>
                ) : (
                    <p className="mt-1 text-sm break-words whitespace-pre-line text-slate-700">{notice.content}</p>
                )}
            </div>
        </li>
    );
}

export default function NotificationsPage() {
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const [result, setResult] = useState<{
        page: number;
        data?: { notifications: Notice[]; pagination: Pagination };
        failure?: { message: string; status: number };
    } | null>(null);
    const current = result?.page === page ? result : null;
    const data = current?.data;
    const failure = current?.failure;
    const today = calendarDate(new Date());

    useEffect(() => {
        let active = true;
        apiGet<{ notifications: Notice[]; pagination: Pagination }>(
            `/api/v1/notification?appointment=true&sortBy=createTime&sortOrder=desc&limit=20&page=${page}`
        ).then(response => {
            if (!active) return;
            if (response.ok) setResult({ page, data: response.data });
            else setResult({ page, failure: { message: response.message, status: response.status } });
        });
        return () => { active = false; };
    }, [page, retry]);

    const days = new Map<string, Notice[]>();
    for (const notice of data?.notifications ?? []) {
        const day = calendarDate(new Date(notice.createTime));
        const notices = days.get(day) ?? [];
        notices.push(notice);
        days.set(day, notices);
    }

    return (
        <AppLayout>
            <section lang="es" aria-labelledby="notifications-title" className="mx-auto max-w-5xl rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-indigo-100 bg-white px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><NotificationIcon /></span>
                        <div>
                            <h1 id="notifications-title" className="text-lg font-bold text-slate-900">Notificaciones</h1>
                            <p className="mt-0.5 text-xs text-slate-600">Actualizaciones de tus citas y de tu negocio.</p>
                        </div>
                    </div>
                    {data && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                            {data.pagination.totalItems} {data.pagination.totalItems === 1 ? "aviso" : "avisos"}
                        </span>
                    )}
                </header>

                <div className="space-y-5 p-3 sm:p-5">
                    {!current && <p role="status" className="rounded-xl bg-white p-4 text-sm text-slate-600">Cargando notificaciones…</p>}
                    {failure && (
                        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 text-sm">
                            {failure.status === 401 ? (
                                <>
                                    <p className="text-slate-700">Inicia sesión para ver tus notificaciones.</p>
                                    <Link href="/login" className={panelSecondary}>Iniciar sesión</Link>
                                </>
                            ) : (
                                <>
                                    <p className="text-rose-800">No se pudieron cargar las notificaciones. {failure.message}</p>
                                    <button type="button" className={panelSecondary} onClick={() => { setResult(null); setRetry(n => n + 1); }}>Reintentar</button>
                                </>
                            )}
                        </div>
                    )}
                    {data?.notifications.length === 0 && (
                        <div className="rounded-xl border border-dashed border-indigo-200 bg-white px-4 py-8 text-center">
                            <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><NotificationIcon /></span>
                            <p className="font-semibold text-slate-900">Todavía no tienes avisos</p>
                            <p className="mt-1 text-sm text-slate-600">Aquí aparecerán las actualizaciones de tus citas.</p>
                        </div>
                    )}
                    {[...days].map(([day, notices]) => (
                        <section key={day}>
                            <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-indigo-900 first-letter:uppercase">
                                {day === today ? "Hoy" : dateLabel.format(new Date(notices[0].createTime))}
                            </h2>
                            <ul className="space-y-2">
                                {notices.map(notice => <NoticeCard key={notice.id} notice={notice} />)}
                            </ul>
                        </section>
                    ))}
                    {data && data.pagination.totalPages > 1 && (
                        <nav aria-label="Páginas de notificaciones" className="flex flex-wrap items-center justify-between gap-2">
                            <button type="button" className={panelSecondary} disabled={!data.pagination.hasPreviousPage} onClick={() => setPage(p => p - 1)}>Anterior</button>
                            <span className="text-xs font-semibold text-slate-600">Página {page} de {data.pagination.totalPages}</span>
                            <button type="button" className={panelSecondary} disabled={!data.pagination.hasNextPage} onClick={() => setPage(p => p + 1)}>Siguiente</button>
                        </nav>
                    )}
                </div>
            </section>
        </AppLayout>
    );
}
