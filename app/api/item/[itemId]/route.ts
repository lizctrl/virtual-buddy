/// api/item/[itemId]? inventory=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { itemId } = await params
    if (!itemId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing itemId parameter"),
            { status: 400 }
        );
    }

    const id = Number(itemId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid itemId parameter"),
            { status: 400 }
        );
    }

    const item = await getItem(id);
    if (!item) {
        return NextResponse.json(
            ApiResponse.notFound("Item not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Item retrieved successfully", { item }),
        { status: 200 }
    );
}
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { itemId } = await params
    if (!itemId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing itemId parameter"),
            { status: 400 }
        );
    }
    const id = Number(itemId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid itemId parameter"),
            { status: 400 }
        );
    }

    const item = await getItem(id);

    if (!item) {
        return NextResponse.json(
            ApiResponse.notFound("Item not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.inventoryId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing inventoryId field"),
            { status: 400 }
        );
    }
    // database
    const updatedItem = await prisma.item.update({
        where: {
            id
        },
        data: {
            inventoryId: data.inventoryId
        },
        select: {
            id: true,
            createTime: true,
            name: true,
            description: true,
            cost: true,
            quantity: true,
            inventoryId: true,
            state: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Item updated successfully", { item: updatedItem }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    // logic for deactivating appoitment
    const { itemId } = await params
    if (!itemId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing itemId parameter"),
            { status: 400 }
        );
    }
    const id = Number(itemId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid itemId parameter"),
            { status: 400 }
        );
    }
    const item = await getItem(id);
    if (!item) {
        return NextResponse.json(
            ApiResponse.notFound("Item not found"),
            { status: 404 }
        );
    }
    const updatedItem = await prisma.item.update({
        where: {
            id: Number(itemId)
        },
        data: {
            state: false
        },
        select: {
            id: true,
            createTime: true,
            name: true,
            description: true,
            cost: true,
            quantity: true,
            inventoryId: true,
            state: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Item deactivated successfully", { item: updatedItem }),
        { status: 200 }
    );
}
async function getItem(itemId: number) {
    return prisma.item.findUnique({
        where: {
            id: itemId
        },
        select: {
            id: true,
            createTime: true,
            name: true,
            description: true,
            cost: true,
            quantity: true,
            inventoryId: true,
            state: true
        }
    });
}