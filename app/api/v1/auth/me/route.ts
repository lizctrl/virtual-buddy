import { getCurrentUser } from "@/app/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(user);
    }
    catch (error) {
        return NextResponse.json({ error: "Internal server error, Something went wrong" }, { status: 500 });
    }
} 