// api/appoitment? page=1&limit=10&name=&description=&idFrom=&idTo=&excludedId=&sortBy=&sortOrder=&state=true&service=true&business=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseDateRanges, parseRanges } from "@/app/lib/api/ranges";
import { ApiResponse } from "@/app/lib/api/responses";
import { parseSorting } from "@/app/lib/api/sorting";
import { getCurrentUser } from "@/app/lib/auth";
import { availableStarts, findBookingService, lockCalendar, visibleAppointments } from "@/app/lib/booking";
import { sendBookingConfirmation } from "@/app/lib/booking-email";
import { calendarDate, formatAppointment, maxAppointmentDescription, parseDay } from "@/app/lib/calendar";
import { prisma } from "@/app/lib/db";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { searchParams } = req.nextUrl;

    // Pagination
    const paginationResult = parsePagination(searchParams);
    if (!paginationResult.success) {
        return NextResponse.json(
            ApiResponse.invalidPagination(paginationResult.error),
            { status: 400 }
        );
    }

    // Filters
    const userIdParam = searchParams.get("userId")?.trim() || null;
    const serviceIdParam = searchParams.get("serviceId")?.trim() || null;
    const status = searchParams.get("status")?.trim() || null;

    const userId = userIdParam !== null ? Number(userIdParam) : null;

    if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid userId parameter"),
            { status: 400 }
        );
    }
    const serviceId =
        serviceIdParam !== null ? Number(serviceIdParam) : null;

    if (
        serviceId !== null &&
        (!Number.isInteger(serviceId) || serviceId <= 0)
    ) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid serviceId parameter"),
            { status: 400 }
        );
    }

    const ownerIdParam = searchParams.get("ownerId")?.trim() || null;
    const ownerId = ownerIdParam ? Number(ownerIdParam) : null;
    if (ownerId !== null && (!Number.isInteger(ownerId) || ownerId <= 0)) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid ownerId parameter"),
            { status: 400 }
        );
    }

    const businessIdParam = searchParams.get("businessId");
    const businessId = businessIdParam === null ? undefined : Number(businessIdParam);
    if (businessId !== undefined && (!Number.isInteger(businessId) || businessId <= 0 || businessId > 2_147_483_647)) {
        return NextResponse.json(ApiResponse.invalidParameter("Negocio inválido."), { status: 400 });
    }

    const mineResult = parseBoolean(searchParams, "mine");
    if (!mineResult.success) {
        return NextResponse.json(ApiResponse.invalidParameter(mineResult.error), { status: 400 });
    }
    const mine = mineResult.value === true;

    //booleans
    const stateResult = parseBoolean(searchParams, "state");
    if (!stateResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(stateResult.error),
            { status: 400 }
        );
    }

    const serviceResult = parseBoolean(searchParams, "service");
    if (!serviceResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(serviceResult.error),
            { status: 400 }
        );
    }
    const businessResult = parseBoolean(searchParams, "business");
    if (!businessResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(businessResult.error),
            { status: 400 }
        );
    }

    // Ranges
    const rangesResult = parseRanges(searchParams);
    if (!rangesResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(rangesResult.error),
            { status: 400 }
        );
    }

    const dueDates = parseDateRanges(searchParams, "dueDateFrom", "dueDateTo", "excludedDueDate");
    if (!dueDates.success) {
        return NextResponse.json(ApiResponse.invalidRange(dueDates.error), { status: 400 });
    }

    // Sorting
    const allowedSortFields = ["id", "dueDate", "serviceId", "status", "userId"] as const;
    const sortingResult = parseSorting(searchParams, allowedSortFields);
    if (!sortingResult.success) {
        return NextResponse.json(
            ApiResponse.invalidSorting(sortingResult.error),
            { status: 400 }
        );
    }

    //Values 
    const { sortBy, sortOrder } = sortingResult;

    const { from: idFrom, to: idTo, excluded: excludedIds } = rangesResult;

    const state = stateResult.value ?? true;
    const service = serviceResult.value ?? false;
    const business = businessResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.AppointmentWhereInput = visibleAppointments(currentUser.id);


    if (idFrom !== null || idTo !== null || excludedIds.length > 0) {
        where.id = {
            ...(idFrom !== null && { gte: idFrom }),
            ...(idTo !== null && { lte: idTo }),
            ...(excludedIds.length > 0 && { notIn: excludedIds })
        };
    }

    if (state !== null) {
        where.state = state;
    }
    if (dueDates.from || dueDates.to || dueDates.excluded.length) {
        where.dueDate = {
            gte: dueDates.from ?? undefined,
            lt: dueDates.to ?? undefined,
            notIn: dueDates.excluded.length ? dueDates.excluded : undefined
        };
    }
    if (status !== null) {
        where.status = status;
    }
    if (mine) {
        where.userId = currentUser.id;
        if (userId !== null) where.AND = { userId };
    } else if (userId !== null) {
        where.userId = userId;
    }
    if (serviceId !== null) {
        where.serviceId = serviceId;
    }
    if (ownerId !== null || businessId !== undefined) {
        where.service = {
            catalog: { business: { id: businessId, ownerId: ownerId ?? undefined } }
        };
    }

    const ownerAgenda = ownerId === currentUser.id && businessId !== undefined;
    const [appointments, count] = await Promise.all([
        prisma.appointment.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                serviceId: true,
                status: true,
                dueDate: true,
                endsAt: true,
                description: ownerAgenda || mine,
                state: true,
                notifications: true,
                service: business ? {
                    include: { catalog: { select: { business: { select: { id: true, name: true } } } } }
                } : true,
                user: { select: { name: true, last_name: true, email: ownerAgenda, phone: ownerAgenda } }
            },
            orderBy: [{ [sortBy]: sortOrder }, ...(sortBy === "id" ? [] : [{ id: "asc" as const }])]
        }),
        prisma.appointment.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(
        ApiResponse.success(
            "Appointments retrieved successfully",
            {
                appointments,
                pagination: {
                    page,
                    limit,
                    totalPages,
                    totalItems: count,
                    itemsOnPage: appointments.length,
                    hasPreviousPage: page > 1,
                    hasNextPage: page < totalPages
                },
                filters: {
                    idFrom,
                    idTo,
                    excludedIds,
                    state,
                    service,
                    business
                },
                sort: {
                    by: sortBy,
                    order: sortOrder
                }
            }
        )
    );
}

