/// api/working_hours/[workingHoursId]&service=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ workingHoursId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { workingHoursId } = await params
    if (!workingHoursId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing workingHoursId parameter"),
            { status: 400 }
        );
    }

    const id = Number(workingHoursId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid workingHoursId parameter"),
            { status: 400 }
        );
    }
    const searchParams = req.nextUrl.searchParams;
    const serviceResult = parseBoolean(searchParams, "service");
    if (!serviceResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(serviceResult.error),
            { status: 400 }
        );
    }
    const service = serviceResult.value ?? false;

    const workingHours = await getWorkingHours(id, service);
    if (!workingHours) {
        return NextResponse.json(
            ApiResponse.notFound("Working hours not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Working hours retrieved successfully", { workingHours }),
        { status: 200 }
    );
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ workingHoursId: string }> }
) {

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { workingHoursId } = await params
    if (!workingHoursId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing workingHoursId parameter"),
            { status: 400 }
        );
    }
    const id = Number(workingHoursId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid workingHoursId parameter"),
            { status: 400 }
        );
    }

    const workingHours = await getWorkingHours(id, true);

    if (!workingHours) {
        return NextResponse.json(
            ApiResponse.notFound("Working hours not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.weekDay) {
        return NextResponse.json(
            ApiResponse.missingField("Missing weekDay field"),
            { status: 400 }
        );
    }
    // database
    const updatedWorkingHours = await prisma.workingHours.update({
        where: {
            id
        },
        data: {
            weekDay: data.weekDay,
            startTime: data.startTime,
            endTime: data.endTime
        },
        select: {
            id: true,
            createTime: true,
            weekDay: true,
            startTime: true,
            endTime: true,
            serviceId: true,
            state: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Working hours updated successfully", { workingHours: updatedWorkingHours }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ workingHoursId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { workingHoursId } = await params
    if (!workingHoursId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing workingHoursId parameter"),
            { status: 400 }
        );
    }
    const id = Number(workingHoursId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid workingHoursId parameter"),
            { status: 400 }
        );
    }
    const workingHours = await getWorkingHours(id, true);
    if (!workingHours) {
        return NextResponse.json(
            ApiResponse.notFound("Working hours not found"),
            { status: 404 }
        );
    }
    const updatedWorkingHours = await prisma.workingHours.delete({
        where: { id: Number(workingHoursId) }
    }
    )
    return NextResponse.json(
        ApiResponse.success("Working hours deleted successfully", { workingHours: updatedWorkingHours }),
        { status: 200 }
    );
}

async function getWorkingHours(workingHoursId: number, service: boolean = false) {
    return prisma.workingHours.findUnique({
        where: {
            id: workingHoursId
        },
        select: {
            id: true,
            createTime: true,
            weekDay: true,
            startTime: true,
            endTime: true,
            serviceId: true,
            state: true,
            service: service ? {
                select: {
                    id: true,
                    name: true,
                    catalogId: true,
                    state: true,
                    services: true
                }
            } : false

        }
    });
}