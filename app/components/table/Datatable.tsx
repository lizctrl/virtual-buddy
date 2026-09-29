"use client";

import { ReactNode, useState } from "react";

import Checkbox from "../ui/Checkbox";
import Pagination from "./Pagination";

type Alignment = "left" | "center" | "right";

type SortOrder = "asc" | "desc";

export interface Column<T> {
    /** Unique column identifier. Also the value reported to onSortChange. */
    key: string;

    header: string;

    /** Field of T read when no custom render is given. */
    accessor?: keyof T;

    /**
     * Field name reported to `onSortChange`. Defaults to `key`.
     *
     * Set it whenever the column is sortable but its key is not a field the
     * backend accepts — a "Service" column keyed `service` that sorts by
     * `serviceId`, for example. Without it, clicking the header would send a
     * `sortBy` the route rejects.
     */
    sortBy?: string;

    /** Custom cell content. Use it for <Badge>, buttons, links, etc. */
    render?: (row: T) => ReactNode;

    /** Defaults to true when an accessor is present. */
    sortable?: boolean;

    align?: Alignment;
    headerClassName?: string;
    cellClassName?: string;
}

interface DatatableProps<T> {
    rows: T[];
    columns: Column<T>[];

    /** Stable identity for each row. Used as React key and selection key. */
    rowKey: (row: T) => string | number;

    loading?: boolean;
    error?: string | null;
    emptyMessage?: string;

    /** Sorting is controlled: rows are never reordered here. */
    sortBy?: string;
    sortOrder?: SortOrder;
    onSortChange?: (sortBy: string, sortOrder: SortOrder) => void;

    /** Selection is uncontrolled; pass onSelectionChange to react to it. */
    selectable?: boolean;
    onSelectionChange?: (keys: (string | number)[]) => void;

    onRowClick?: (row: T) => void;

    /** Renders an extra trailing column. */
    actions?: (row: T) => ReactNode;

    page?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
}

const alignments: Record<Alignment, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right"
};

const sortIndicators: Record<SortOrder, string> = {
    asc: "↑",
    desc: "↓"
};

const placeholderRows = Array.from({ length: 5 }, (_, i) => i);

function sortFieldOf<T>(column: Column<T>): string {
    return column.sortBy ?? column.key;
}

