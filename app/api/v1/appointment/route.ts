// api/appoitment? page=1&limit=10&name=&description=&idFrom=&idTo=&excludedId=&sortBy=&sortOrder=&state=true&service=true&business=true

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
    const userIdParam = searchParams.get("userId")?.trim() || null;
    const serviceIdParam = searchParams.get("serviceId")?.trim() || null;
    const status = searchParams.get("status")?.trim() || null;

    const userId = Number(userIdParam);

    if (!Number.isInteger(userId) || userId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid userId parameter"),
            { status: 400 }
        );
    }
    const serviceId = Number(serviceIdParam);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid serviceId parameter"),
            { status: 400 }
        );
    }

    const ownerIdParam = searchParams.get("ownerId")?.trim() || null;
    const ownerId = ownerIdParam ? Number(ownerIdParam) : null;
    if (ownerId !== null && (!Number.isInteger(ownerId) || ownerId <= 0)) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid ownerId parameter"),
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
    const businessResult = parseBoolean(searchParams, "business");
    if (!businessResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(businessResult.error),
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
    const allowedSortFields = ["id", "dueDate", "serviceId", "status", "userId"] as const;
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
    const business = businessResult.value ?? false;

    const { page, limit, skip } = paginationResult;


    // Dynamic WHERE
    const where: Prisma.AppointmentWhereInput = {};


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
    if (status !== null) {
        where.status = status;
    }
    if (userId !== null) {
        where.userId = userId;
    }
    if (serviceId !== null) {
        where.serviceId = serviceId;
    }
    if (ownerId !== null) {
        where.service = {
            catalog: { business: { ownerId } }
        };
    }

    const [appointments, count] = await Promise.all([
        prisma.appointment.findMany({
            where,
            take: limit,
            skip,
            select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                serviceId: true,
                status: true,
                dueDate: true,
                state: true,
                notifications: true,
                service: true
            },
            orderBy: [{ [sortBy]: sortOrder }]
        }),
        prisma.appointment.count({
            where
        })
    ]);

    const totalPages = Math.ceil(count / limit);
    return NextResponse.json(
        ApiResponse.success(
            "Appointments retrieved successfully",
            {
                appointments,
                pagination: {
                    page,
                    limit,
                    totalPages,
                    totalItems: count,
                    itemsOnPage: appointments.length,
                    hasPreviousPage: page > 1,
                    hasNextPage: page < totalPages
                },
                filters: {
                    idFrom,
                    idTo,
                    excludedIds,
                    state,
                    service,
                    business
                },
                sort: {
                    by: sortBy,
                    order: sortOrder
                }
            }
        )
    );
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
    if (!data.dueDate) {
        return NextResponse.json(
            ApiResponse.missingField("Missing dueDate field"),
            { status: 400 }
        );
    }
    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid dueDate parameter"),
            { status: 400 }
        );
    }

    // Fetch service with its business to verify existence and get businessId
    const service = await prisma.service.findUnique({
        where: { id: data.serviceId },
        include: { catalog: true }
    });
    if (!service || !service.state) {
        return NextResponse.json(
            ApiResponse.notFound("Service not found"),
            { status: 404 }
        );
    }

    // Ban check: is this user banned from the service's business?
    const businessId = service.catalog?.businessId;
    if (businessId) {
        const ban = await prisma.moderation.findFirst({
            where: {
                userId: currentUser.id,
                businessId,
                status: "banned",
                state: true
            }
        });
        if (ban) {
            return NextResponse.json(
                ApiResponse.unauthorized("You are banned from booking this business"),
                { status: 403 }
            );
        }
    }

    const status = data.status ?? "pending";

    const appointment = await prisma.appointment.create({
        data: {
            userId: currentUser.id,
            serviceId: data.serviceId,
            status,
            dueDate
        }
    });

    // Notify the business owner about the new booking
    if (businessId) {
        const business = await prisma.business.findUnique({
            where: { id: businessId },
            select: { name: true }
        });
        await prisma.notification.create({
            data: {
                appointmentId: appointment.id,
                title: "New appointment booked",
                content: `A client booked an appointment for ${business?.name ?? "your business"} on ${dueDate.toLocaleString()}.`
            }
        });
    }

    return NextResponse.json(
        ApiResponse.success("Appointment created successfully", { appointment }),
        { status: 201 }
    );
}