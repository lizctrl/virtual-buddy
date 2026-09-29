/// api/service/[serviceId]? catalog=true&availability=true&workingHours=true&appointments=true

import { parseBoolean } from "@/app/lib/api/boolean";
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );
    }
    const { serviceId } = await params
    if (!serviceId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing serviceId parameter"),
            { status: 400 }
        );
    }

    const id = Number(serviceId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
            ApiResponse.invalidParameter("Invalid serviceId parameter"),
            { status: 400 }
        );
    }

    const searchParams = req.nextUrl.searchParams;
    // booleans
    const catalogResult = parseBoolean(searchParams, "catalog");
    if (!catalogResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(catalogResult.error),
            { status: 400 }
        );
    }
    const availabilityResult = parseBoolean(searchParams, "availability");
    if (!availabilityResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(availabilityResult.error),
            { status: 400 }
        );
    }
    const workingHoursResult = parseBoolean(searchParams, "workingHours");
    if (!workingHoursResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(workingHoursResult.error),
            { status: 400 }
        );
    }
    const appointmentsResult = parseBoolean(searchParams, "appointments");
    if (!appointmentsResult.success) {
        return NextResponse.json(
            ApiResponse.invalidParameter(appointmentsResult.error),
            { status: 400 }
        );
    }

    const catalog = catalogResult.value ?? false;
    const availability = availabilityResult.value ?? false;
    const workingHours = workingHoursResult.value ?? false;
    const appointments = appointmentsResult.value ?? false;

    // database
    const service = await getService(id, catalog, availability, workingHours, appointments);
    if (!service) {
        return NextResponse.json(
            ApiResponse.notFound("Service not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Service retrieved successfully", { service }),
        { status: 200 }
    );
}
async function getService(
    serviceId: number,
    catalog = false,
    availability = false,
    workingHours = false,
    appointments = false
) {
    return prisma.service.findUnique({
        where: {
            id: serviceId
        },
        select: {
            id: true,
            name: true,
            catalogId: true,
            state: true,
            appointments,
            availability,
            workingHours,
            catalog
        }
    });
}