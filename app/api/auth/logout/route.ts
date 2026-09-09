import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const response = NextResponse.json({ message: "Logged out successfully" }, { status: 200 })
        response.cookies.set("token", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7
        })
        return response
    }
    catch (error) {
        return NextResponse.json({ error: "Internal server error, Something went wrong" }, { status: 500 })
    }

}