import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db"
import { User } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server"

// /api/user/[userId]?appointments=true&businesses=true
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }

    const { userId } = await params
    if (!userId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing userId parameter"),
            { status: 400 }
        );
    }

    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid userId parameter"),
            { status: 400 }
        );
    }

    const searchParams = request.nextUrl.searchParams;
    const appointmentsResult = parseBoolean(searchParams, "appointments");
    if (!appointmentsResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(appointmentsResult.error),
            { status: 400 }
        );
    }

    const businessesResult = parseBoolean(searchParams, "businesses");
    if (!businessesResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(businessesResult.error),
            { status: 400 }
        );
    }
    const appointments = appointmentsResult.value ?? false;
    const businesses = businessesResult.value ?? false;

    const user = await getUser(id, appointments, businesses);
    if (!user) {
        return NextResponse.json(
            ApiResponse.notFound("User not found"),
            { status: 404 });
    }

    return NextResponse.json(
        ApiResponse.success("User retrieved successfully", { user }),
        { status: 200 }
    );
}
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { userId } = await params
    if (!userId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing userId parameter"),
            { status: 400 }
        );
    }
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid userId parameter"),
            { status: 400 }
        );
    }

    const user = await getUser(id);

    if (!user) {
        return NextResponse.json(
            ApiResponse.notFound("User not found"),
            { status: 404 }
        );
    }
    const data = await request.json()
    if (!data.name) {
        return NextResponse.json(
            ApiResponse.missingField("Missing name field"),
            { status: 400 }
        );
    }
    const updatedUser = await prisma.user.update({
        where: {
            id
        },
        data: {
            name: data.name
        },
        select: {
            id: true,
            name: true,
            email: true,
            last_name: true,
            phone: true,
            state: true,
            appointments: true,
            businesses: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("User updated successfully", { user: updatedUser }),
        { status: 200 }
    );
}
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    // logic for deactivating user
    const { userId } = await params
    if (!userId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing userId parameter"),
            { status: 400 }
        );
    }
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid userId parameter"),
            { status: 400 }
        );
    }
    const user = await getUser(id);
    if (!user) {
        return NextResponse.json(
            ApiResponse.notFound("User not found"),
            { status: 404 }
        );
    }
    const updatedUser = await prisma.user.update({
        where: {
            id: Number(userId)
        },
        data: {
            state: false
        },
        select: {
            id: true,
            name: true,
            email: true,
            last_name: true,
            phone: true,
            state: true,
            appointments: true,
            businesses: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("User deactivated successfully", { user: updatedUser }),
        { status: 200 }
    );
}
async function getUser(
    userId: number,
    appointments = false,
    businesses = false
) {
    return prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            id: true,
            name: true,
            email: true,
            appointments,
            businesses
        }
    });
}