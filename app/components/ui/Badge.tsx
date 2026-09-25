import { ReactNode } from "react";

interface BadgeProps {
    children: ReactNode;
    variant?: "success" | "danger" | "warning" | "default";
}

export default function Badge({
    children,
    variant = "default"
}: BadgeProps) {

    const variants = {
        success:
            "bg-green-100 text-green-700",

        danger:
            "bg-red-100 text-red-700",

        warning:
            "bg-yellow-100 text-yellow-700",

        default:
            "bg-gray-100 text-gray-700"
    };

    return (
        <span
            className={`
                inline-flex
                px-2
                py-1
                text-xs
                font-medium
                rounded-full
                ${variants[variant]}
            `}
        >
            {children}
        </span>
    );
}