import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  scrollTargetId?: string;
  className?: string;
}

export function PaginationBar({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemName = "items",
  scrollTargetId,
  className,
}: PaginationBarProps) {
  if (totalItems === 0) return null;

  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  const handlePageChange = (page: number) => {
    onPageChange(page);
    if (scrollTargetId) {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    onPageSizeChange(newSize);
    if (scrollTargetId) {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t text-xs",
        className,
      )}
    >
      {/* Range summary and Page size */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-muted-foreground">
        <span>
          Showing{" "}
          <span className="font-semibold text-foreground">
            {startItem}–{endItem}
          </span>{" "}
          of <span className="font-semibold text-foreground">{totalItems}</span>{" "}
          {itemName}
        </span>
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="pagination-page-size"
            className="text-muted-foreground whitespace-nowrap hidden xs:inline"
          >
            Show:
          </label>
          <select
            id="pagination-page-size"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation buttons */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage <= 1}
            className="h-9 min-w-[76px] px-2.5 text-xs flex items-center justify-center gap-1 font-medium"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Prev</span>
          </Button>

          {/* Desktop Page Numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - safeCurrentPage) <= 1,
              )
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                  acc.push(`ellipsis-${p}`);
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item) => {
                if (typeof item === "string") {
                  return (
                    <span key={item} className="px-1 text-muted-foreground">
                      …
                    </span>
                  );
                }
                const isCurrent = item === safeCurrentPage;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handlePageChange(item)}
                    className={cn(
                      "h-8 min-w-[32px] px-2 rounded-md font-mono text-xs font-semibold transition-colors",
                      isCurrent
                        ? "bg-brand-blue text-white shadow-2xs"
                        : "text-foreground hover:bg-muted",
                    )}
                    aria-current={isCurrent ? "page" : undefined}
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </button>
                );
              })}
          </div>

          {/* Mobile Page Indicator */}
          <span className="sm:hidden text-xs font-mono font-medium text-foreground px-2">
            Page {safeCurrentPage} of {totalPages}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="h-9 min-w-[76px] px-2.5 text-xs flex items-center justify-center gap-1 font-medium"
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

