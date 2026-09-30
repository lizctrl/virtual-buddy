type BooleanResult =
    | {
        success: true;
        value: boolean | null;
    }
    | {
        success: false;
        error: string;
    };

export function parseBoolean(
    searchParams: URLSearchParams,
    field: string
): BooleanResult {
    const value = searchParams.get(field);

    if (value === null) {
        return {
            success: true,
            value: null
        };
    }

    if (value === "true") {
        return {
            success: true,
            value: true
        };
    }

    if (value === "false") {
        return {
            success: true,
            value: false
        };
    }

    return {
        success: false,
        error: `${field} must be either 'true' or 'false'`
    };
}