/// api/inventory/[inventoryId]? business=true&items=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ inventoryId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { inventoryId } = await params
    if (!inventoryId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing inventoryId parameter"),
            { status: 400 }
        );
    }

    const id = Number(inventoryId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid inventoryId parameter"),
            { status: 400 }
        );
    }

    const inventory = await getInventory(id);
    if (!inventory) {
        return NextResponse.json(
            ApiResponse.notFound("Inventory not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Inventory retrieved successfully", { inventory }),
        { status: 200 }
    );
}
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ inventoryId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { inventoryId } = await params
    if (!inventoryId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing inventoryId parameter"),
            { status: 400 }
        );
    }
    const id = Number(inventoryId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid inventoryId parameter"),
            { status: 400 }
        );
    }

    const inventory = await getInventory(id);

    if (!inventory) {
        return NextResponse.json(
            ApiResponse.notFound("Inventory not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.businessId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing businessId field"),
            { status: 400 }
        );
    }
    // database
    const updatedInventory = await prisma.inventory.update({
        where: {
            id
        },
        data: {
            businessId: data.businessId
        },
        select: {
            id: true,
            createTime: true,
            businessId: true,
            state: true,
            items: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Inventory updated successfully", { inventory: updatedInventory }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ inventoryId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    // logic for deactivating appoitment
    const { inventoryId } = await params
    if (!inventoryId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing inventoryId parameter"),
            { status: 400 }
        );
    }
    const id = Number(inventoryId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid inventoryId parameter"),
            { status: 400 }
        );
    }
    const inventory = await getInventory(id);
    if (!inventory) {
        return NextResponse.json(
            ApiResponse.notFound("Inventory not found"),
            { status: 404 }
        );
    }
    const updatedInventory = await prisma.inventory.update({
        where: {
            id: Number(inventoryId)
        },
        data: {
            state: false
        },
        select: {
            id: true,
            createTime: true,
            businessId: true,
            state: true,
            items: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Inventory deactivated successfully", { inventory: updatedInventory }),
        { status: 200 }
    );
}
async function getInventory(inventoryId: number) {
    return prisma.inventory.findUnique({
        where: {
            id: inventoryId
        },
        select: {
            id: true,
            createTime: true,
            businessId: true,
            state: true,
            items: true
        }
    });
}