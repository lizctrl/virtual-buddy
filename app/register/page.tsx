import RegisterForm
    from "@/app/components/auth/RegisterForm";

export default function RegisterPage() {
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
                    max-w-lg
                    rounded-xl
                    bg-white
                    p-8
                    shadow
                "
            >
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">
                        Create account
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                        Create your Virtual Buddy account
                    </p>
                </div>

                <RegisterForm />
            </div>
        </main>
    );
}