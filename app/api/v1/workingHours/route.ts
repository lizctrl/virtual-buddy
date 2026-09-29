/// api/working_hours?page=1&limit=10&sortBy=&sortOrder=&serviceId=&idFrom=&idTo=&excludedIds=&state=true&createTimeFrom=&createTimeTo=&excludedCreateTime=

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseDateRanges, parseRanges } from "@/app/lib/api/ranges";
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
    const idResult = parseRanges(searchParams);
    if (!idResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(idResult.error),
            { status: 400 }
        );
    }

    const dateResult = parseDateRanges(searchParams, "createTimeFrom", "createTimeTo", "excludedCreateTime");
    if (!dateResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(dateResult.error),
            { status: 400 }
        );
    }

    // Sorting
    const allowedSortFields = ["id", "createTime", "serviceId", "state"] as const;
    const sortingResult = parseSorting(searchParams, allowedSortFields);
    if (!sortingResult.success) {
        return NextResponse.json(
            ApiResponse.invalidSorting(sortingResult.error),
            { status: 400 }
        );
    }
    //Values 
    const { sortBy, sortOrder } = sortingResult;

    const { from: idFrom, to: idTo, excluded: excludedIds } = idResult;



    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.WorkingHoursWhereInput = {};


    if (idFrom !== null || idTo !== null || excludedIds.length > 0) {
        where.id = {
            ...(idFrom !== null && { gte: idFrom }),
            ...(idTo !== null && { lte: idTo }),
            ...(excludedIds.length > 0 && { notIn: excludedIds })
        };
    }


    const [rows, count] = await Promise.all([
        prisma.workingHours.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                weekDay: true,
                startTime: true,
                endTime: true,
                serviceId: true,
                state: true,
                service: true
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.workingHours.count({
            where
        })
    ]);

    // startTime/endTime are DateTime columns but the UI works in "HH:mm".
    const workingHours = rows.map(withTimeStrings);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Working hours retrieved successfully",
        {
            workingHours,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: count,
                itemsOnPage: workingHours.length,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            },
            filters: {
                idFrom,
                idTo,
                excludedIds
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
    if (!data.weekDay) {
        return NextResponse.json(
            ApiResponse.missingField("Missing weekDay field"),
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
    const startTime = toTimeOfDay(data.startTime);
    const endTime = toTimeOfDay(data.endTime);
    if (startTime === null || endTime === null) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid startTime or endTime"),
            { status: 400 }
        );
    }
    // database
    const workingHours = await prisma.workingHours.create({
        data: {
            weekDay: data.weekDay,
            startTime,
            endTime,
            serviceId: data.serviceId,
        }
    })
    return NextResponse.json(
        ApiResponse.success("Working hours created successfully", { workingHours: withTimeStrings(workingHours) }),
        { status: 200 }
    );
}