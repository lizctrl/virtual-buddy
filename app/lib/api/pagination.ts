export type PaginationResult =
    | {
        success: true;
        page: number;
        limit: number;
        skip: number;
    }
    | {
        success: false;
        error: string;
    };

export function parsePagination(
    searchParams: URLSearchParams
): PaginationResult {

    const page = Number(
        searchParams.get("page") ?? "1"
    );

    const limit = Number(searchParams.get("limit") ?? "10");

    if (!Number.isInteger(page) || page < 1) {
        return {
            success: false,
            error: "page must be a positive integer"
        };
    }

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        return {
            success: false,
            error: "limit must be between 1 and 100"
        };
    }

    return {
        success: true,
        page,
        limit,
        skip: (page - 1) * limit
    };
}