export default function Datatable<T>({
    rows,
    columns,
    rowKey,
    loading = false,
    error = null,
    emptyMessage = "No records found.",
    sortBy,
    sortOrder = "asc",
    onSortChange,
    selectable = false,
    onSelectionChange,
    onRowClick,
    actions,
    page = 1,
    totalPages = 1,
    onPageChange
}: DatatableProps<T>) {

    const [selected, setSelected] = useState<Set<string | number>>(
        () => new Set()
    );

    const rowKeys = rows.map(rowKey);

    // Drop keys that are no longer visible, e.g. after a page change.
    // Adjusting during render instead of in an effect avoids the extra
    // pass; prunedFor is the rows identity the selection was last synced to.
    const [prunedFor, setPrunedFor] = useState<T[] | null>(null);

    if (rows !== prunedFor) {
        setPrunedFor(rows);

        const visible = new Set(rowKeys);
        setSelected(previous => {
            const next = new Set(
                [...previous].filter(key => visible.has(key))
            );
            return next.size === previous.size ? previous : next;
        });
    }

    const allSelected =
        selectable &&
        rowKeys.length > 0 &&
        rowKeys.every(key => selected.has(key));

    const someSelected =
        selectable && !allSelected && rowKeys.some(key => selected.has(key));

    function notify(next: Set<string | number>) {
        setSelected(next);
        onSelectionChange?.([...next]);
    }

    function toggleRow(key: string | number) {
        const next = new Set(selected);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        notify(next);
    }

    function toggleAll() {
        notify(allSelected ? new Set() : new Set(rowKeys));
    }

    function handleSort(column: Column<T>) {
        if (!onSortChange) return;

        const field = sortFieldOf(column);
        const next: SortOrder =
            sortBy === field && sortOrder === "asc" ? "desc" : "asc";
        onSortChange(field, next);
    }

    function handleRowKeyDown(
        event: React.KeyboardEvent<HTMLTableRowElement>,
        row: T
    ) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onRowClick?.(row);
    }

    function renderCell(column: Column<T>, row: T): ReactNode {
        if (column.render) return column.render(row);
        if (column.accessor === undefined) return null;

        const value = row[column.accessor];
        return value === null || value === undefined ? "" : String(value);
    }

    function ariaSort(
        isSorted: boolean,
        isSortable: boolean
    ): "ascending" | "descending" | "none" | undefined {
        if (isSorted) {
            return sortOrder === "asc" ? "ascending" : "descending";
        }
        return isSortable ? "none" : undefined;
    }

    const columnCount =
        columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0);

    return (
        <div
            className="
                overflow-hidden
                rounded-xl
                border
                border-gray-200
                bg-white
            "
        >
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                        <tr className="border-b border-gray-200">
                            {selectable && (
                                <th
                                    scope="col"
                                    className="w-10 px-4 py-3"
                                >
                                    <Checkbox
                                        aria-label="Select all rows"
                                        checked={allSelected}
                                        indeterminate={someSelected}
                                        onChange={toggleAll}
                                    />
                                </th>
                            )}

                            {columns.map(column => {
                                const isSorted =
                                    sortBy === sortFieldOf(column);
                                const isSortable = Boolean(
                                    column.sortable ?? column.accessor
                                );

                                return (
                                    <th
                                        key={column.key}
                                        scope="col"
                                        aria-sort={ariaSort(
                                            isSorted,
                                            isSortable
                                        )}
                                        className={`
                                            px-4
                                            py-3
                                            text-xs
                                            font-semibold
                                            uppercase
                                            tracking-wide
                                            text-gray-500
                                            ${alignments[column.align ?? "left"]}
                                            ${column.headerClassName ?? ""}
                                        `}
                                    >
                                        {isSortable ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleSort(column)
                                                }
                                                className={`
                                                    inline-flex
                                                    items-center
                                                    gap-1
                                                    hover:text-gray-700
                                                    ${
                                                        isSorted
                                                            ? "text-blue-600"
                                                            : ""
                                                    }
                                                `}
                                            >
                                                {column.header}
                                                <span
                                                    aria-hidden="true"
                                                    className={
                                                        isSorted
                                                            ? "text-blue-600"
                                                            : "text-gray-300"
                                                    }
                                                >
                                                    {isSorted
                                                        ? sortIndicators[
                                                              sortOrder
                                                          ]
                                                        : "↕"}
                                                </span>
                                            </button>
                                        ) : (
                                            column.header
                                        )}
                                    </th>
                                );
                            })}

                            {actions && (
                                <th
                                    scope="col"
                                    className="sr-only"
                                >
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                        {loading &&
                            placeholderRows.map(index => (
                                <tr key={`placeholder-${index}`}>
                                    {selectable && (
                                        <td className="px-4 py-3">
                                            <div
                                                className="
                                                    h-4
                                                    w-4
                                                    animate-pulse
                                                    rounded
                                                    bg-gray-200
                                                "
                                            />
                                        </td>
                                    )}

                                    {columns.map(column => (
                                        <td
                                            key={column.key}
                                            className="px-4 py-3"
                                        >
                                            <div
                                                className="
                                                    h-4
                                                    w-full
                                                    max-w-32
                                                    animate-pulse
                                                    rounded
                                                    bg-gray-200
                                                "
                                            />
                                        </td>
                                    ))}

                                    {actions && (
                                        <td className="px-4 py-3" />
                                    )}
                                </tr>
                            ))}

                        {!loading && error && (
                            <tr>
                                <td
                                    colSpan={columnCount}
                                    className="
                                        px-4
                                        py-6
                                        text-center
                                        text-sm
                                        text-red-600
                                    "
                                >
                                    {error}
                                </td>
                            </tr>
                        )}

                        {!loading && !error && rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={columnCount}
                                    className="
                                        px-4
                                        py-6
                                        text-center
                                        text-sm
                                        text-gray-500
                                    "
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            !error &&
                            rows.map(row => {
                                const key = rowKey(row);
                                const isSelected = selected.has(key);

                                return (
                                    <tr
                                        key={key}
                                        tabIndex={onRowClick ? 0 : undefined}
                                        onClick={
                                            onRowClick
                                                ? () => onRowClick(row)
                                                : undefined
                                        }
                                        onKeyDown={
                                            onRowClick
                                                ? event =>
                                                      handleRowKeyDown(
                                                          event,
                                                          row
                                                      )
                                                : undefined
                                        }
                                        className={`
                                            ${
                                                onRowClick
                                                    ? "cursor-pointer hover:bg-gray-50"
                                                    : ""
                                            }
                                            ${
                                                isSelected
                                                    ? "bg-blue-50"
                                                    : ""
                                            }
                                        `}
                                    >
                                        {selectable && (
                                            <td
                                                className="px-4 py-3"
                                                onClick={event =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                <Checkbox
                                                    aria-label={`Select row ${key}`}
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        toggleRow(key)
                                                    }
                                                />
                                            </td>
                                        )}

                                        {columns.map(column => (
                                            <td
                                                key={column.key}
                                                className={`
                                                    px-4
                                                    py-3
                                                    text-gray-700
                                                    ${alignments[
                                                        column.align ?? "left"
                                                    ]}
                                                    ${column.cellClassName ?? ""}
                                                `}
                                            >
                                                {renderCell(column, row)}
                                            </td>
                                        ))}

                                        {actions && (
                                            <td
                                                className="px-4 py-3 text-right"
                                                onClick={event =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                {actions(row)}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            {onPageChange && totalPages > 1 && (
                <div className="border-t border-gray-200 px-4">
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        hasPreviousPage={page > 1}
                        hasNextPage={page < totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            )}
        </div>
    );
}
