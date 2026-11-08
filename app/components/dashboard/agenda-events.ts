import { calendarTimeZone, defaultDuration } from "@/app/lib/calendar";

export interface Appointment {
    id: number;
    userId: number;
    user?: { name: string; last_name: string; email?: string; phone?: string };
    serviceId: number;
    service?: { name: string; catalog?: { business: { id: number; name: string } } };
    status: string;
    dueDate: string;
    endsAt: string | null;
    description?: string | null;
}

export interface Block {
    id: number;
    startsAt: string;
    endsAt: string;
}

export const dayLength = 86_400_000;
export const compactTime = new Intl.DateTimeFormat("es-CR", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: calendarTimeZone
});

export const tones = {
    confirmed: { label: "Confirmada", chip: "bg-indigo-100 text-indigo-900", dot: "bg-indigo-500" },
    pending: { label: "Pendiente", chip: "bg-rose-100 text-rose-900", dot: "bg-rose-500" },
    cancelled: { label: "Cancelada", chip: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
    rejected: { label: "Rechazada", chip: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
    block: { label: "Bloqueo", chip: "bg-amber-100 text-amber-950", dot: "bg-amber-500" }
};

export function toneFor(status: string) {
    return Object.hasOwn(tones, status)
        ? tones[status as keyof typeof tones]
        : { ...tones.cancelled, label: status };
}

export function appointmentEnd(appointment: Appointment) {
    return appointment.endsAt ? new Date(appointment.endsAt) : new Date(+new Date(appointment.dueDate) + defaultDuration * 60_000);
}

export function appointmentHours(appointment: Appointment) {
    return `${compactTime.format(new Date(appointment.dueDate))} – ${compactTime.format(appointmentEnd(appointment))}`;
}

export function clientName(appointment: Appointment) {
    const user = appointment.user;
    return (user && `${user.name} ${user.last_name}`.trim()) || `Cliente #${appointment.userId}`;
}

export function serviceName(appointment: Appointment) {
    return appointment.service?.name ?? `Servicio #${appointment.serviceId}`;
}


export function businessName(appointment: Appointment) {
    return appointment.service?.catalog?.business.name ?? "Negocio no disponible";
}
