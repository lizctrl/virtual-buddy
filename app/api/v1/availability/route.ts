// api/availability? page=1&limit=10&dateFrom=&dateTo=&excludedIds=&sortBy=&sortOrder=&state=true&service=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseRanges } from "@/app/lib/api/ranges";
import { ApiResponse } from "@/app/lib/api/responses";
import { toTimeOfDay, withTimeStrings } from "@/app/lib/api/times";
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
    const dateFrom = searchParams.get("dateFrom")?.trim() || null;
    const dateTo = searchParams.get("dateTo")?.trim() || null;
    const serviceIdParam = searchParams.get("serviceId")?.trim() || null;

    const serviceId = Number(serviceIdParam);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid serviceId parameter"),
            { status: 400 }
        );
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

    // Ranges
    const rangesResult = parseRanges(searchParams);
    if (!rangesResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(rangesResult.error),
            { status: 400 }
        );
    }

    // Sorting
    const allowedSortFields = ["id", "date", "startTime", "endTime", "status", "serviceId"] as const;
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

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.AvailabilityWhereInput = {};

    if (dateFrom !== null || dateTo !== null) {
        where.date = {
            ...(dateFrom !== null && { gte: dateFrom }),
            ...(dateTo !== null && { lte: dateTo })
        };

    }

    if (idFrom !== null || idTo !== null || excludedIds.length > 0) {
        where.id = {
            ...(idFrom !== null && { gte: idFrom }),
            ...(idTo !== null && { lte: idTo }),
            ...(excludedIds.length > 0 && { notIn: excludedIds })
        };
    }

    if (serviceId !== null) {
        where.serviceId = serviceId;
    }

    if (state !== null) {
        where.state = state;
    }


    const [rows, count] = await Promise.all([
        prisma.availability.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                status: true,
                serviceId: true,
                state: true,
                service: true
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.availability.count({
            where
        })
    ]);

    // startTime/endTime are DateTime columns but the UI works in "HH:mm".
    const availabilities = rows.map(withTimeStrings);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Availabilities retrieved successfully",
        {
            availabilities,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: count,
                itemsOnPage: availabilities.length,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            },
            filters: {
                dateFrom,
                dateTo,
                idFrom,
                idTo,
                excludedIds,
                state,
                service
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
    if (!data.date) {
        return NextResponse.json(
            ApiResponse.missingField("Missing date field"),
            { status: 400 }
        );
    }
    if (!data.startTime) {
        return NextResponse.json(
            ApiResponse.missingField("Missing startTime field"),
            { status: 400 }
        );
    }
    if (!data.endTime) {
        return NextResponse.json(
            ApiResponse.missingField("Missing endTime field"),
            { status: 400 }
        );
    }
    if (!data.serviceId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing serviceId field"),
            { status: 400 }
        );
    }
    if (!Number.isInteger(data.serviceId) || data.serviceId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid serviceId parameter"),
            { status: 400 }
        );
    }
    const startTime = toTimeOfDay(data.startTime, data.date);
    const endTime = toTimeOfDay(data.endTime, data.date);
    if (startTime === null || endTime === null) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid startTime or endTime"),
            { status: 400 }
        );
    }
    if (endTime <= startTime) {
        return NextResponse.json(
            ApiResponse.invalidParameter("endTime must be after startTime"),
            { status: 400 }
        );
    }
    // database
    const availability = await prisma.availability.create({
        data: {
            date: new Date(data.date),
            startTime,
            endTime,
            status: data.status ?? "available",
            serviceId: data.serviceId,
        }
    })
    return NextResponse.json(
        ApiResponse.success("Availability created successfully", { availability: withTimeStrings(availability) }),
        { status: 200 }
    );
}
