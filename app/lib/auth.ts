import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { User } from "../types/types";
import { prisma } from "./db";
import { use } from "react";

const JWT_SECRET = process.env.JWT_SECRET! as string;

export async function hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
}

export async function generateToken(userId: number) {
    const token = jwt.sign({ userId }, JWT_SECRET as string, {
        expiresIn: "1h",
    });
    return token;
}

export async function verifyToken(token: string): Promise<{ userId: number; }> {
    const decoded = jwt.verify(token, JWT_SECRET as string) as { userId: number };
    return decoded;
}

export async function getCurrentUser(): Promise<User | null> {

    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;

        if (!token) {
            return null;
        }
        const decoded = await verifyToken(token);

        const userFromDb = await prisma.user.findUnique({
            where: {
                id: decoded.userId
            }
        })
        if (!userFromDb) {
            return null;
        }
        const { id, ...user } = userFromDb
        return user as User;

    } catch (error) {
        console.error("Error getting current user:", error);
        return null;
    }

}
