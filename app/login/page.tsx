import LoginForm from "@/app/components/auth/LoginForm";

export default function LoginPage() {
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

                <LoginForm />
            </div>
        </main>
    );
}