import { Prisma } from "@prisma/client";
import { toTimeString } from "@/app/lib/api/times";
import { calendarDate, calendarDays, calendarInstant, defaultDuration, parseDay, weekDays } from "@/app/lib/calendar";
import { prisma } from "@/app/lib/db";

const dayLength = 24 * 60 * 60_000;

const activeService = {
    state: true,
    catalog: { state: true, business: { state: true } }
} satisfies Prisma.ServiceWhereInput;

export function ownedService(userId: number) {
    return {
        ...activeService,
        catalog: { state: true, business: { state: true, ownerId: userId } }
    };
}

export function visibleAppointments(userId: number) {
    return {
        OR: [
            { userId },
            { service: { catalog: { business: { ownerId: userId, state: true } } } }
        ]
    } satisfies Prisma.AppointmentWhereInput;
}

// Reserve capacity across every service of the business.
export async function lockCalendar(db: Prisma.TransactionClient, businessId: number) {
    await db.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(67201, ${businessId}::int)`;
}

export async function findBookingService(db: Prisma.TransactionClient, id: number) {
    return db.service.findFirst({
        where: { id, ...activeService, catalog: {
            state: true, business: { state: true, owner: { state: true } }
        } },
        select: {
            id: true,
            name: true,
            durationMinutes: true,
            catalog: { select: {
                name: true,
                business: { select: { id: true, name: true, owner: { select: { email: true } } } }
            } }
        }
    });
}

export async function availableStarts(
    db: Prisma.TransactionClient,
    serviceId: number,
    businessId: number,
    from: Date,
    days: number,
    durationMinutes: number,
    excludedId?: number
) {
    const length = durationMinutes * 60_000;
    if (!Number.isFinite(length) || length <= 0) return [];

    const legacyLength = defaultDuration * 60_000;
    const now = new Date();
    const today = parseDay(calendarDate(now))!;
    const until = new Date(Math.min(+from + days * dayLength, +today + calendarDays * dayLength));
    if (+from >= +until || +until <= +today) return [];
    const begin = calendarInstant(from.toISOString().slice(0, 10), "00:00");
    const end = new Date(+begin + (+until - +from));
    const [hours, exceptions, blocks, appointments] = await Promise.all([
        db.workingHours.findMany({ where: { serviceId, state: true } }),
        db.availability.findMany({ where: {
            serviceId, state: true, date: { gte: from, lt: until }
        } }),
        db.scheduleBlock.findMany({ where: {
            businessId, state: true, startsAt: { lt: end }, endsAt: { gt: begin }
        } }),
        db.appointment.findMany({
            where: {
                state: true,
                status: { in: ["confirmed", "pending"] },
                ...(excludedId !== undefined && { id: { not: excludedId } }),
                dueDate: { lt: end },
                OR: [
                    { endsAt: { gt: begin } },
                    { endsAt: null, dueDate: { gt: new Date(+begin - legacyLength) } }
                ],
                service: { catalog: { businessId } }
            },
            select: { dueDate: true, endsAt: true }
        })
    ]);
    const occupied = [
        ...blocks.map(block => [ +block.startsAt, +block.endsAt ]),
        ...appointments.map(appointment => [ +appointment.dueDate, appointment.endsAt ? +appointment.endsAt : +appointment.dueDate + legacyLength ])
    ];
    const result = new Set<number>();

    for (let day = +from; day < +until; day += dayLength) {
        if (day < +today) continue;
        const date = new Date(day);
        const key = date.toISOString().slice(0, 10);
        const dated = exceptions.filter(row => row.date.toISOString().slice(0, 10) === key);
        const windows = [
            ...hours.filter(row => row.weekDay.toLowerCase() === weekDays[date.getUTCDay()].toLowerCase()),
            ...dated.filter(row => row.status === "available")
        ];
        const unavailable = [
            ...occupied,
            ...dated.filter(row => row.status !== "available").map(row => [
                +calendarInstant(key, toTimeString(row.startTime)),
                +calendarInstant(key, toTimeString(row.endTime))
            ])
        ];

        for (const window of windows) {
            const start = +calendarInstant(key, toTimeString(window.startTime));
            const end = +calendarInstant(key, toTimeString(window.endTime));
            for (let at = start; at + length <= end; at += length) {
                if (at > +now && !unavailable.some(([a, b]) => at < b && at + length > a)) {
                    result.add(at);
                }
            }
        }
    }

    return [...result].sort((a, b) => a - b).map(at => new Date(at).toISOString());
}

export async function listBookingStarts(serviceId: number) {
    const service = await findBookingService(prisma, serviceId);
    if (!service) return null;
    const starts = await availableStarts(
        prisma, serviceId, service.catalog.business.id, parseDay(calendarDate(new Date()))!, calendarDays, service.durationMinutes
    );
    return { service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes, business: service.catalog.business.name }, starts };
}
