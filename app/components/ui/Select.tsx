import { SelectHTMLAttributes } from "react";

interface Option {
    label: string;
    value: string | number;
}

interface SelectProps
    extends SelectHTMLAttributes<HTMLSelectElement> {

    label?: string;
    options: Option[];
    error?: string;
}

export default function Select({
    label,
    options,
    error,
    id,
    className = "",
    ...props
}: SelectProps) {

    return (
        <div className="flex flex-col gap-1">

            {label && (
                <label
                    htmlFor={id}
                    className="text-sm font-medium"
                >
                    {label}
                </label>
            )}

            <select
                id={id}
                className={`
                    border
                    rounded-md
                    px-3
                    py-2
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                    ${error
                        ? "border-red-500"
                        : "border-gray-300"
                    }
                    ${className}
                `}
                {...props}
            >
                {options.map(option => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </option>
                ))}
            </select>

            {error && (
                <span className="text-sm text-red-500">
                    {error}
                </span>
            )}

        </div>
    );
}