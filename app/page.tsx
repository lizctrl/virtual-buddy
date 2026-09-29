import Link from "next/link";

export default function Home() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 p-4">
            <div className="w-full max-w-2xl text-center text-white">
                <h1 className="mb-4 text-5xl font-bold">
                    Virtual Buddy
                </h1>

                <p className="mb-8 text-xl text-blue-100">
                    Manage your business, services, and appointments — all in
                    one place.
                </p>

                <div className="flex justify-center gap-4">
                    <Link
                        href="/register"
                        className="rounded-full bg-white px-8 py-3 font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                        Get started
                    </Link>

                    <Link
                        href="/login"
                        className="rounded-full border-2 border-white px-8 py-3 font-semibold text-white transition hover:bg-white/10"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
