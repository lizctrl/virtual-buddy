export enum ApiResponseCode {
    Success = "Success",
    Error = "Error",
    Unauthenticated = "Unauthenticated",
    NotFound = "NotFound",
    InvalidParameter = "InvalidParameter",
    MissingParameter = "MissingParameter",
    MissingField = "MissingField",
    InvalidRange = "InvalidRange",
    InvalidSorting = "InvalidSorting",
    InvalidPagination = "InvalidPagination",
    Unauthorized = "Unauthorized"
}

export class ApiResponse<T = null> {
    code: ApiResponseCode;
    message: string;
    data: T;

    constructor(
        code: ApiResponseCode,
        message: string,
        data: T
    ) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    static success<T>(
        message: string,
        data: T
    ) {
        return new ApiResponse(
            ApiResponseCode.Success,
            message,
            data
        );
    }

    static error<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.Error,
            message,
            data
        );
    }

    static unauthenticated<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.Unauthenticated,
            message,
            data
        );
    }
    static unauthorized<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.Unauthorized,
            message,
            data
        );
    }
    static notFound<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.NotFound,
            message,
            data
        );
    }

    static invalidParameter<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.InvalidParameter,
            message,
            data
        );
    }

    static missingParameter<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.MissingParameter,
            message,
            data
        );
    }

    static missingField<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.MissingField,
            message,
            data
        );
    }

    static invalidRange<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.InvalidRange,
            message,
            data
        );
    }

    static invalidSorting<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.InvalidSorting,
            message,
            data
        );
    }

    static invalidPagination<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.InvalidPagination,
            message,
            data
        );
    }

    static internalServerError<T = null>(
        message: string,
        data: T = null as T
    ) {
        return new ApiResponse(
            ApiResponseCode.Error,
            message,
            data
        );

    }
}