/// api/profile?user=true&picture=true&page=1&limit=10&sortBy=&sortOrder=&userId=&idFrom=&idTo=&excludedIds=&state=true&createTimeFrom=&createTimeTo=&excludedCreateTime=

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseDateRanges, parseRanges } from "@/app/lib/api/ranges";
import { ApiResponse } from "@/app/lib/api/responses";
import { parseSorting } from "@/app/lib/api/sorting";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { parseProfilePicture } from "@/app/lib/profile-picture";
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

    const user = userResult.value ?? false;

    const pictureResult = parseBoolean(searchParams, "picture");
    if (!pictureResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(pictureResult.error),
            { status: 400 }
        );
    }

    const picture = pictureResult.value ?? false;
    const stateResult = parseBoolean(searchParams, "state");
    if (!stateResult.success) {
        return NextResponse.json(ApiResponse.invalidParameter(stateResult.error), { status: 400 });
    }
    const requestedUser = searchParams.get("userId");
    if (requestedUser !== null && Number(requestedUser) !== currentUser.id) {
        return NextResponse.json(ApiResponse.unauthorized("Solo puedes consultar tu propio perfil."), { status: 403 });
    }

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
    const allowedSortFields = ["id", "createTime", "userId", "state"] as const;
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
    const where: Prisma.ProfileWhereInput = { userId: currentUser.id, state: stateResult.value ?? true };


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

    const [profiles, count] = await Promise.all([
        prisma.profile.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createTime: true,
                picture,
                userId: true,
                state: true,
                user: user ? {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        last_name: true,
                        state: true,
                        phone: true,
                        businesses: true,
                        appointments: true,
                        moderations: { select: { id: true, createTime: true, userId: true, businessId: true, status: true, state: true } },
                        profiles: true
                    }
                } : false
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.profile.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Profiles retrieved successfully",
        {
            profiles,
            pagination: {
                page,
                limit,
                totalPages,
                totalItems: count,
                itemsOnPage: profiles.length,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            },
            filters: {
                idFrom,
                idTo,
                excludedIds,
                user,
                picture
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
    const data = await req.json().catch(() => null);
    if (data?.userId !== undefined && data.userId !== currentUser.id) {
        return NextResponse.json(ApiResponse.unauthorized("Solo puedes guardar tu propio perfil."), { status: 403 });
    }
    const picture = parseProfilePicture(data?.picture);
    if (picture === null) {
        return NextResponse.json(ApiResponse.invalidParameter("Usa una dirección de imagen que empiece con https:// o http://."), { status: 400 });
    }

    const userId = currentUser.id;
    const profile = await prisma.$transaction(async tx => {
        // Serialize the first save so simultaneous requests cannot create duplicate profiles.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const existing = await tx.profile.findFirst({
            where: { userId, state: true },
            orderBy: { id: "desc" },
            select: { id: true }
        });
        return existing
            ? tx.profile.update({ where: { id: existing.id }, data: { picture } })
            : tx.profile.create({ data: { userId, picture } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return NextResponse.json(ApiResponse.success("Perfil guardado.", { profile }));
}
