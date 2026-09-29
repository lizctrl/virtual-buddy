// api/service? page=1&limit=10&name=&description=&idFrom=&idTo=&excludedId=&sortBy=&sortOrder=&state=true&catalog=true&availability=true&workingHours=true&appointments=true

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
    const description = searchParams.get("description")?.trim() || null;

    //booleans
    const stateResult = parseBoolean(searchParams, "state");
    if (!stateResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(stateResult.error),
            { status: 400 }
        );
    }

    const catalogResult = parseBoolean(searchParams, "catalog");
    if (!catalogResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(catalogResult.error),
            { status: 400 }
        );
    }
    const availabilityResult = parseBoolean(searchParams, "availability");
    if (!availabilityResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(availabilityResult.error),
            { status: 400 }
        );
    }
    const workingHoursResult = parseBoolean(searchParams, "workingHours");
    if (!workingHoursResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(workingHoursResult.error),
            { status: 400 }
        );
    }
    const appointmentsResult = parseBoolean(searchParams, "appointments");
    if (!appointmentsResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(appointmentsResult.error),
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
    const allowedSortFields = ["id", "name", "description"] as const;
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
    const catalog = catalogResult.value ?? false;
    const availability = availabilityResult.value ?? false;
    const workingHours = workingHoursResult.value ?? false;
    const appointments = appointmentsResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.ServiceWhereInput = {};

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

    const [catalogs, count] = await Promise.all([
        prisma.service.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                name: true,
                catalogId: true,
                state: true,
                appointments,
                availability,
                workingHours,
                catalog
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.service.count({
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
            description,
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
    if (!data.catalogId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing catalogId field"),
            { status: 400 }
        );
    }
    if (!Number.isInteger(data.catalogId) || data.catalogId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid catalogId parameter"),
            { status: 400 }
        );
    }
    // database
    const service = await prisma.service.create({
        data: {
            name: data.name,
            catalogId: data.catalogId,
        }
    })
    return NextResponse.json(
        ApiResponse.success("Service created successfully", { service }),
        { status: 200 }
    );
}