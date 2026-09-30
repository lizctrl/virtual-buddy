/// api/inventory? id=&state=true&business=true&items=true&page=1&limit=10&sortBy=&sortOrder=

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { ApiResponse } from "@/app/lib/api/responses";
import { parseSorting } from "@/app/lib/api/sorting";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { searchParams } = req.nextUrl;

    // Pagination
    const paginationResult = parsePagination(searchParams);
    if (!paginationResult.success) {
        return NextResponse.json(
            ApiResponse.invalidPagination(paginationResult.error),
            { status: 400 }
        );
    }
    // Filters
    const idParam = searchParams.get("id")?.trim() || null;
    const stateResult = parseBoolean(searchParams, "state");
    if (!stateResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(stateResult.error),
            { status: 400 }
        );
    }

    // booleans
    const businessResult = parseBoolean(searchParams, "business");
    if (!businessResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(businessResult.error),
            { status: 400 }
        );
    }

    const itemsResult = parseBoolean(searchParams, "items");
    if (!itemsResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(itemsResult.error),
            { status: 400 }
        );
    }

    // Sorting
    const allowedSortFields = ["id", "createTime", "businessId", "state"] as const;
    const sortingResult = parseSorting(searchParams, allowedSortFields);
    if (!sortingResult.success) {
        return NextResponse.json(
            ApiResponse.invalidSorting(sortingResult.error),
            { status: 400 }
        );
    }


    //Values 
    const { sortBy, sortOrder } = sortingResult;


    const state = stateResult.value ?? false;
    const business = businessResult.value ?? false;
    const items = itemsResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.InventoryWhereInput = {};


    if (idParam !== null) {
        where.id = Number(idParam);
    }

    if (state !== null) {
        where.state = state;
    }

    const [inventories, count] = await Promise.all([
        prisma.inventory.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createTime: true,
                businessId: true,
                state: true,
                items: true
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.inventory.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Inventories retrieved successfully",
        {
            inventories,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: count,
                itemsOnPage: inventories.length,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            },
            filters: {
                state,
                business,
                items
            },
            sort: {
                by: sortBy,
                order: sortOrder
            }
        }
    ));
}

export async function POST(req: NextRequest) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
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
    const inventory = await prisma.inventory.create({
        data: {
            businessId: data.businessId
        }
    })
    return NextResponse.json(
        ApiResponse.success("Inventory created successfully", { inventory }),
        { status: 200 }
    );
}