// api/catalog? page=1&limit=10&name=&idFrom=&idTo=&excludedId=&sortBy=&sortOrder=&state=true&service=true&business=true&businessId=

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
    const name = searchParams.get("name")?.trim() || null;
    const businessIdParam = searchParams.get("businessId")?.trim();
    const businessId = businessIdParam ? Number(businessIdParam) : null;
    if (businessId !== null) {
        if (!Number.isInteger(businessId) || businessId < 1) {
            return NextResponse.json(
                ApiResponse.invalidParameter("businessId must be a positive integer"),
                { status: 400 }
            );
        }

    }
    //booleans
    const stateResult = parseBoolean(searchParams, "state");
    if (!stateResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(stateResult.error),
            { status: 400 }
        );
    }

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

    // Ranges
    const rangesResult = parseRanges(searchParams);
    if (!rangesResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(rangesResult.error),
            { status: 400 }
        );
    }

    // Sorting
    const allowedSortFields = ["id", "name", "businessId"] as const;
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
    const service = serviceResult.value ?? false;
    const business = businessResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.CatalogWhereInput = {};

    if (name) {
        where.name = {
            contains: name,
            mode: "insensitive"
        };
    }

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

    if (businessId !== null) {
        where.businessId = {
            equals: businessId
        };
    }

    const [catalogs, count] = await Promise.all([
        prisma.catalog.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                name: true,
                businessId: true,
                state: true,
                services: service,
                business: business
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.catalog.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Catalogs retrieved successfully", {
        catalogs,
        pagination: {
            page,
            limit,
            totalPages,
            totalItems: count,
            itemsOnPage: catalogs.length,
            hasPreviousPage: page > 1,
            hasNextPage: page < totalPages
        },
        filters: {
            name,
            businessId,
            idFrom,
            idTo,
            excludedIds,
            state
        },
        sort: {
            by: sortBy,
            order: sortOrder
        }
    }));
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
    if (!data.name) {
        return NextResponse.json(
            ApiResponse.missingField("Missing name field"),
            { status: 400 }
        );
    }
    if (!data.businessId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing businessId field"),
            { status: 400 }
        );
    }
    if (!Number.isInteger(data.businessId) || data.businessId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid businessId parameter"),
            { status: 400 }
        );
    }
    // database
    const catalog = await prisma.catalog.create({
        data: {
            name: data.name,
            businessId: data.businessId,
        }
    })
    return NextResponse.json(
        ApiResponse.success("Catalog created successfully", { catalog }),
        { status: 200 }
    );
}