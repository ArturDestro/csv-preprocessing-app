"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface CsvPreviewProps {
  headers: string[]
  rows: string[][]
  totalRows: number
}

export function CsvPreview({ headers, rows, totalRows }: CsvPreviewProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Data Preview</p>
        <Badge variant="secondary" className="text-xs">
          {totalRows.toLocaleString()} rows / {headers.length} columns
        </Badge>
      </div>
      <ScrollArea className="h-56 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs text-muted-foreground w-10">#</TableHead>
              {headers.map((header) => (
                <TableHead key={header} className="text-xs font-semibold">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {i + 1}
                </TableCell>
                {row.map((cell, j) => (
                  <TableCell key={j} className="text-xs max-w-40 truncate">
                    {cell || <span className="text-muted-foreground italic">empty</span>}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {totalRows > rows.length && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first {rows.length} of {totalRows.toLocaleString()} rows
        </p>
      )}
    </div>
  )
}
