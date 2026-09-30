import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Development fixtures.
 *
 * Every row is written with an `upsert` on a pinned id from the 9000 block, so
 * running this twice refreshes the same rows instead of duplicating them. The
 * block starts above the default sequence, and `syncSequences` then pushes each
 * sequence past the seeded ids so the app keeps inserting safely.
 *
 * Note that the sequence only moves forward: rows the app creates after a seed
 * continue upward from the block rather than below it, so ids alone stop being
 * a reliable way to tell fixtures from real data after the first run.
 *
 * This is a dev-only script. It is not safe against a database that holds data
 * you care about beyond the 9000 block.
 */

const prisma = new PrismaClient();

const PASSWORD = "password123";

/** Working hours have no calendar date, so they ride on a fixed anchor. */
const TIME_ANCHOR = "1970-01-01";

const ID = {
    owner: 9001,
    client: 9002,
    bannedClient: 9003,
    businessStudio: 9101,
    businessBarber: 9102,
    catalogHaircuts: 9201,
    catalogBeard: 9202,
    catalogBarber: 9203,
    serviceClassicCut: 9301,
    serviceFade: 9302,
    serviceHairWash: 9303,
    appointmentPending: 9401,
    appointmentConfirmed: 9402,
    appointmentRejected: 9403,
    appointmentSecondPending: 9404,
    moderation: 9501
} as const;

const WEEK_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday"
] as const;

function timeOfDay(hhmm: string): Date {
    return new Date(`${TIME_ANCHOR}T${hhmm}:00.000Z`);
}

/** A Date on `offset` days from today, at the given "HH:mm" UTC. */
function dayFromNow(offset: number, hhmm: string): Date {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() + offset);
    return new Date(`${day.toISOString().slice(0, 10)}T${hhmm}:00.000Z`);
}

/**
 * Seeded rows use explicit ids, which does not move the autoincrement
 * sequence. Without this the next row the app inserts would try to reuse an
 * id from the 9000 block.
 */
async function syncSequences(): Promise<void> {
    const tables = [
        "users",
        "businesses",
        "catalog",
        "services",
        "appointments",
        "availability",
        "working_hours",
        "moderations",
        "notifications",
        "profiles",
        "inventories",
        "items"
    ];

    for (const table of tables) {
        // The table list is a hardcoded constant, never user input, so the
        // identifier cannot be parameterised.
        await prisma.$executeRawUnsafe(
            `SELECT setval(
                pg_get_serial_sequence('${table}', 'id'),
                GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 1), 1)
            )`
        );
    }
}

