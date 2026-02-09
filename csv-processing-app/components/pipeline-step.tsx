"use client"

import type React from "react"
import { GripVertical } from "lucide-react"

interface PipelineStepProps {
  id: string
  index: number
  total: number
  label: string
  children: React.ReactNode
  disabled?: boolean
  draggedId: string | null
  overId: string | null
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent) => void
}

export function PipelineStep({
  id,
  index,
  total,
  label,
  children,
  disabled = false,
  draggedId,
  overId,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: PipelineStepProps) {
  const isDragging = draggedId === id
  const isOver = overId === id && draggedId !== id

  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        onDragStart(id)
      }}
      onDragOver={(e) => onDragOver(e, id)}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={[
        "rounded-lg border p-4 transition-all",
        isDragging ? "opacity-40 border-dashed" : "",
        isOver ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border",
        disabled ? "" : "cursor-grab active:cursor-grabbing",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex flex-col items-center gap-0.5 select-none",
            disabled ? "opacity-30" : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4" />
          <span className="text-[10px] font-mono leading-none text-muted-foreground">
            {index + 1}/{total}
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {children}
        </div>
      </div>
    </div>
  )
}
