"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { apiGet, apiPost } from "@/app/lib/api/client";
import AppIcon, { type AppIconName } from "@/app/components/ui/AppIcon";
import { User } from "@/app/types/types";

const navItems: { href: string; label: string; icon: AppIconName }[] = [
    { href: "/dashboard", label: "Panel", icon: "panel" },
    { href: "/explore", label: "Explorar", icon: "explore" },
    { href: "/my-appointments", label: "Mis citas", icon: "calendar" },
    { href: "/notifications", label: "Notificaciones", icon: "notifications" },
    { href: "/profile", label: "Mi perfil", icon: "profile" }
];

export default function AppLayout({
    children,
    account
}: {
    children: React.ReactNode;
    account?: Pick<User, "name" | "email">;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet<User>("/api/v1/auth/me")
            .then(result => setUser(result.ok ? result.data : null))
            .finally(() => setLoading(false));
    }, []);

    async function handleLogout() {
        await apiPost("/api/v1/auth/logout");
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

    const displayedUser = account ?? user;

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
            <aside className="flex flex-col border-b border-gray-200 bg-white md:w-56 md:shrink-0 md:border-r md:border-b-0 lg:w-64">
                <div className="border-b border-gray-200 p-6">
                    <Link
                        href="/dashboard"
                        className="text-xl font-bold text-blue-600"
                    >
                        Virtual Buddy
                    </Link>
                </div>

                <nav aria-label="Menú principal" className="flex flex-1 flex-wrap gap-1 p-3 md:block md:space-y-1 md:p-4">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={pathname === item.href ? "page" : undefined}
                            className={`
                                flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-700
                                ${pathname === item.href || (item.href === "/explore" && pathname.startsWith("/businesses/"))
                                    ? "bg-indigo-50 text-indigo-800"
                                    : "text-slate-700 hover:bg-slate-50"}
                            `}
                        >
                            <AppIcon name={item.icon} className="size-4 shrink-0" />
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="border-t border-gray-200 p-4">
                    {displayedUser ? (
                        <>
                            <p className="truncate text-sm font-medium text-gray-900">{displayedUser.name}</p>
                            <p className="truncate text-xs text-gray-500">{displayedUser.email}</p>
                            <button type="button" onClick={handleLogout} className="mt-3 inline-flex items-center gap-2 rounded text-sm font-medium text-rose-700 hover:underline focus-visible:outline-2">
                                <AppIcon name="logout" className="size-4" /> Cerrar sesión
                            </button>
                        </>
                    ) : (
                        <Link href="/login" className="inline-flex items-center gap-2 rounded text-sm font-semibold text-indigo-700 hover:underline focus-visible:outline-2">
                            <AppIcon name="login" className="size-4" /> Iniciar sesión
                        </Link>
                    )}
                </div>
            </aside>

            <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
                {children}
            </main>
        </div>
    );
}
