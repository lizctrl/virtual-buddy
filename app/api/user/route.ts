import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseRanges } from "@/app/lib/api/ranges";
import { parseSorting } from "@/app/lib/api/sorting";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server"
import { ApiResponse } from "@/app/lib/api/responses";
// /api/user ?page=1&limit=10&name=&email=&phone=&state=true&idFrom=&idTo=&excludedId=
export async function GET(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json(
            { code: "Unauthenticated", message: "User not authenticated" },
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

    //Range Filters
    const rangesResult = parseRanges(searchParams);
    if (!rangesResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(rangesResult.error),
            { status: 400 }
        );
    }
    const booleanResult = parseBoolean(searchParams, "state");
    if (!booleanResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(booleanResult.error),
            { status: 400 }
        );
    }

    //Sorting
    const allowedSortFields = ["id", "name", "email"] as const;
    const sortingResult = parseSorting(searchParams, allowedSortFields);
    if (!sortingResult.success) {
        return NextResponse.json(
            ApiResponse.invalidSorting(sortingResult.error),
            { status: 400 }
        );
    }

    // Validation


    // Values
    const { from: idFrom, to: idTo, excluded: excludedIds } = rangesResult;
    const { value: state } = booleanResult;
    const { sortBy, sortOrder } = sortingResult;
    const { page, limit, skip } = paginationResult;

    const name = searchParams.get("name")?.trim() || null;
    const email = searchParams.get("email")?.trim() || null;
    const phone = searchParams.get("phone")?.trim() || null;


    // Dynamic WHERE

    const where: Prisma.UserWhereInput = {};


    if (state !== null) {
        where.state = state;
    }

    if (name) {
        where.name = {
            contains: name,
            mode: "insensitive"
        };
    }
    if (email) {
        where.email = {
            contains: email,
            mode: "insensitive"
        };
    }

    if (phone) {
        where.phone = {
            contains: phone,
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

    const [users, count] = await Promise.all([
        prisma.user.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                name: true,
                last_name: true,
                email: true,
                phone: true,
                state: true
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.user.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);

    return NextResponse.json(ApiResponse.success("Users retrieved successfully", {
        users,
        pagination: {
            page,
            limit,
            totalPages,
            totalItems: count,
            itemsOnPage: users.length,
            hasPreviousPage: page > 1,
            hasNextPage: page < totalPages
        },
        filters: {
            name,
            email,
            state,
            phone,
            idFrom,
            idTo,
            excludedIds
        },
        sort: {
            by: sortBy,
            order: sortOrder
        }
    }));
}
