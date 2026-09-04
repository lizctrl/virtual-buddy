import { generateToken, hashPassword } from "@/app/lib/auth"
import { prisma } from "@/app/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, password, name } = body
        if (!email || !password || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
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
                email,
                name,
                password: hashedPassword,
                lasrname: body.lasrname,
                state: true,
                phone: body.phone
            }
        })
        const token = await generateToken(newUser.id)
        const response = NextResponse.json({ user: newUser, token }, { status: 201 })
        response.cookies.set("token", token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 })
        return response
    }
    catch (error) {
        return NextResponse.json({ error: "Internal server error, Something went wrong" }, { status: 500 })
    }


}    