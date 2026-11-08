import type { Metadata } from "next";
import LoginForm from "@/app/components/auth/LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión", alternates: { canonical: "/login" } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const { next } = await searchParams;
    const destination = typeof next === "string" && /^\/services\/\d+$/.test(next) ? next : "/dashboard";
    return (
        <main
            className="
                min-h-screen
                flex
                items-center
                justify-center
                bg-gray-50
                p-4
            "
        >
            <div
                className="
                    w-full
                    max-w-md
                    rounded-xl
                    bg-white
                    p-8
                    shadow
                "
            >
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">
                        Welcome back
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                        Sign in to Virtual Buddy
                    </p>
                </div>

                <LoginForm destination={destination} />
            </div>
        </main>
    );
}