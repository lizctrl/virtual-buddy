/// api/moderation/[moderationId]&user=true

import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ moderationId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { moderationId } = await params
    if (!moderationId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing moderationId parameter"),
            { status: 400 }
        );
    }

    const id = Number(moderationId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid moderationId parameter"),
            { status: 400 }
        );
    }
    const moderation = getModeration(id,);
    if (!moderation) {
        return NextResponse.json(
            ApiResponse.notFound("Moderation not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Moderation retrieved successfully", { moderation }),
        { status: 200 }
    );
}
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ moderationId: string }> }
) {

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { moderationId } = await params
    if (!moderationId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing moderationId parameter"),
            { status: 400 }
        );
    }
    const id = Number(moderationId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid moderationId parameter"),
            { status: 400 }
        );
    }

    const moderation = getModeration(id);

    if (!moderation) {
        return NextResponse.json(
            ApiResponse.notFound("Moderation not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.status) {
        return NextResponse.json(
            ApiResponse.missingField("Missing status field"),
            { status: 400 }
        );
    }
    // database
    const updatedModeration = await prisma.moderation.update({
        where: {
            id
        },
        data: {
            status: data.status
        },
        select: {
            id: true,
            createTime: true,
            userId: true,
            status: true,
            state: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Moderation updated successfully", { moderation: updatedModeration }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ moderationId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { moderationId } = await params
    if (!moderationId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing moderationId parameter"),
            { status: 400 }
        );
    }
    const id = Number(moderationId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid moderationId parameter"),
            { status: 400 }
        );
    }
    const moderation = getModeration(id);
    if (!moderation) {
        return NextResponse.json(
            ApiResponse.notFound("Moderation not found"),
            { status: 404 }
        );
    }
    const updatedModeration = await prisma.moderation.update({
        where: {
            id: Number(moderationId)
        },
        data: {
            state: false
        },
        select: {
            id: true,
            createTime: true,
            userId: true,
            status: true,
            state: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Moderation deleted successfully", { moderation: updatedModeration }),
        { status: 200 }
    );
}

async function getModeration(moderationId: number, user: boolean = false) {
    return prisma.moderation.findUnique({
        where: {
            id: moderationId
        },
        select: {
            id: true,
            createTime: true,
            userId: true,
            status: true,
            state: true,
            user: user ? {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    last_name: true,
                    state: true,
                    phone: true,
                    password: true,
                    businesses: true,
                    appointments: true,
                    moderations: true,
                    profiles: true
                }
            } : false
        }
    });
}