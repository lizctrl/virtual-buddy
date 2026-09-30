import type { ApiResponseCode } from "./responses";

/** Mirrors the `pagination` block every list route returns. */
export interface Pagination {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
    itemsOnPage: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export type ApiResult<T> =
    | {
        ok: true;
        data: T;
        message: string;
    }
    | {
        ok: false;
        data: null;
        message: string;
        code: ApiResponseCode | null;
        status: number;
    };

function isEnvelope(payload: unknown): payload is {
    code: ApiResponseCode;
    message: string;
    data: unknown;
} {
    return (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        "data" in payload
    );
}

function readMessage(payload: unknown): string | null {
    if (typeof payload !== "object" || payload === null) return null;
    if (!("message" in payload)) return null;

    const message = (payload as { message?: unknown }).message;
    return typeof message === "string" && message.length > 0
        ? message
        : null;
}

/**
 * Routes answer with the ApiResponse envelope `{ code, message, data }`,
 * but `/api/v1/auth/me` returns the bare user object. Normalize both by
 * pulling `data` out when the envelope is present, so callers can always
 * read the same shape regardless of the route.
 */
function unwrap<T>(payload: unknown): T {
    if (isEnvelope(payload)) return payload.data as T;
    return payload as T;
}

async function request<T>(
    url: string,
    init?: RequestInit
): Promise<ApiResult<T>> {
    let res: Response;

    try {
        res = await fetch(url, init);
    } catch {
        return {
            ok: false,
            data: null,
            message: "Unable to connect to the server",
            code: null,
            status: 0
        };
    }

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
        return {
            ok: false,
            data: null,
            message:
                readMessage(payload) ??
                `Request failed with status ${res.status}`,
            code: isEnvelope(payload) ? payload.code : null,
            status: res.status
        };
    }

    return {
        ok: true,
        data: unwrap<T>(payload),
        message: readMessage(payload) ?? ""
    };
}

function jsonInit(method: string, body?: unknown): RequestInit {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    };
}

export function apiGet<T>(url: string): Promise<ApiResult<T>> {
    return request<T>(url);
}

export function apiPost<T>(
    url: string,
    body?: unknown
): Promise<ApiResult<T>> {
    return request<T>(url, jsonInit("POST", body));
}

export function apiPut<T>(
    url: string,
    body?: unknown
): Promise<ApiResult<T>> {
    return request<T>(url, jsonInit("PUT", body));
}

export function apiPatch<T>(
    url: string,
    body?: unknown
): Promise<ApiResult<T>> {
    return request<T>(url, jsonInit("PATCH", body));
}

export function apiDelete<T>(url: string): Promise<ApiResult<T>> {
    return request<T>(url, { method: "DELETE" });
}
