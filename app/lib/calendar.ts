export const calendarTimeZone = "America/Costa_Rica";
export const defaultDuration = 30;
export const maxDuration = 480;
export const maxAppointmentDescription = 500;
export const calendarDays = 60;
export const weekDays = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const dateKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone: calendarTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

export function calendarDate(date: Date) {
    return dateKey.format(date);
}

export function parseDay(value: unknown): Date | null {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const day = new Date(value + "T00:00:00Z");
    return Number.isFinite(+day) && day.toISOString().slice(0, 10) === value ? day : null;
}

export function calendarInstant(day: string, time: string) {
    // Costa Rica uses UTC−06:00 year-round.
    return new Date(`${day}T${time}:00-06:00`);
}

export function formatAppointment(value: Date | string) {
    return new Intl.DateTimeFormat("es-CR", {
        timeZone: calendarTimeZone,
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}
