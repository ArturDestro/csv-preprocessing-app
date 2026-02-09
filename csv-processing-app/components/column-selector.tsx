"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ColumnSelectorProps {
  label: string
  description: string
  columns: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
}

export function ColumnSelector({
  label,
  description,
  columns,
  selected,
  onChange,
  disabled = false,
}: ColumnSelectorProps) {
  const allSelected = columns.length > 0 && selected.length === columns.length
  const someSelected = selected.length > 0 && selected.length < columns.length

  const toggleAll = () => {
    if (allSelected) {
      onChange([])
    } else {
      onChange([...columns])
    }
  }

  const toggleColumn = (column: string) => {
    if (selected.includes(column)) {
      onChange(selected.filter((c) => c !== column))
    } else {
      onChange([...selected, column])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled || columns.length === 0}
          className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      {columns.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          Upload a CSV to see available columns
        </p>
      ) : (
        <ScrollArea className="max-h-28">
          <div className="flex flex-wrap gap-x-4 gap-y-2 py-1">
            {columns.map((column) => (
              <div key={column} className="flex items-center gap-1.5">
                <Checkbox
                  id={`${label}-${column}`}
                  checked={selected.includes(column)}
                  onCheckedChange={() => toggleColumn(column)}
                  disabled={disabled}
                  className="h-3.5 w-3.5"
                  ref={(el) => {
                    if (el && someSelected && !selected.includes(column)) {
                      // no-op, just keeping individual checkboxes in sync
                    }
                  }}
                />
                <Label
                  htmlFor={`${label}-${column}`}
                  className="text-xs font-normal cursor-pointer select-none"
                >
                  {column}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
