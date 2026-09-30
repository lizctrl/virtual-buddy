/**
 * `Availability.startTime` / `endTime` and `WorkingHours.startTime` /
 * `endTime` are `DateTime` columns, but every client already declares them
 * as `string`, and the UI feeds them `<input type="time">` values such as
 * "09:00" — which `new Date()` rejects outright.
 *
 * These helpers convert between the "HH:mm" the UI speaks and a Date the
 * driver accepts. Everything is pinned to UTC so a value survives the round
 * trip unchanged regardless of the server's timezone.
 */

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Working hours have no calendar date, so they need a fixed anchor. */
const ANCHOR_DATE = "1970-01-01";

/**
 * Parses "HH:mm" (optionally combined with a calendar date) or any full
 * timestamp. Returns null when the value is not a usable time.
 */
export function toTimeOfDay(
    value: unknown,
    date?: unknown
): Date | null {
    if (typeof value !== "string") return null;

    const time = value.trim();
    if (!time) return null;

    const day =
        typeof date === "string" && date.trim()
            ? date.trim()
            : ANCHOR_DATE;

    if (TIME_OF_DAY.test(time)) {
        const parsed = new Date(`${day}T${time}:00.000Z`);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Already a full timestamp, e.g. echoed back from a previous read.
    const parsed = new Date(time);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/** Renders a stored time back as the "HH:mm" string the UI expects. */
export function toTimeString(value: Date | string): string {
    const date = typeof value === "string" ? new Date(value) : value;
    if (isNaN(date.getTime())) return "";
    return date.toISOString().slice(11, 16);
}

/** Applies {@link toTimeString} to the time columns of a row. */
export function withTimeStrings<
    T extends { startTime: Date | string; endTime: Date | string }
>(row: T): Omit<T, "startTime" | "endTime"> & {
    startTime: string;
    endTime: string;
} {
    const { startTime, endTime, ...rest } = row;

    return {
        ...rest,
        startTime: toTimeString(startTime),
        endTime: toTimeString(endTime)
    };
}
