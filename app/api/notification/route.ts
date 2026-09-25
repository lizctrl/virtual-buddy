/// api/notification?appointment=true&page=1&limit=10&sortBy=&sortOrder=&title=&content=&createTimeFrom=&createTimeTo=&excludedCreateTime=&state=true&idFrom=&idTo=&excludedIds=&sortBy=&sortOrder=

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
    const appointmentResult = parseBoolean(searchParams, "appointment");
    if (!appointmentResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(appointmentResult.error),
            { status: 400 }
        );
    }

    const appointment = appointmentResult.value ?? false;

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
    const allowedSortFields = ["id", "createTime", "title", "content", "appointmentId", "state"] as const;
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
    const { from: createTimeFrom, to: createTimeTo, excluded: excludedCreateTimes } = dateResult;


    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.NotificationWhereInput = {};


    if (idFrom !== null || idTo !== null || excludedIds.length > 0) {
        where.id = {
            ...(idFrom !== null && { gte: idFrom }),
            ...(idTo !== null && { lte: idTo }),
            ...(excludedIds.length > 0 && { notIn: excludedIds })
        };
    }
    if (createTimeFrom !== null || createTimeTo !== null || excludedCreateTimes.length > 0) {
        where.createTime = {
            ...(createTimeFrom !== null && { gte: createTimeFrom }),
            ...(createTimeTo !== null && { lte: createTimeTo }),
            ...(excludedCreateTimes.length > 0 && { notIn: excludedCreateTimes })
        };
    }

    const [notifications, count] = await Promise.all([
        prisma.notification.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createTime: true,
                title: true,
                content: true,
                appointmentId: true,
                state: true,
                appointment: appointment ? {
                    select: {
                        id: true,
                        createdAt: true,
                        updatedAt: true,
                        userId: true,
                        serviceId: true,
                        status: true,
                        dueDate: true,
                        state: true,
                    }
                } : false
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.notification.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Notifications retrieved successfully",
        {
            notifications,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: count,
                itemsOnPage: notifications.length,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            },
            filters: {
                idFrom,
                idTo,
                excludedIds,
                appointment
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
    if (!data.appointmentId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing appointmentId field"),
            { status: 400 }
        );
    }

    if (!data.title) {
        return NextResponse.json(
            ApiResponse.missingField("Missing title field"),
            { status: 400 }
        );
    }

    if (!data.content) {
        return NextResponse.json(
            ApiResponse.missingField("Missing content field"),
            { status: 400 }
        );
    }

    // database
    const notification = await prisma.notification.create({
        data: {
            appointmentId: data.appointmentId,
            title: data.title,
            content: data.content
        }
    })
    return NextResponse.json(
        ApiResponse.success("Notification created successfully", { notification }),
        { status: 200 }
    );
}