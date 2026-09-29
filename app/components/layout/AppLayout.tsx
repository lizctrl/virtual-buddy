"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { User } from "@/app/types/types";

const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/explore", label: "Explore" },
    { href: "/my-appointments", label: "My appointments" },
    { href: "/notifications", label: "Notifications" },
    { href: "/profile", label: "Profile" }
];

export default function AppLayout({
    children
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/auth/me")
            .then(res => (res.ok ? res.json() : null))
            .then(data => setUser(data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    async function handleLogout() {
        await fetch("/api/v1/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-gray-500">
                Loading...
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
                <div className="border-b border-gray-200 p-6">
                    <Link
                        href="/dashboard"
                        className="text-xl font-bold text-blue-600"
                    >
                        Virtual Buddy
                    </Link>
                </div>

                <nav className="flex-1 space-y-1 p-4">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                block rounded-md px-3 py-2 text-sm font-medium
                                ${pathname === item.href
                                    ? "bg-blue-50 text-blue-600"
                                    : "text-gray-700 hover:bg-gray-100"}
                            `}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="border-t border-gray-200 p-4">
                    <p className="truncate text-sm font-medium text-gray-900">
                        {user?.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                        {user?.email}
                    </p>
                    <button
                        onClick={handleLogout}
                        className="mt-3 w-full text-left text-sm text-red-600 hover:text-red-700"
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    );
}