export async function POST(req: NextRequest) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return Response.json(ApiResponse.unauthenticated("Inicia sesión para reservar."), { status: 401 });
    }

    const data = await req.json().catch(() => null);
    const serviceId = data?.serviceId;
    if (!Number.isInteger(serviceId) || serviceId <= 0 || serviceId > 2_147_483_647 ||
        typeof data?.dueDate !== "string") {
        return Response.json(ApiResponse.invalidParameter("Selecciona un servicio y un horario válidos."), { status: 400 });
    }
    const description = data.description;
    if (description !== undefined && (typeof description !== "string" || description.length > maxAppointmentDescription)) {
        return Response.json(ApiResponse.invalidParameter(`La descripción admite hasta ${maxAppointmentDescription} caracteres.`), { status: 400 });
    }
    const dueDate = new Date(data.dueDate);
    if (!Number.isFinite(+dueDate) || dueDate <= new Date()) {
        return Response.json(ApiResponse.invalidParameter("Selecciona un horario futuro."), { status: 400 });
    }

    const day = parseDay(calendarDate(dueDate));
    if (!day) {
        return Response.json(ApiResponse.invalidParameter("Fecha inválida."), { status: 400 });
    }
    const service = await findBookingService(prisma, serviceId);
    if (!service || !service.catalog.business.owner) {
        return Response.json(ApiResponse.notFound("Servicio no encontrado."), { status: 404 });
    }
    const { business } = service.catalog;

    const result = await prisma.$transaction(async tx => {
        await lockCalendar(tx, business.id);
        const currentService = await findBookingService(tx, serviceId);
        if (!currentService?.catalog.business.owner || currentService.catalog.business.id !== business.id) {
            return { status: 404 } as const;
        }
        const ban = await tx.moderation.findFirst({
            where: { userId: currentUser.id, businessId: business.id, status: "banned", state: true }
        });
        if (ban) return { status: 403 } as const;

        const duration = currentService.durationMinutes;
        const starts = await availableStarts(tx, serviceId, business.id, day, 1, duration);
        if (!starts.includes(dueDate.toISOString())) return { status: 409 } as const;

        const details = `${currentUser.name} ${currentUser.last_name} · ${service.name} · ${business.name}\n${formatAppointment(dueDate)} (hora de Costa Rica) · ${duration} min`;
        const appointment = await tx.appointment.create({
            data: {
                userId: currentUser.id,
                serviceId,
                status: "confirmed",
                dueDate,
                endsAt: new Date(+dueDate + duration * 60_000),
                description: description?.trim() || null,
                notifications: { create: { title: "Cita confirmada", content: details } }
            }
        });
        return { status: 201, appointment, details, ownerEmail: currentService.catalog.business.owner.email } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    if (result.status === 404) {
        return Response.json(ApiResponse.notFound("Servicio no encontrado."), { status: 404 });
    }
    if (result.status === 403) {
        return Response.json(ApiResponse.unauthorized("No puedes reservar en este negocio."), { status: 403 });
    }
    if (result.status === 409) {
        return Response.json(ApiResponse.error("Ese horario ya no está disponible. Elige otro."), { status: 409 });
    }

    const { appointment, details, ownerEmail } = result;
    const email = await sendBookingConfirmation(
        appointment.id, [currentUser.email, ownerEmail], `Tu cita está confirmada.\n\n${details}\nReserva #${appointment.id}`
    );
    return Response.json(ApiResponse.success("Cita confirmada.", { appointment, email }), { status: 201 });
}
