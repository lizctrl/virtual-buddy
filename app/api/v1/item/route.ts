/// api/item? id=&state=true&inventory=true&page=1&limit=10&sortBy=&sortOrder=&name=&description=

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseRanges } from "@/app/lib/api/ranges";
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
    const stateResult = parseBoolean(searchParams, "state");
    if (!stateResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(stateResult.error),
            { status: 400 }
        );
    }

    // booleans
    const inventoryResult = parseBoolean(searchParams, "inventory");
    if (!inventoryResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(inventoryResult.error),
            { status: 400 }
        );
    }

    // Ranges
    const rangesResult = parseRanges(searchParams);
    if (!rangesResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(rangesResult.error),
            { status: 400 }
        );
    }

    // Sorting
    const allowedSortFields = ["id", "createTime", "inventoryId", "state", "cost", "quantity", "name"] as const;
    const sortingResult = parseSorting(searchParams, allowedSortFields);
    if (!sortingResult.success) {
        return NextResponse.json(
            ApiResponse.invalidSorting(sortingResult.error),
            { status: 400 }
        );
    }
    //Values 
    const { sortBy, sortOrder } = sortingResult;

    const { from: idFrom, to: idTo, excluded: excludedIds } = rangesResult;

    const state = stateResult.value ?? false;
    const inventory = inventoryResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.ItemWhereInput = {};


    if (idFrom !== null || idTo !== null || excludedIds.length > 0) {
        where.id = {
            ...(idFrom !== null && { gte: idFrom }),
            ...(idTo !== null && { lte: idTo }),
            ...(excludedIds.length > 0 && { notIn: excludedIds })
        };
    }

    if (state !== null) {
        where.state = state;
    }

    const [items, count] = await Promise.all([
        prisma.item.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createTime: true,
                inventoryId: true,
                state: true,
                cost: true,
                quantity: true,
                name: true
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.item.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Items retrieved successfully",
        {
            items,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: count,
                itemsOnPage: items.length,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            },
            filters: {
                idFrom,
                idTo,
                excludedIds,
                state,
                inventory
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
    if (!data.inventoryId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing inventoryId field"),
            { status: 400 }
        );
    }
    // database
    const item = await prisma.item.create({
        data: {
            inventoryId: data.inventoryId,
            description: data.description,
            name: data.name,
            cost: data.cost,
            quantity: data.quantity,
        }
    })
    return NextResponse.json(
        ApiResponse.success("Item created successfully", { item }),
        { status: 200 }
    );
}