import { ApiResponse } from "@/app/lib/api/responses"
import { generateToken, hashPassword } from "@/app/lib/auth"
import { prisma } from "@/app/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, name, last_name, phone } = body
        if (email === undefined) {
            return NextResponse.json(ApiResponse.missingField("Missing email field"), { status: 400 })
        }
        if (password === undefined) {
            return NextResponse.json(ApiResponse.missingField("Missing password field"), { status: 400 })
        }
        if (name === undefined) {
            return NextResponse.json(ApiResponse.missingField("Missing name field"), { status: 400 })
        }
        if (last_name === undefined) {
            return NextResponse.json(ApiResponse.missingField("Missing last_name field"), { status: 400 })
        }
        if (phone === undefined) {
            return NextResponse.json(ApiResponse.missingField("Missing phone field"), { status: 400 })
        }
        if (password.length < 8) {
            return NextResponse.json(ApiResponse.invalidParameter("Password must be at least 8 characters"), { status: 400 })
        }
        if (password.length > 100) {
            return NextResponse.json(ApiResponse.invalidParameter("Password must be at most 100 characters"), { status: 400 })
        }

        if (!email.includes("@")) {
            return NextResponse.json(ApiResponse.invalidParameter("Invalid email address"), { status: 400 })
        }
        if (email.tri().includes(" ")) {
            return NextResponse.json(ApiResponse.invalidParameter("Email cannot contain spaces"), { status: 400 })
        }
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email
            }
        })
        if (existingUser) {
            return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
        }

        const hashedPassword = await hashPassword(password)

        // Create new user
        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                name,
                password: hashedPassword,
                last_name: body.last_name,
                state: true,
                phone: body.phone
            }
        })
        const token = await generateToken(newUser.id)
        const response = NextResponse.json({ user: newUser, token }, { status: 201 })
        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60
        })
        return response
    }
    catch (error) {
        console.log(error)
        return NextResponse.json({ error: "Internal server error, Something went wrong" }, { status: 500 })
    }


}

