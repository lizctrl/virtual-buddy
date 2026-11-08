/// api/appointment/[appointmentId]? service=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { availableStarts, lockCalendar, visibleAppointments } from "@/app/lib/booking";
import { calendarDate, defaultDuration, parseDay } from "@/app/lib/calendar";
import { prisma } from "@/app/lib/db";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ appointmentId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { appointmentId } = await params
    if (!appointmentId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing appointmentId parameter"),
            { status: 400 }
        );
    }

    const id = Number(appointmentId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid appointmentId parameter"),
            { status: 400 }
        );
    }

    const searchParams = req.nextUrl.searchParams;
    // booleans
    const serviceResult = parseBoolean(searchParams, "service");
    if (!serviceResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(serviceResult.error),
            { status: 400 }
        );
    }

    const service = serviceResult.value ?? false;

    // database
    const appointment = await getAppointment(id, currentUser.id, service);
    if (!appointment) {
        return NextResponse.json(
            ApiResponse.notFound("Appointment not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Appointment retrieved successfully", { appointment }),
        { status: 200 }
    );
}
async function getAppointment(
    appointmentId: number,
    userId: number,
    service = false
) {
    return prisma.appointment.findUnique({
        where: {
            id: appointmentId,
            state: true,
            ...visibleAppointments(userId)
        },
        select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
            serviceId: true,
            status: true,
            dueDate: true,
            state: true,
            notifications: true,
            service: service
        }
    });
}

const appointmentStatuses = ["confirmed", "rejected", "cancelled"];

export async function PUT(req: NextRequest, context: RouteContext<"/api/v1/appointment/[appointmentId]">) {
    const data = await req.json().catch(() => null);
    return updateAppointment(context, data?.status, data?.dueDate);
}

export async function DELETE(_req: NextRequest, context: RouteContext<"/api/v1/appointment/[appointmentId]">) {
    return updateAppointment(context, "cancelled");
}

async function updateAppointment(
    context: RouteContext<"/api/v1/appointment/[appointmentId]">,
    status: unknown,
    date?: unknown
) {
    const user = await getCurrentUser();
    if (!user) return Response.json(ApiResponse.unauthenticated("Inicia sesión."), { status: 401 });
    const id = Number((await context.params).appointmentId);
    const dueDate = typeof date === "string" ? new Date(date) : null;
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647 ||
        (status !== undefined && (typeof status !== "string" || !appointmentStatuses.includes(status))) ||
        (date !== undefined && (!dueDate || !Number.isFinite(+dueDate) || dueDate <= new Date())) ||
        (status === undefined && !dueDate)) {
        return Response.json(ApiResponse.invalidParameter("Cita, estado u horario inválido."), { status: 400 });
    }

    const where = {
        id, state: true, service: { catalog: { business: { ownerId: user.id, state: true } } }
    };
    const appointment = await prisma.appointment.findFirst({
        where,
        select: { service: { select: { catalog: { select: { businessId: true } } } } }
    });
    if (!appointment) return Response.json(ApiResponse.notFound("Cita no encontrada."), { status: 404 });
    const { businessId } = appointment.service.catalog;

    return prisma.$transaction(async tx => {
        await lockCalendar(tx, businessId);
        const current = await tx.appointment.findFirst({ where });
        if (!current) return Response.json(ApiResponse.notFound("Cita no encontrada."), { status: 404 });

        const nextStatus = typeof status === "string" ? status : current.status;
        if (!dueDate && nextStatus === current.status) {
            return Response.json(ApiResponse.success("Cita actualizada.", { appointment: current }));
        }
        const active = ["confirmed", "pending"].includes(current.status);
        if (!active || (dueDate && !["confirmed", "pending"].includes(nextStatus))) {
            return Response.json(ApiResponse.error("La cita ya está cerrada o no se puede mover."), { status: 409 });
        }

        const duration = current.endsAt
            ? (+current.endsAt - +current.dueDate) / 60_000
            : defaultDuration;
        if (dueDate) {
            const day = parseDay(calendarDate(dueDate));
            const starts = day
                ? await availableStarts(tx, current.serviceId, businessId, day, 1, duration, id)
                : [];
            if (!starts.includes(dueDate.toISOString())) {
                return Response.json(ApiResponse.error("Ese horario ya no está disponible."), { status: 409 });
            }
        }

        const title = nextStatus === "cancelled" ? "Cita cancelada" : "Cita actualizada";
        const updated = await tx.appointment.update({
            where: { id },
            data: {
                status: nextStatus,
                ...(dueDate && { dueDate, endsAt: new Date(+dueDate + duration * 60_000) }),
                notifications: { create: { title, content: `Se actualizó la reserva #${id}.` } }
            },
            include: { notifications: true, service: true }
        });
        return Response.json(ApiResponse.success(title, { appointment: updated }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
