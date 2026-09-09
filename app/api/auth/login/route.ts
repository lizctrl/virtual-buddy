import { generateToken, hashPassword } from "@/app/lib/auth"
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
                email
            }
        })
        if (!user) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
        }
        // Check if password is correct
        const isPasswordCorrect = await hashPassword(password) === user.password
        if (!isPasswordCorrect) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
        }
        // Generate token
        const token = await generateToken(user.id)
        const response = NextResponse.json({ user, token }, { status: 200 })
        response.cookies.set("token", token, {
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