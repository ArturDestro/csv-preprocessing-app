"use client"

import { useState } from "react"
import { CheckSquare, Square, Columns } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CsvPreviewProps {
  columns: string[]
  rows: Record<string, string>[]
  selectedColumns: string[]
  onSelectedColumnsChange: (cols: string[]) => void
}

const MAX_PREVIEW_ROWS = 10

export function CsvPreview({
  columns,
  rows,
  selectedColumns,
  onSelectedColumnsChange,
}: CsvPreviewProps) {
  const [showAll, setShowAll] = useState(false)

  const visibleRows = showAll ? rows : rows.slice(0, MAX_PREVIEW_ROWS)
  const allSelected = columns.every((c) => selectedColumns.includes(c))
  const noneSelected = selectedColumns.length === 0

  const toggleColumn = (col: string) => {
    if (selectedColumns.includes(col)) {
      onSelectedColumnsChange(selectedColumns.filter((c) => c !== col))
    } else {
      onSelectedColumnsChange([...selectedColumns, col])
    }
  }

  const toggleAll = () => {
    if (allSelected) {
      onSelectedColumnsChange([])
    } else {
      onSelectedColumnsChange([...columns])
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Columns className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Preview — {rows.length} rows, {columns.length} columns
          </span>
        </div>
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Column pills */}
      <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/40 border border-border">
        {columns.map((col) => {
          const active = selectedColumns.includes(col)
          return (
            <button
              key={col}
              onClick={() => toggleColumn(col)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono border transition-all",
                active
                  ? "bg-primary/20 border-primary/60 text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {active ? (
                <CheckSquare className="h-2.5 w-2.5" />
              ) : (
                <Square className="h-2.5 w-2.5" />
              )}
              {col}
            </button>
          )
        })}
        {noneSelected && (
          <p className="text-xs text-muted-foreground italic self-center ml-1">
            No columns selected — all will be available to pipeline blocks.
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="w-10 px-3 py-2 text-left text-muted-foreground font-mono font-medium">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      "px-3 py-2 text-left font-mono font-semibold whitespace-nowrap border-l border-border/50 transition-colors",
                      selectedColumns.includes(col)
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <button
                      onClick={() => toggleColumn(col)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {selectedColumns.includes(col) ? (
                        <CheckSquare className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <Square className="h-3 w-3 flex-shrink-0" />
                      )}
                      {col}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-1.5 text-muted-foreground font-mono tabular-nums">
                    {i + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={cn(
                        "px-3 py-1.5 font-mono border-l border-border/30 whitespace-nowrap max-w-[160px] truncate",
                        selectedColumns.includes(col)
                          ? "text-foreground"
                          : "text-muted-foreground/60",
                      )}
                      title={row[col]}
                    >
                      {row[col] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > MAX_PREVIEW_ROWS && (
          <div className="flex items-center justify-center px-4 py-2 border-t border-border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-7"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "Show fewer rows"
                : `Show all ${rows.length} rows (${rows.length - MAX_PREVIEW_ROWS} more)`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
