import { ApiResponse } from "@/app/lib/api/responses"
import { comparePassword, generateToken, hashPassword } from "@/app/lib/auth"
import { prisma } from "@/app/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, password } = body
        if (!email || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }
        // Check if user exists
        const user = await prisma.user.findUnique({
            where: {
                email,
                state: true
            }
        })
        if (!user) {
            return NextResponse.json(
                ApiResponse.unauthenticated("Invalid email or password"),
                { status: 401 }
            )
        }
        // Check if password is correct
        const { password: hashPassword, ...curatedUser } = user;
        const isPasswordCorrect = comparePassword(password, user.password)
        if (!isPasswordCorrect) {
            return NextResponse.json(
                ApiResponse.unauthenticated("Invalid email or password"),
                { status: 401 })
        }
        // Generate token
        const token = await generateToken(user.id)

        // Return response
        const response = NextResponse.json(
            ApiResponse.success(
                "User logged in successfully",
                { user: curatedUser }
            ),
            { status: 200 }
        )
        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60
        })
        return response
    }
    catch (error) {
        return NextResponse.json(
            ApiResponse.internalServerError("Something went wrong"),
            { status: 500 }
        )
    }


}