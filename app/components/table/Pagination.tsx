"use client";

import Button from "../ui/Button";

interface PaginationProps {
    page: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;

    onPageChange: (page: number) => void;
}

export default function Pagination({
    page,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    onPageChange
}: PaginationProps) {

    return (
        <div
            className="
                flex
                items-center
                justify-between
                gap-4
                mt-4
            "
        >

            <Button
                variant="secondary"
                disabled={!hasPreviousPage}
                onClick={() =>
                    onPageChange(page - 1)
                }
            >
                Previous
            </Button>

            <span className="text-sm">
                Page {page} of {totalPages}
            </span>

            <Button
                variant="secondary"
                disabled={!hasNextPage}
                onClick={() =>
                    onPageChange(page + 1)
                }
            >
                Next
            </Button>

        </div>
    );
}