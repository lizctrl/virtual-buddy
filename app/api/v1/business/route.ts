// api/business? page=1&limit=10&description=&name=&ownerId=&idFrom=&idTo=&excludedId=&sortBy=&sortOrder=&state=true&catalog=true&inventory=true&owner=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { parsePagination } from "@/app/lib/api/pagination";
import { parseRanges } from "@/app/lib/api/ranges";
import { ApiResponse } from "@/app/lib/api/responses";
import { parseSorting } from "@/app/lib/api/sorting";
import { getCurrentUser } from "@/app/lib/auth";
import { businessLocation } from "@/app/lib/costa-rica-locations";
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
    const description = searchParams.get("description")?.trim() || null;
    const ownerIdParam = searchParams.get("ownerId")?.trim();
    const ownerId = ownerIdParam ? Number(ownerIdParam) : null;
    if (ownerId !== null) {
        if (!Number.isInteger(ownerId) || ownerId < 1) {
            return NextResponse.json(
                ApiResponse.invalidParameter("ownerId must be a positive integer"),
                { status: 400 }
            );
        }

    }

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
    const inventoryResult = parseBoolean(searchParams, "inventory");
    if (!inventoryResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(inventoryResult.error),
            { status: 400 }
        );
    }
    const ownerResult = parseBoolean(searchParams, "owner");
    if (!ownerResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(ownerResult.error),
            { status: 400 }
        );
    }
    // Ranges
    const rangesResult = parseRanges(searchParams,);
    if (!rangesResult.success) {
        return NextResponse.json(
            ApiResponse.invalidRange(rangesResult.error),
            { status: 400 }
        );
    }

    // Sorting
    const allowedSortFields = ["id", "name", "description", "ownerId"] as const;
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
    const catalogs = catalogResult.value ?? false;
    const inventories = inventoryResult.value ?? false;
    const owner = ownerResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Owner-only listing; the public directory is /api/v1/directory.
    const where: Prisma.BusinessWhereInput = { AND: [{ ownerId: currentUser.id }] };

    if (name) {
        where.name = {
            contains: name,
            mode: "insensitive"
        };
    }
    if (description) {
        where.description = {
            contains: description,
            mode: "insensitive"
        };
    }
    if (ownerId !== null) {
        where.ownerId = {
            equals: ownerId
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

    const [businesses, count] = await Promise.all([
        prisma.business.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                name: true,
                description: true,
                ownerId: true,
                cantonCode: true,
                catalogs,
                inventories,
                owner: owner ? {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        last_name: true,
                        phone: true,
                        state: true
                    }
                } : false,
                state: true,
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.business.count({
            where

        })
    ])

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(ApiResponse.success("Businesses retrieved successfully", {
        businesses,
        pagination: {
            page,
            limit,
            totalPages,
            totalItems: count,
            itemsOnPage: businesses.length,
            hasPreviousPage: page > 1,
            hasNextPage: page < totalPages
        },
        filters: {
            name,
            description,
            ownerId,
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
    const data = await req.json().catch(() => null);
    if (typeof data?.name !== "string" || !data.name.trim() ||
        typeof data.description !== "string" || !data.description.trim()) {
        return Response.json(ApiResponse.invalidParameter("Escribe el nombre y la descripción del negocio."), { status: 400 });
    }
    if (data.ownerId !== undefined && data.ownerId !== currentUser.id) {
        return Response.json(ApiResponse.unauthorized("Solo puedes crear negocios para tu cuenta."), { status: 403 });
    }
    const cantonCode = data.cantonCode ?? null;
    if (cantonCode !== null && (typeof cantonCode !== "number" || !businessLocation(cantonCode))) {
        return Response.json(ApiResponse.invalidParameter("Selecciona un cantón válido."), { status: 400 });
    }
    const business = await prisma.business.create({
        data: {
            name: data.name.trim(),
            description: data.description.trim(),
            ownerId: currentUser.id,
            cantonCode
        }
    });
    return Response.json(ApiResponse.success("Negocio creado.", { business }));
}
