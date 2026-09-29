/// api/availability/[availabilityId]? service=true&business=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
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
        ApiResponse.success("Availability retrieved successfully", { availability }),
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

    const availability = await getAvailability(id);

    if (!availability) {
        return NextResponse.json(
            ApiResponse.notFound("Availability not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.date) {
        return NextResponse.json(
            ApiResponse.missingField("Missing date field"),
            { status: 400 }
        );
    }
    if (!data.time) {
        return NextResponse.json(
            ApiResponse.missingField("Missing time field"),
            { status: 400 }
        );
    }
    if (!data.duration) {
        return NextResponse.json(
            ApiResponse.missingField("Missing duration field"),
            { status: 400 }
        );
    }
    if (!data.serviceId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing serviceId field"),
            { status: 400 }
        );
    }
    if (!Number.isInteger(data.serviceId) || data.serviceId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid serviceId parameter"),
            { status: 400 }
        );
    }
    // database
    const updatedAvailability = await prisma.availability.update({
        where: {
            id
        },
        data: {
            date: data.date,
            startTime: data.time,
            endTime: data.time + data.duration,
            status: data.status,
            serviceId: data.serviceId,
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
        ApiResponse.success("Availability updated successfully", { availability: updatedAvailability }),
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
    const availability = await getAvailability(id);
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
        ApiResponse.success("Availability deactivated successfully", { availability: updatedAvailability }),
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