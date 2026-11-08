import { NextRequest } from "next/server";
import { parsePagination } from "@/app/lib/api/pagination";
import { ApiResponse } from "@/app/lib/api/responses";
import { prisma } from "@/app/lib/db";
import { publicBusiness, publicBusinessSelect, publicBusinessWhere } from "@/app/lib/public-business";

export async function GET(request: NextRequest) {
    const pagination = parsePagination(request.nextUrl.searchParams);
    if (!pagination.success) {
        return Response.json(ApiResponse.invalidPagination(pagination.error), { status: 400 });
    }

    const { limit, skip } = pagination;
    const rows = await prisma.business.findMany({
        where: publicBusinessWhere,
        select: publicBusinessSelect,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: limit + 1,
        skip
    });

    return Response.json(ApiResponse.success("Emprendimientos disponibles en el directorio.", {
        businesses: rows.slice(0, limit).map(publicBusiness),
        hasNextPage: rows.length > limit
    }));
}
