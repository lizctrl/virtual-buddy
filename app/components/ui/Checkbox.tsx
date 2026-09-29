"use client";

import {
    InputHTMLAttributes,
    useEffect,
    useRef
} from "react";

interface CheckboxProps
    extends Omit<
        InputHTMLAttributes<HTMLInputElement>,
        "type"
    > {

    label?: string;

    /**
     * Renders the mixed state used by "select all" checkboxes.
     * `indeterminate` is a DOM property, not an HTML attribute,
     * so it cannot be forwarded through ...props.
     */
    indeterminate?: boolean;
}

export default function Checkbox({
    label,
    indeterminate = false,
    id,
    ...props
}: CheckboxProps) {

    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

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
                ref={ref}
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