async function main() {
    const password = await bcrypt.hash(PASSWORD, 10);

    // --- users -----------------------------------------------------------
    // User.state has no @default in the schema, so it is set explicitly.
    const owner = await prisma.user.upsert({
        where: { id: ID.owner },
        update: {},
        create: {
            id: ID.owner,
            name: "German",
            last_name: "Montero",
            email: "owner@virtualbuddy.test",
            phone: "5550001",
            password,
            state: true
        }
    });

    const client = await prisma.user.upsert({
        where: { id: ID.client },
        update: {},
        create: {
            id: ID.client,
            name: "Ana",
            last_name: "Cliente",
            email: "client@virtualbuddy.test",
            phone: "5550002",
            password,
            state: true
        }
    });

    const bannedClient = await prisma.user.upsert({
        where: { id: ID.bannedClient },
        update: {},
        create: {
            id: ID.bannedClient,
            name: "Beto",
            last_name: "Bloqueado",
            email: "banned@virtualbuddy.test",
            phone: "5550003",
            password,
            state: true
        }
    });

    // --- businesses ------------------------------------------------------
    const studio = await prisma.business.upsert({
        where: { id: ID.businessStudio },
        update: {},
        create: {
            id: ID.businessStudio,
            name: "Acme Studio",
            description: "Barbería y estética de prueba",
            ownerId: owner.id,
            state: true
        }
    });

    const barber = await prisma.business.upsert({
        where: { id: ID.businessBarber },
        update: {},
        create: {
            id: ID.businessBarber,
            name: "Barbería Don Juan",
            description: "Segundo negocio, para probar el selector",
            ownerId: owner.id,
            state: true
        }
    });

    // --- catalogs and services ------------------------------------------
    const catalogHaircuts = await prisma.catalog.upsert({
        where: { id: ID.catalogHaircuts },
        update: {},
        create: {
            id: ID.catalogHaircuts,
            name: "Cortes",
            businessId: studio.id,
            state: true
        }
    });

    const catalogBeard = await prisma.catalog.upsert({
        where: { id: ID.catalogBeard },
        update: {},
        create: {
            id: ID.catalogBeard,
            name: "Barba",
            businessId: studio.id,
            state: true
        }
    });

    const catalogBarber = await prisma.catalog.upsert({
        where: { id: ID.catalogBarber },
        update: {},
        create: {
            id: ID.catalogBarber,
            name: "Servicios",
            businessId: barber.id,
            state: true
        }
    });

    const classicCut = await prisma.service.upsert({
        where: { id: ID.serviceClassicCut },
        update: {},
        create: {
            id: ID.serviceClassicCut,
            name: "Corte clásico",
            catalogId: catalogHaircuts.id,
            state: true
        }
    });

    const fade = await prisma.service.upsert({
        where: { id: ID.serviceFade },
        update: {},
        create: {
            id: ID.serviceFade,
            name: "Fade con barba",
            catalogId: catalogBeard.id,
            state: true
        }
    });

    const hairWash = await prisma.service.upsert({
        where: { id: ID.serviceHairWash },
        update: {},
        create: {
            id: ID.serviceHairWash,
            name: "Lavado de pelo",
            catalogId: catalogBarber.id,
            state: true
        }
    });

    // --- working hours ---------------------------------------------------
    // Five days x three services, so the availability tab has something to
    // list for each one.
    let workingHoursId = 9600;
    for (const serviceId of [classicCut.id, fade.id, hairWash.id]) {
        for (const weekDay of WEEK_DAYS) {
            workingHoursId += 1;
            await prisma.workingHours.upsert({
                where: { id: workingHoursId },
                update: {},
                create: {
                    id: workingHoursId,
                    weekDay,
                    startTime: timeOfDay("09:00"),
                    endTime: timeOfDay("18:00"),
                    serviceId,
                    state: true
                }
            });
        }
    }

    // --- availability ----------------------------------------------------
    // Two slots per day for the next three days, on the classic cut only.
    let availabilityId = 9700;
    for (let offset = 1; offset <= 3; offset++) {
        for (const [start, end] of [
            ["09:00", "10:00"],
            ["11:00", "12:00"]
        ] as const) {
            availabilityId += 1;
            await prisma.availability.upsert({
                where: { id: availabilityId },
                create: {
                    id: availabilityId,
                    date: dayFromNow(offset, "00:00"),
                    startTime: dayFromNow(offset, start),
                    endTime: dayFromNow(offset, end),
                    status: "available",
                    serviceId: classicCut.id,
                    state: true
                },
                update: {}
            });
        }
    }

    // --- appointments ----------------------------------------------------
    // One of each status so every Badge variant and both action buttons are
    // reachable from the dashboard.
    const appointments = [
        {
            id: ID.appointmentPending,
            userId: client.id,
            serviceId: classicCut.id,
            status: "pending",
            offset: 1
        },
        {
            id: ID.appointmentConfirmed,
            userId: client.id,
            serviceId: fade.id,
            status: "confirmed",
            offset: 2
        },
        {
            id: ID.appointmentRejected,
            userId: client.id,
            serviceId: fade.id,
            status: "rejected",
            offset: -1
        },
        {
            id: ID.appointmentSecondPending,
            userId: client.id,
            serviceId: classicCut.id,
            status: "pending",
            offset: 3
        }
    ];

    for (const appointment of appointments) {
        await prisma.appointment.upsert({
            where: { id: appointment.id },
            update: { status: appointment.status },
            create: {
                id: appointment.id,
                userId: appointment.userId,
                serviceId: appointment.serviceId,
                status: appointment.status,
                dueDate: dayFromNow(appointment.offset, "10:00"),
                state: true
            }
        });
    }

    // --- moderation ------------------------------------------------------
    // Exercises the ban path: this user can browse but gets a 403 on booking.
    await prisma.moderation.upsert({
        where: { id: ID.moderation },
        update: {},
        create: {
            id: ID.moderation,
            userId: bannedClient.id,
            businessId: studio.id,
            status: "banned",
            state: true
        }
    });

    // --- notifications ---------------------------------------------------
    // Notification has no userId; it is reached through the appointment.
    let notificationId = 9800;
    for (const appointment of appointments) {
        notificationId += 1;
        await prisma.notification.upsert({
            where: { id: notificationId },
            update: {},
            create: {
                id: notificationId,
                title: "New appointment booked",
                content: `A client booked ${appointment.status} work on ${dayFromNow(
                    appointment.offset,
                    "10:00"
                ).toISOString()}.`,
                appointmentId: appointment.id
            }
        });
    }

    // --- profile ---------------------------------------------------------
    await prisma.profile.upsert({
        where: { id: ID.owner },
        update: {},
        create: {
            id: ID.owner,
            picture: "https://example.com/avatar.png",
            userId: owner.id,
            state: true
        }
    });

    await syncSequences();

    console.log("Seed complete.");
    console.log(`  owner    ${owner.email} / ${PASSWORD}`);
    console.log(`  client   ${client.email} / ${PASSWORD}`);
    console.log(`  banned   ${bannedClient.email} / ${PASSWORD} (banned from ${studio.name})`);
}

main()
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
