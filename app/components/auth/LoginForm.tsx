"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";

interface LoginForm {
    email: string;
    password: string;
}

export default function LoginForm() {
    const router = useRouter();

    const [form, setForm] = useState<LoginForm>({
        email: "",
        password: ""
    });

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function handleChange(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError(null);
        setLoading(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(form)
            });

            const result = await response.json();

            if (!response.ok) {
                setError(
                    result.message ??
                    result.error ??
                    "Unable to login"
                );

                return;
            }

            router.push("/dashboard");
            router.refresh();

        } catch {
            setError("Unable to connect to the server");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
        >
            <Input
                id="email"
                name="email"
                type="email"
                label="Email"
                placeholder="example@email.com"
                value={form.email}
                onChange={handleChange}
                required
            />

            <Input
                id="password"
                name="password"
                type="password"
                label="Password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
            />

            {error && (
                <div
                    className="
                        rounded-md
                        bg-red-50
                        p-3
                        text-sm
                        text-red-600
                    "
                >
                    {error}
                </div>
            )}

            <Button
                type="submit"
                disabled={loading}
            >
                {loading
                    ? "Signing in..."
                    : "Sign in"
                }
            </Button>

            <p className="text-center text-sm">
                Don&apos;t have an account?{" "}

                <Link
                    href="/register"
                    className="font-medium text-blue-600"
                >
                    Register
                </Link>
            </p>
        </form>
    );
}