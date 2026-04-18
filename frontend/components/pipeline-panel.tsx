"use client"

import { useState, useRef, useCallback } from "react"
import { ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { PipelineBlockCard } from "@/components/pipeline-block-card"
import {
  type PipelineBlock,
  DEFAULT_BLOCKS,
} from "@/lib/pipeline-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PipelinePanelProps {
  jobId: string | null
  columns: string[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

export function PipelinePanel({ jobId, columns }: PipelinePanelProps) {
  const [blocks, setBlocks] = useState<PipelineBlock[]>(DEFAULT_BLOCKS)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Drag state
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    dragIndex.current = index
  }, [])

  const handleDragEnter = useCallback((index: number) => {
    setDragOverIndex(index)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragIndex.current !== null && dragOverIndex !== null && dragIndex.current !== dragOverIndex) {
      setBlocks((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIndex.current!, 1)
        next.splice(dragOverIndex, 0, moved)
        return next
      })
    }
    dragIndex.current = null
    setDragOverIndex(null)
  }, [dragOverIndex])

  const toggleBlock = useCallback((id: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b))
    )
  }, [])

  const updateBlock = useCallback((id: string, config: PipelineBlock["config"]) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, config } as PipelineBlock : b))
    )
  }, [])

  const buildPayload = () => {
    const activeBlocks = blocks.filter((b) => b.enabled || b.step === "loader")
    const order = activeBlocks.map((b) => b.step)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = { order }
    for (const block of activeBlocks) {
      if (block.step === "loader") {
        payload["loader"] = { ...block.config }
      } else {
        payload[block.step] = { ...block.config }
      }
    }
    return payload
  }

  const handleSubmit = async () => {
    if (!jobId) return
    setSubmitting(true)
    setResult(null)
    try {
      const payload = buildPayload()
      const res = await fetch(`${API_BASE}/run_pipeline/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Pipeline failed: ${res.statusText}`)
      setResult({ ok: true, message: "Pipeline applied successfully." })
    } catch (err: unknown) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Pipeline request failed.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const enabledSteps = blocks.filter((b) => b.enabled || b.step === "loader")

  return (
    <div className="space-y-4">
      {/* Pipeline flow summary */}
      <div className="flex items-center gap-1.5 flex-wrap p-3 rounded-lg bg-muted/40 border border-border">
        {enabledSteps.map((b, i) => (
          <div key={b.id} className="flex items-center gap-1.5">
            <span
              className="font-mono text-xs px-2 py-0.5 rounded-full border"
              style={{
                borderColor: `var(--block-${b.step})`,
                color: `var(--block-${b.step})`,
                backgroundColor: `color-mix(in oklch, var(--block-${b.step}) 12%, transparent)`,
              }}
            >
              {b.step}
            </span>
            {i < enabledSteps.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Blocks list */}
      <div className="space-y-2" aria-label="Pipeline steps">
        {blocks.map((block, index) => {
          const isDragging = dragOverIndex === index
          return (
            <div
              key={block.id}
              draggable={block.step !== "loader"}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={cn(
                "transition-all",
                isDragging && dragIndex.current !== index && "opacity-50",
              )}
            >
              <PipelineBlockCard
                block={block}
                columns={columns}
                index={index}
                total={blocks.length}
                dragHandleProps={{
                  onMouseDown: (e) => {
                    e.currentTarget.parentElement?.setAttribute("draggable", "true")
                  },
                }}
                isDragging={dragOverIndex === index && dragIndex.current !== index}
                onToggle={toggleBlock}
                onChange={updateBlock}
              />
            </div>
          )
        })}
      </div>

      {/* Result feedback */}
      {result && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
            result.ok
              ? "bg-chart-2/10 border-chart-2/30 text-chart-2"
              : "bg-destructive/10 border-destructive/30 text-destructive-foreground",
          )}
        >
          {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!jobId || submitting}
        className="w-full"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Applying Pipeline...
          </>
        ) : (
          "FAZER ALTERAÇÕES"
        )}
      </Button>

      {!jobId && (
        <p className="text-center text-xs text-muted-foreground">
          Upload a CSV file first to enable the pipeline.
        </p>
      )}
    </div>
  )
}
