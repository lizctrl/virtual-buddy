/// api/profile/[profileId]&picture=true&user=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { profileId } = await params
    if (!profileId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing profileId parameter"),
            { status: 400 }
        );
    }

    const id = Number(profileId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid profileId parameter"),
            { status: 400 }
        );
    }
    const searchParams = req.nextUrl.searchParams;
    const pictureResult = parseBoolean(searchParams, "picture");
    if (!pictureResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(pictureResult.error),
            { status: 400 }
        );
    }
    const picture = pictureResult.value ?? false;

    const userResult = parseBoolean(searchParams, "user");
    if (!userResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(userResult.error),
            { status: 400 }
        );
    }
    const user = userResult.value ?? false;

    const profile = await getProfile(id, user, picture);
    if (!profile) {
        return NextResponse.json(
            ApiResponse.notFound("Profile not found"),
            { status: 404 }
        );
    }

    if (!profile) {
        return NextResponse.json(
            ApiResponse.notFound("Profile not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Profile retrieved successfully", { profile }),
        { status: 200 }
    );
}
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { profileId } = await params
    if (!profileId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing profileId parameter"),
            { status: 400 }
        );
    }
    const id = Number(profileId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid profileId parameter"),
            { status: 400 }
        );
    }

    const profile = await getProfile(id, true);

    if (!profile) {
        return NextResponse.json(
            ApiResponse.notFound("Profile not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.picture) {
        return NextResponse.json(
            ApiResponse.missingField("Missing picture field"),
            { status: 400 }
        );
    }
    // database
    const updatedProfile = await prisma.profile.update({
        where: {
            id
        },
        data: {
            picture: data.picture
        },
        select: {
            id: true,
            createTime: true,
            picture: true,
            userId: true,
            state: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Profile updated successfully", { profile: updatedProfile }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { profileId } = await params
    if (!profileId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing profileId parameter"),
            { status: 400 }
        );
    }
    const id = Number(profileId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid profileId parameter"),
            { status: 400 }
        );
    }
    const profile = await getProfile(id, true);
    if (!profile) {
        return NextResponse.json(
            ApiResponse.notFound("Profile not found"),
            { status: 404 }
        );
    }
    const updatedProfile = await prisma.profile.delete({
        where: { id: Number(profileId) }
    }
    )
    return NextResponse.json(
        ApiResponse.success("Profile deleted successfully", { profile: updatedProfile }),
        { status: 200 }
    );
}

async function getProfile(profileId: number, user: boolean = false, picture: boolean = false) {
    return prisma.profile.findUnique({
        where: {
            id: profileId
        },
        select: {
            id: true,
            createTime: true,
            picture,
            userId: true,
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