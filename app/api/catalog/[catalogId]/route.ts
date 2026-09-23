/// api/catalog/[catalogId]? service=true&business=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ catalogId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { catalogId } = await params
    if (!catalogId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing catalogId parameter"),
            { status: 400 }
        );
    }

    const id = Number(catalogId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid catalogId parameter"),
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
    const catalog = await getCatalog(id, service, business);
    if (!catalog) {
        return NextResponse.json(
            ApiResponse.notFound("Catalog not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Catalog retrieved successfully", { catalog }),
        { status: 200 }
    );
}
async function getCatalog(
    catalogId: number,
    service = false,
    business = false
) {
    return prisma.catalog.findUnique({
        where: {
            id: catalogId
        },
        select: {
            id: true,
            name: true,
            businessId: true,
            state: true,
            services: service,
            business: business
        }
    });
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ catalogId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { catalogId } = await params
    if (!catalogId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing catalogId parameter"),
            { status: 400 }
        );
    }
    const id = Number(catalogId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid catalogId parameter"),
            { status: 400 }
        );
    }

    const catalog = await getCatalog(id);

    if (!catalog) {
        return NextResponse.json(
            ApiResponse.notFound("Catalog not found"),
            { status: 404 }
        );
    }
    const data = await req.json()
    if (!data.name) {
        return NextResponse.json(
            ApiResponse.missingField("Missing name field"),
            { status: 400 }
        );
    }
    const updatedCatalog = await prisma.catalog.update({
        where: {
            id
        },
        data: {
            name: data.name
        },
        select: {
            id: true,
            name: true,
            businessId: true,
            state: true,
            services: true,
            business: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Catalog updated successfully", { catalog: updatedCatalog }),
        { status: 200 }
    );
}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ catalogId: string }> }
) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    // logic for deactivating catalog
    const { catalogId } = await params
    if (!catalogId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing catalogId parameter"),
            { status: 400 }
        );
    }
    const id = Number(catalogId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid catalogId parameter"),
            { status: 400 }
        );
    }
    const catalog = await getCatalog(id);
    if (!catalog) {
        return NextResponse.json(
            ApiResponse.notFound("Catalog not found"),
            { status: 404 }
        );
    }
    const updatedCatalog = await prisma.catalog.update({
        where: {
            id: Number(catalogId)
        },
        data: {
            state: false
        },
        select: {
            id: true,
            name: true,
            businessId: true,
            state: true,
            services: true,
            business: true
        }
    })
    return NextResponse.json(
        ApiResponse.success("Catalog deactivated successfully", { catalog: updatedCatalog }),
        { status: 200 }
    );
}   