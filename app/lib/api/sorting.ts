type SortOrder = "asc" | "desc";

type SortingResult<T extends string> =
    | {
        success: true;
        sortBy: T;
        sortOrder: SortOrder;
    }
    | {
        success: false;
        error: string;
    };

export function parseSorting<T extends string>(
    searchParams: URLSearchParams,
    allowedFields: readonly T[],
    defaultField: T = allowedFields[0]
): SortingResult<T> {
    const sortBy = searchParams.get("sortBy") ?? defaultField;
    const sortOrder = searchParams.get("sortOrder") ?? "asc";

    if (!allowedFields.includes(sortBy as T)) {
        return {
            success: false,
            error: `Invalid sortBy parameter. Allowed fields: ${allowedFields.join(", ")}`
        };
    }

    if (sortOrder !== "asc" && sortOrder !== "desc") {
        return {
            success: false,
            error: "sortOrder must be either 'asc' or 'desc'"
        };
    }

    return {
        success: true,
        sortBy: sortBy as T,
        sortOrder
    };
}