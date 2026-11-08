import { NextRequest } from "next/server";
import { parseDateRanges } from "@/app/lib/api/ranges";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { lockCalendar } from "@/app/lib/booking";
import { calendarInstant, parseDay } from "@/app/lib/calendar";
import { prisma } from "@/app/lib/db";

function positiveId(value: unknown) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

async function calendarAccess(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return { response: Response.json(ApiResponse.unauthenticated("Inicia sesión."), { status: 401 }) };
    }
    const businessId = positiveId(request.nextUrl.searchParams.get("businessId"));
    if (!businessId) {
        return { response: Response.json(ApiResponse.invalidParameter("Negocio inválido."), { status: 400 }) };
    }
    const business = await prisma.business.findFirst({
        where: { id: businessId, ownerId: user.id, state: true },
        select: { id: true }
    });
    if (!business) {
        return { response: Response.json(ApiResponse.notFound("Negocio no encontrado."), { status: 404 }) };
    }
    return { businessId };
}

export async function GET(request: NextRequest) {
    const access = await calendarAccess(request);
    if (access.response) return access.response;
    const { searchParams } = request.nextUrl;
    const range = parseDateRanges(searchParams, "from", "to");
    if (!range.success) {
        return Response.json(ApiResponse.invalidRange(range.error), { status: 400 });
    }
    const blocks = await prisma.scheduleBlock.findMany({
        where: {
            businessId: access.businessId,
            state: true,
            startsAt: range.to ? { lt: range.to } : undefined,
            endsAt: range.from || !range.to ? { gt: range.from ?? new Date() } : undefined
        },
        orderBy: { startsAt: "asc" }
    });
    return Response.json(ApiResponse.success("Bloqueos del calendario.", { blocks }));
}

function parseLocalTime(value: unknown) {
    if (typeof value !== "string") return null;
    const [day, time] = value.split("T");
    if (!parseDay(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? "") || value !== `${day}T${time}`) {
        return null;
    }
    return calendarInstant(day, time);
}

export async function POST(request: NextRequest) {
    const access = await calendarAccess(request);
    if (access.response) return access.response;
    const data = await request.json().catch(() => null);
    const startsAt = parseLocalTime(data?.startsAt);
    const endsAt = parseLocalTime(data?.endsAt);
    if (!startsAt || !endsAt || endsAt <= startsAt || endsAt <= new Date()) {
        return Response.json(ApiResponse.invalidParameter("El bloqueo debe terminar después de su inicio y de la hora actual."), { status: 400 });
    }

    const block = await prisma.$transaction(async tx => {
        await lockCalendar(tx, access.businessId);
        const existing = await tx.scheduleBlock.findFirst({
            where: { businessId: access.businessId, startsAt, endsAt, state: true }
        });
        return existing ?? tx.scheduleBlock.create({
            data: { businessId: access.businessId, startsAt, endsAt }
        });
    });
    return Response.json(ApiResponse.success("Horario bloqueado.", { block }), { status: 201 });
}

export async function DELETE(request: NextRequest) {
    const access = await calendarAccess(request);
    if (access.response) return access.response;
    const id = positiveId(request.nextUrl.searchParams.get("id"));
    if (!id) {
        return Response.json(ApiResponse.invalidParameter("Bloqueo inválido."), { status: 400 });
    }

    const { count } = await prisma.scheduleBlock.updateMany({
        where: { id, businessId: access.businessId, state: true },
        data: { state: false }
    });
    if (!count) return Response.json(ApiResponse.notFound("Bloqueo no encontrado."), { status: 404 });
    return Response.json(ApiResponse.success("Bloqueo eliminado.", null));
}
