/// api/moderation?user=true&page=1&limit=10&sortBy=&sortOrder=&status=&idFrom=&idTo=&excludedIds=&state=true&createTimeFrom=&createTimeTo=&sortBy=&sortOrder=

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
    const userResult = parseBoolean(searchParams, "user");
    if (!userResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(userResult.error),
            { status: 400 }
        );
    }

    // booleans
    const stateResult = parseBoolean(searchParams, "state");
    if (!stateResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(stateResult.error),
            { status: 400 }
        );
    }

    // Ranges
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
    const allowedSortFields = ["id", "createTime", "userId", "status", "state"] as const;
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

    const state = stateResult.value ?? false;
    const user = userResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE (scoped to businesses owned by the current user)
    const where: Prisma.ModerationWhereInput = {
        business: {
            ownerId: currentUser.id
        }
    };


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

    if (state !== null) {
        where.state = state;
    }

    const [moderations, count] = await Promise.all([
        prisma.moderation.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createTime: true,
                userId: true,
                status: true,
                state: true,
                user: user ? {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        last_name: true,
                        state: true,
                        phone: true,
                        password: true,
                        businesses: true,
                        appointments: true,
                        moderations: true,
                        profiles: true
                    }
                } : false
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.moderation.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Moderations retrieved successfully",
        {
            moderations,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: count,
                itemsOnPage: moderations.length,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            },
            filters: {
                idFrom,
                idTo,
                excludedIds,
                state,
                user
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
    if (!data.userId) {
        return NextResponse.json(
            ApiResponse.missingField("Missing userId field"),
            { status: 400 }
        );
    }
    if (!Number.isInteger(data.userId) || data.userId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid userId parameter"),
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
    if (!data.status) {
        return NextResponse.json(
            ApiResponse.missingField("Missing status field"),
            { status: 400 }
        );
    }
    // Verify the current user owns the business
    const business = await prisma.business.findFirst({
        where: { id: data.businessId, ownerId: currentUser.id }
    });
    if (!business) {
        return NextResponse.json(
            ApiResponse.unauthorized("You do not own this business"),
            { status: 403 }
        );
    }
    // Upsert: update existing moderation or create a new one
    const existing = await prisma.moderation.findFirst({
        where: { userId: data.userId, businessId: data.businessId }
    });
    const moderation = existing
        ? await prisma.moderation.update({
            where: { id: existing.id },
            data: { status: data.status, state: true }
        })
        : await prisma.moderation.create({
            data: {
                userId: data.userId,
                businessId: data.businessId,
                status: data.status
            }
        });
    return NextResponse.json(
        ApiResponse.success("Moderation saved successfully", { moderation }),
        { status: 200 }
    );
}   