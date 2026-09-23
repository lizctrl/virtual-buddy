export type RangesResult =
    | {
        success: true;
        from: number | null;
        to: number | null;
        excluded: number[];
    }
    | {
        success: false;
        error: string;
    };

export function parseRanges(
    searchParams: URLSearchParams,
    fromKey: string = "idFrom",
    toKey: string = "idTo",
    excludeKey: string = "excludedId"
): RangesResult {
    const idFromParam = searchParams.get(fromKey);
    const idToParam = searchParams.get(toKey);

    const idFrom = idFromParam !== null
        ? Number(idFromParam)
        : null;

    const idTo = idToParam !== null
        ? Number(idToParam)
        : null;

    const excludedIds = searchParams
        .getAll(excludeKey)
        .map(Number)

    if (
        (idFrom !== null && !Number.isInteger(idFrom)) ||
        (idTo !== null && !Number.isInteger(idTo))
    ) {
        return {
            success: false,
            error: `${fromKey} and ${toKey} must be integers`
        };
    }

    if (
        idFrom !== null &&
        idTo !== null &&
        idFrom > idTo
    ) {
        return {
            success: false,
            error: `${fromKey} cannot be greater than ${toKey}`
        };
    }
    if (idFrom !== null && idFrom < 1) {
        return {
            success: false,
            error: `${fromKey} must be a positive integer`
        };
    }
    if (idTo !== null && idTo < 1) {
        return {
            success: false,
            error: `${toKey} must be a positive integer`
        };
    }
    if (excludedIds.some(id => !Number.isInteger(id))) {
        return {
            success: false,
            error: `Invalid ${excludeKey} parameter, must be integers`
        };
    }
    return {
        success: true,
        from: idFrom,
        to: idTo,
        excluded: excludedIds
    };

}