/// api/appoitment/[appoitmentId]? service=true&business=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ appoitmentId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { appoitmentId } = await params
    if (!appoitmentId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing appoitmentId parameter"),
            { status: 400 }
        );
    }

    const id = Number(appoitmentId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid appoitmentId parameter"),
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
    const businessResult = parseBoolean(searchParams, "business");
    if (!businessResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(businessResult.error),
            { status: 400 }
        );
    }

    const service = serviceResult.value ?? false;
    const business = businessResult.value ?? false;

    // database
    const appoitment = await getAppoitment(id, service, business);
    if (!appoitment) {
        return NextResponse.json(
            ApiResponse.notFound("Appoitment not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Appoitment retrieved successfully", { appoitment }),
        { status: 200 }
    );
}
async function getAppoitment(
    appoitmentId: number,
    service = false,
    business = false
) {
    return prisma.appointment.findUnique({
        where: {
            id: appoitmentId
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
            service: service,
            business: business
        }
    });
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ appoitmentId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { appoitmentId } = await params
    if (!appoitmentId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing appoitmentId parameter"),
            { status: 400 }
        );
    }
    const id = Number(appoitmentId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid appoitmentId parameter"),
            { status: 400 }
        );
    }

    const appoitment = await getAppoitment(id);

    if (!appoitment) {
        return NextResponse.json(
            ApiResponse.notFound("Appoitment not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.dueDate) {
        return NextResponse.json(
            ApiResponse.missingField("Missing dueDate field"),
            { status: 400 }
        );
    }
    const updatedAppoitment = await prisma.appointment.update({
        where: {
            id
        },
        data: {
            dueDate: data.dueDate
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
            service: true,
            business: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Appoitment updated successfully", { appoitment: updatedAppoitment }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ appoitmentId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    // logic for deactivating appoitment
    const { appoitmentId } = await params
    if (!appoitmentId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing appoitmentId parameter"),
            { status: 400 }
        );
    }
    const id = Number(appoitmentId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid appoitmentId parameter"),
            { status: 400 }
        );
    }
    const appoitment = await getAppoitment(id);
    if (!appoitment) {
        return NextResponse.json(
            ApiResponse.notFound("Appoitment not found"),
            { status: 404 }
        );
    }
    const updatedAppoitment = await prisma.appointment.update({
        where: {
            id: Number(appoitmentId)
        },
        data: {
            state: false
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
            service: true,
            business: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Appoitment deactivated successfully", { appoitment: updatedAppoitment }),
        { status: 200 }
    );
}