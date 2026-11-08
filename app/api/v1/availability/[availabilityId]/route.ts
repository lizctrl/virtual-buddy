/// api/availability/[availabilityId]? service=true&business=true

import { ApiResponse } from "@/app/lib/api/responses";
import { toTimeOfDay, withTimeStrings } from "@/app/lib/api/times";
import { getCurrentUser } from "@/app/lib/auth";
import { parseDay } from "@/app/lib/calendar";
import { ownedService } from "@/app/lib/booking";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ availabilityId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { availabilityId } = await params
    if (!availabilityId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing availabilityId parameter"),
            { status: 400 }
        );
    }

    const id = Number(availabilityId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid availabilityId parameter"),
            { status: 400 }
        );
    }

    const availability = await getAvailability(id);
    if (!availability) {
        return NextResponse.json(
            ApiResponse.notFound("Availability not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Availability retrieved successfully", { availability: withTimeStrings(availability) }),
        { status: 200 }
    );
}
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ availabilityId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { availabilityId } = await params
    if (!availabilityId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing availabilityId parameter"),
            { status: 400 }
        );
    }
    const id = Number(availabilityId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid availabilityId parameter"),
            { status: 400 }
        );
    }

    const availability = await prisma.availability.findFirst({ where: { id, state: true, service: ownedService(currentUser.id) } });

    if (!availability) {
        return NextResponse.json(
            ApiResponse.notFound("Availability not found"),
            { status: 404 }
        );
    }
    const data = await req.json().catch(() => null);
    const date = parseDay(data?.date);
    const startTime = toTimeOfDay(data?.startTime, data?.date);
    const endTime = toTimeOfDay(data?.endTime, data?.date);
    if (!date || !startTime || !endTime || endTime <= startTime ||
        (data.serviceId !== undefined && data.serviceId !== availability.serviceId)) {
        return NextResponse.json(ApiResponse.invalidParameter("Fecha, horario o servicio inválido."), { status: 400 });
    }
    // database
    const updatedAvailability = await prisma.availability.update({
        where: {
            id
        },
        data: {
            date,
            startTime,
            endTime,
            status: data.status,
        },
        select: {
            id: true,
            serviceId: true,
            status: true,
            date: true,
            startTime: true,
            endTime: true,
            state: true,
            service: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Availability updated successfully", { availability: withTimeStrings(updatedAvailability) }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ availabilityId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    // logic for deactivating appoitment
    const { availabilityId } = await params
    if (!availabilityId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing availabilityId parameter"),
            { status: 400 }
        );
    }
    const id = Number(availabilityId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid availabilityId parameter"),
            { status: 400 }
        );
    }
    const availability = await prisma.availability.findFirst({ where: { id, state: true, service: ownedService(currentUser.id) } });
    if (!availability) {
        return NextResponse.json(
            ApiResponse.notFound("Availability not found"),
            { status: 404 }
        );
    }
    const updatedAvailability = await prisma.availability.update({
        where: {
            id: Number(availabilityId)
        },
        data: {
            state: false
        },
        select: {
            id: true,
            serviceId: true,
            status: true,
            date: true,
            startTime: true,
            endTime: true,
            state: true,
            service: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Availability deactivated successfully", { availability: withTimeStrings(updatedAvailability) }),
        { status: 200 }
    );
}
async function getAvailability(availabilityId: number) {
    return prisma.availability.findUnique({
        where: {
            id: availabilityId
        },
        select: {
            id: true,
            serviceId: true,
            status: true,
            date: true,
            startTime: true,
            endTime: true,
            state: true,
            service: true
        }
    });
}