import { InputHTMLAttributes } from "react";

interface CheckboxProps
    extends Omit<
        InputHTMLAttributes<HTMLInputElement>,
        "type"
    > {

    label?: string;
}

export default function Checkbox({
    label,
    id,
    ...props
}: CheckboxProps) {

    return (
        <label
            htmlFor={id}
            className="
                flex
                items-center
                gap-2
                cursor-pointer
            "
        >
            <input
                id={id}
                type="checkbox"
                className="
                    w-4
                    h-4
                    cursor-pointer
                "
                {...props}
            />

            {label && (
                <span className="text-sm">
                    {label}
                </span>
            )}

        </label>
    );
}