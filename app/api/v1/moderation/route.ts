/// api/moderation?user=true&page=1&limit=10&sortBy=&sortOrder=&status=&idFrom=&idTo=&excludedIds=&state=true&createTimeFrom=&createTimeTo=&sortBy=&sortOrder=

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseDateRanges, parseRanges } from "@/app/lib/api/ranges";
import { ApiResponse } from "@/app/lib/api/responses";
import { parseSorting } from "@/app/lib/api/sorting";
import { getCurrentUser } from "@/app/lib/auth";
import { changeClientModeration, moderationChange } from "@/app/lib/moderation";
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
            ownerId: currentUser.id,
            state: true
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
                reason: true,
                businessId: true,
                state: true,
                user: user ? {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        last_name: true,
                        state: true
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
    const body = await req.json().catch(() => null);
    const { businessId, userId } = body ?? {};
    const change = moderationChange(body);
    if (!Number.isInteger(businessId) || businessId <= 0 || businessId > 2_147_483_647 ||
        !Number.isInteger(userId) || userId <= 0 || userId > 2_147_483_647 || !change) {
        return Response.json(ApiResponse.invalidParameter("Selecciona un cliente válido e indica un motivo de hasta 500 caracteres para bloquearlo."), { status: 400 });
    }

    const moderation = await changeClientModeration(currentUser.id, businessId, userId, change);
    if (!moderation) {
        return Response.json(ApiResponse.notFound("Cliente del negocio no encontrado."), { status: 404 });
    }
    return Response.json(ApiResponse.success(change.status === "banned" ? "Cliente bloqueado." : "Cliente desbloqueado.", { moderation }));
}
