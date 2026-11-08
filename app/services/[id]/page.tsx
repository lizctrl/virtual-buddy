"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Button from "@/app/components/ui/Button";
import { apiGet, apiPost } from "@/app/lib/api/client";
import { calendarDate, calendarTimeZone, formatAppointment, maxAppointmentDescription } from "@/app/lib/calendar";

interface BookingOptions {
    service: { id: number; name: string; business: string; durationMinutes: number };
    starts: string[];
}

const dayLabel = new Intl.DateTimeFormat("es-CR", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC"
});
const timeLabel = new Intl.DateTimeFormat("es-CR", {
    hour: "numeric", minute: "2-digit", timeZone: calendarTimeZone
});

export default function ServiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    return <Booking key={id} id={id} />;
}

function Booking({ id }: { id: string }) {
    const endpoint = `/api/v1/service/${id}/slots`;
    const [options, setOptions] = useState<BookingOptions | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState("");
    const [selected, setSelected] = useState("");
    const [description, setDescription] = useState("");
    const [loadError, setLoadError] = useState("");
    const [bookingError, setBookingError] = useState("");
    const [needsLogin, setNeedsLogin] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState<{
        appointment: { id: number; dueDate: string };
        email: "accepted" | "unconfigured" | "failed";
    } | null>(null);

    useEffect(() => {
        let active = true;
        apiGet<BookingOptions>(endpoint).then(result => {
            if (!active) return;
            if (result.ok) setOptions(result.data);
            else setLoadError(result.message);
            setLoading(false);
        });
        return () => { active = false; };
    }, [endpoint]);

    const byDay = new Map<string, string[]>();
    for (const start of options?.starts ?? []) {
        const day = calendarDate(new Date(start));
        const times = byDay.get(day) ?? [];
        times.push(start);
        byDay.set(day, times);
    }
    const days = [...byDay.keys()];
    const day = byDay.has(selectedDay) ? selectedDay : days[0];
    const times = byDay.get(day) ?? [];

    async function book(event: React.FormEvent) {
        event.preventDefault();
        if (!selected || submitting) return;
        setSubmitting(true);
        setBookingError("");
        setNeedsLogin(false);
        const result = await apiPost<NonNullable<typeof confirmation>>("/api/v1/appointment", {
            serviceId: Number(id), dueDate: selected, description
        });
        if (result.ok) {
            setConfirmation(result.data);
        } else {
            setBookingError(result.message);
            setNeedsLogin(result.status === 401);
            if (result.status === 409) {
                setSelected("");
                const fresh = await apiGet<BookingOptions>(endpoint);
                if (fresh.ok) setOptions(fresh.data);
                else setLoadError(fresh.message);
            }
        }
        setSubmitting(false);
    }

    return (
        <main lang="es" className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
            <div className="mx-auto max-w-2xl">
                <Link href="/explore" className="text-sm font-medium text-blue-700 hover:underline">
                    ← Explorar servicios
                </Link>
                <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                    {loading && <p role="status">Cargando horarios…</p>}
                    {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
                    {options && (
                        <>
                            <p className="text-sm font-medium text-blue-700">{options.service.business}</p>
                            <h1 className="mt-1 text-3xl font-bold text-slate-900">{options.service.name}</h1>
                            <p className="mt-2 text-sm text-slate-600">
                                {options.service.durationMinutes} min · Hora de Costa Rica
                            </p>
                            {confirmation ? (
                                <div role="status" className="mt-6 rounded-xl bg-emerald-50 p-5 text-emerald-950">
                                    <h2 className="text-lg font-bold">Cita confirmada</h2>
                                    <p className="mt-1">{formatAppointment(confirmation.appointment.dueDate)} · Reserva #{confirmation.appointment.id}</p>
                                    <p className="mt-2 text-sm">
                                        {confirmation.email === "accepted"
                                            ? "Se envió la confirmación al cliente y al negocio."
                                            : "Tu reserva quedó guardada. El correo de confirmación no pudo enviarse."}
                                    </p>
                                    <Link href="/my-appointments" className="mt-4 inline-block text-sm font-semibold underline">Ver mis citas</Link>
                                </div>
                            ) : days.length === 0 ? (
                                <div className="mt-6 space-y-3">
                                    {bookingError && <p role="alert" className="text-sm text-red-700">{bookingError}</p>}
                                    <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
                                        No hay horarios disponibles en los próximos 60 días.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={book} className="mt-6 space-y-6">
                                    <div className="space-y-2">
                                        <label htmlFor="booking-day" className="block font-semibold text-slate-900">1. Elige un día</label>
                                        <select
                                            id="booking-day"
                                            className="w-full rounded-md border border-slate-300 bg-white p-3 text-slate-900"
                                            value={day}
                                            disabled={submitting}
                                            onChange={e => { setSelectedDay(e.target.value); setSelected(""); setBookingError(""); }}
                                        >
                                            {days.map(key => <option key={key} value={key}>{dayLabel.format(new Date(key))}</option>)}
                                        </select>
                                    </div>
                                    <fieldset disabled={submitting}>
                                        <legend className="mb-2 font-semibold text-slate-900">2. Elige una hora</legend>
                                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                            {times.map(start => (
                                                <label key={start} className="cursor-pointer">
                                                    <input
                                                        className="peer sr-only"
                                                        type="radio"
                                                        name="booking-time"
                                                        value={start}
                                                        checked={selected === start}
                                                        onChange={() => { setSelected(start); setBookingError(""); }}
                                                    />
                                                    <span className="block rounded-md border border-slate-300 px-1 py-2.5 text-center text-sm text-slate-800 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600">
                                                        {timeLabel.format(new Date(start))}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                    <div className="space-y-1.5">
                                        <label htmlFor="booking-description" className="block text-sm font-semibold text-slate-900">Nota para el negocio <span className="font-normal text-slate-500">(opcional)</span></label>
                                        <textarea id="booking-description" rows={2} maxLength={maxAppointmentDescription}
                                            value={description} onChange={e => setDescription(e.target.value)} disabled={submitting}
                                            placeholder="Agrega un detalle que debamos saber sobre tu cita"
                                            className="w-full rounded-md border border-slate-300 p-3 text-sm text-slate-900" />
                                    </div>
                                    {bookingError && <p role="alert" className="text-sm text-red-700">{bookingError}</p>}
                                    {needsLogin && (
                                        <Link href={`/login?next=/services/${id}`} className="block text-sm font-semibold text-blue-700 underline">
                                            Inicia sesión para continuar
                                        </Link>
                                    )}
                                    <Button type="submit" disabled={!selected || submitting} className="w-full py-3">
                                        {submitting ? "Confirmando…" : "Confirmar cita"}
                                    </Button>
                                </form>
                            )}
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}
