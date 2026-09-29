/// api/appointment/[appointmentId]? service=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
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
    const appointment = await getAppointment(id, service);
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
    service = false
) {
    return prisma.appointment.findUnique({
        where: {
            id: appointmentId
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

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ appointmentId: string }> }
) {
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

    const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
            service: { include: { catalog: { include: { business: true } } } }
        }
    });

    if (!appointment) {
        return NextResponse.json(
            ApiResponse.notFound("Appointment not found"),
            { status: 404 }
        );
    }

    // Only the business owner can update the appointment
    const ownerId = appointment.service?.catalog?.business?.ownerId;
    if (ownerId !== currentUser.id) {
        return NextResponse.json(
            ApiResponse.unauthorized("You are not authorized to update this appointment"),
            { status: 403 }
        );
    }

    const data = await req.json()
    const updateData: { dueDate?: Date; status?: string } = {};
    if (data.dueDate) {
        const dueDate = new Date(data.dueDate);
        if (isNaN(dueDate.getTime())) {
            return NextResponse.json(
                ApiResponse.invalidParameter("Invalid dueDate parameter"),
                { status: 400 }
            );
        }
        updateData.dueDate = dueDate;
    }
    if (data.status) {
        updateData.status = data.status;
    }
    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            ApiResponse.missingField("No fields to update"),
            { status: 400 }
        );
    }

    const updatedAppointment = await prisma.appointment.update({
        where: { id },
        data: updateData,
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
            service: true
        }
    });

    // Notify the client when the owner changes the status
    if (updateData.status) {
        await prisma.notification.create({
            data: {
                appointmentId: id,
                title: `Appointment ${updateData.status}`,
                content: `Your appointment status was updated to "${updateData.status}".`
            }
        });
    }

    return NextResponse.json(
        ApiResponse.success("Appointment updated successfully", { appointment: updatedAppointment }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ appointmentId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    // logic for deactivating appointment
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
    const appointment = await getAppointment(id);
    if (!appointment) {
        return NextResponse.json(
            ApiResponse.notFound("Appointment not found"),
            { status: 404 }
        );
    }
    const updatedAppointment = await prisma.appointment.update({
        where: {
            id: Number(appointmentId)
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
            service: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Appointment deactivated successfully", { appointment: updatedAppointment }),
        { status: 200 }
    );
}
