/// api/working_hours?page=1&limit=10&sortBy=&sortOrder=&serviceId=&idFrom=&idTo=&excludedIds=&state=true&createTimeFrom=&createTimeTo=&excludedCreateTime=

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseDateRanges, parseRanges } from "@/app/lib/api/ranges";
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


    const [workingHours, count] = await Promise.all([
        prisma.workingHours.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createTime: true,
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