"use client";

import {
    ChangeEvent,
    FormEvent,
    useState
} from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";

import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";

interface RegisterForm {
    name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
}

const initialForm: RegisterForm = {
    name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
};

export default function RegisterForm() {
    const router = useRouter();

    const [form, setForm] =
        useState<RegisterForm>(initialForm);

    const [error, setError] =
        useState<string | null>(null);

    const [loading, setLoading] =
        useState(false);

    function handleChange(
        event: ChangeEvent<HTMLInputElement>
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

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const response =
                await fetch("/api/auth/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: form.name,
                        last_name: form.last_name,
                        email: form.email,
                        phone: form.phone,
                        password: form.password
                    })
                });

            const result = await response.json();

            if (!response.ok) {
                setError(
                    result.message ??
                    result.error ??
                    "Unable to create account"
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                    id="name"
                    name="name"
                    label="Name"
                    value={form.name}
                    onChange={handleChange}
                    required
                />

                <Input
                    id="last_name"
                    name="last_name"
                    label="Last name"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                />
            </div>

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
                id="phone"
                name="phone"
                type="tel"
                label="Phone"
                value={form.phone}
                onChange={handleChange}
                required
            />

            <Input
                id="password"
                name="password"
                type="password"
                label="Password"
                value={form.password}
                onChange={handleChange}
                required
            />

            <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                label="Confirm password"
                value={form.confirmPassword}
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
                    ? "Creating account..."
                    : "Create account"
                }
            </Button>

            <p className="text-center text-sm">
                Already have an account?{" "}

                <Link
                    href="/login"
                    className="font-medium text-blue-600"
                >
                    Sign in
                </Link>
            </p>
        </form>
    );
}