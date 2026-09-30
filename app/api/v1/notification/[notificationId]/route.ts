///api/notification/[notificationId]?appointment=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ notificationId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { notificationId } = await params
    if (!notificationId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing notificationId parameter"),
            { status: 400 }
        );
    }

    const id = Number(notificationId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid notificationId parameter"),
            { status: 400 }
        );
    }

    const searchParams = req.nextUrl.searchParams;
    const appointmentResult = parseBoolean(searchParams, "appointment");
    if (!appointmentResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(appointmentResult.error),
            { status: 400 }
        );
    }
    const appointment = appointmentResult.value ?? false;

    const notification = await getNotification(id, appointment);
    if (!notification) {
        return NextResponse.json(
            ApiResponse.notFound("Notification not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Notification retrieved successfully", { notification }),
        { status: 200 }
    );
}
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ notificationId: string }> }
) {

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { notificationId } = await params
    if (!notificationId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing notificationId parameter"),
            { status: 400 }
        );
    }
    const id = Number(notificationId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid notificationId parameter"),
            { status: 400 }
        );
    }

    const notification = await getNotification(id, true);

    if (!notification) {
        return NextResponse.json(
            ApiResponse.notFound("Notification not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.appointmentId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing appointmentId field"),
            { status: 400 }
        );
    }
    // database
    const updatedNotification = await prisma.notification.update({
        where: {
            id
        },
        data: {
            appointmentId: data.appointmentId,
            title: data.title,
            content: data.content
        },
        select: {
            id: true,
            createTime: true,
            title: true,
            content: true,
            appointmentId: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Notification updated successfully", { notification: updatedNotification }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ notificationId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { notificationId } = await params
    if (!notificationId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing notificationId parameter"),
            { status: 400 }
        );
    }
    const id = Number(notificationId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid notificationId parameter"),
            { status: 400 }
        );
    }
    const notification = await getNotification(id, true);
    if (!notification) {
        return NextResponse.json(
            ApiResponse.notFound("Notification not found"),
            { status: 404 }
        );
    }
    const updatedNotification = await prisma.notification.delete({
        where: { id: Number(notificationId) }
    }
    )
    return NextResponse.json(
        ApiResponse.success("Notification deleted successfully", { notification: updatedNotification }),
        { status: 200 }
    );
}

async function getNotification(notificationId: number, appointment: boolean = false) {
    return prisma.notification.findUnique({
        where: {
            id: notificationId
        },
        select: {
            id: true,
            createTime: true,
            title: true,
            content: true,
            appointmentId: true,
            appointment: appointment ? {
                select: {
                    id: true,
                    createdAt: true,
                    updatedAt: true,
                    userId: true,
                    serviceId: true,
                    status: true,
                    dueDate: true,
                    state: true,
                }
            } : false
        }
    });
}