// api/business/[businessId]
import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth"
import { prisma } from "@/app/lib/db"
import { NextRequest, NextResponse } from "next/server"
// /api/business/[businessId]
export async function GET(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
    const { businessId } = await params
    if (!businessId) {
        return NextResponse.json(
            ApiResponse.missingParameter("Missing businessId parameter"),
            { status: 400 }
        );
    }

    const user = await getCurrentUser();
    if (!user) {
        // user not Authenticated
        return NextResponse.json(
            ApiResponse.unauthenticated("User not authenticated"),
            { status: 401 }
        );

    }
    const business = await getBusiness(businessId);
    if (!business) {
        return Response.json(
            ApiResponse.notFound("Business not found"),
            { status: 404 }
        );
    }

    return NextResponse.json(
        ApiResponse.success("Business retrieved successfully", { business }),
        { status: 200 }
    );

}

async function getBusiness(businessId: string, catalog = false, inventory = false) {
    const business = await prisma.business.findUnique({
        where: {
            id: Number(businessId)
        },
        select: {
            id: true,
            name: true,
            description: true,
            owner: true,
            catalogs: catalog,
            inventories: inventory
        }
    })
    return business
}
