"use client"

import { useState, useRef, useCallback } from "react"
import { ArrowRight, Loader2, CheckCircle2, AlertCircle, Download, FileJson, Eye } from "lucide-react"
import { PipelineBlockCard } from "@/components/pipeline-block-card"
import {
  type PipelineBlock,
  DEFAULT_BLOCKS,
} from "@/lib/pipeline-types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface PipelinePanelProps {
  jobId: string | null
  columns: string[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n")
  const headers = lines[0].split(",").map((h) => h.trim())
  const rows = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()))
  return { headers, rows }
}

function TransformedPreview({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const VISIBLE = 10
  const [showAll, setShowAll] = useState(false)
  const visibleRows = showAll ? rows : rows.slice(0, VISIBLE)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">CSV Transformado</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {rows.length} linhas · {headers.length} colunas
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-3 py-2 text-left font-mono text-muted-foreground w-8">#</th>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-mono text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/50 transition-colors hover:bg-muted/20"
              >
                <td className="px-3 py-1.5 text-muted-foreground/50 font-mono">{i + 1}</td>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-3 py-1.5 font-mono whitespace-nowrap",
                      cell === "" ? "text-muted-foreground/30 italic" : "text-foreground",
                    )}
                  >
                    {cell === "" ? "—" : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border bg-muted/10 hover:bg-muted/20 transition-colors"
        >
          {showAll
            ? "Mostrar menos"
            : `Mostrar todas as ${rows.length} linhas (${rows.length - VISIBLE} a mais)`}
        </button>
      )}
    </div>
  )
}

export function PipelinePanel({ jobId, columns }: PipelinePanelProps) {
  const [blocks, setBlocks] = useState<PipelineBlock[]>(DEFAULT_BLOCKS)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pipelineApplied, setPipelineApplied] = useState(false)
  const [previewOn, setPreviewOn] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null)

  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((index: number) => { dragIndex.current = index }, [])
  const handleDragEnter = useCallback((index: number) => { setDragOverIndex(index) }, [])
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
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)))
  }, [])

  const updateBlock = useCallback((id: string, config: PipelineBlock["config"]) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, config } as PipelineBlock : b)))
  }, [])

  const buildPayload = () => {
    const activeBlocks = blocks.filter((b) => b.enabled || b.step === "loader")
    const order = activeBlocks.map((b) => b.step)
    const payload: Record<string, any> = { order }
    for (const block of activeBlocks) {
      payload[block.step === "loader" ? "loader" : block.step] = { ...block.config }
    }
    return payload
  }

  const fetchPreview = async () => {
    if (!jobId) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`${API_BASE}/download_csv/${jobId}`)
      if (!res.ok) throw new Error(await res.text())
      const text = await res.text()
      setPreviewData(parseCsv(text))
    } catch {
      setPreviewData(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePreviewToggle = async (checked: boolean) => {
    setPreviewOn(checked)
    if (checked && pipelineApplied && !previewData) {
      await fetchPreview()
    }
  }

  const handleSubmit = async () => {
    if (!jobId) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/run_pipeline/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) throw new Error(`Pipeline failed: ${res.statusText}`)
      setResult({ ok: true, message: "Pipeline aplicado com sucesso." })
      setPipelineApplied(true)
      setPreviewData(null)
      if (previewOn) await fetchPreview()
    } catch (err: unknown) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Pipeline request failed.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadCsv = async () => {
    if (!jobId) return
    try {
      const res = await fetch(`${API_BASE}/download_csv/${jobId}`)
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `resultado_${jobId.slice(0, 8)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Download falhou." })
    }
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pipeline_config_${jobId ? jobId.slice(0, 8) : "draft"}.json`
    a.click()
    URL.revokeObjectURL(url)
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
        {blocks.map((block, index) => (
          <div
            key={block.id}
            draggable={block.step !== "loader"}
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "transition-all",
              dragOverIndex === index && dragIndex.current !== index && "opacity-50",
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
        ))}
      </div>

      {/* Result feedback */}
      {result && (
        <div className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
          result.ok
            ? "bg-chart-2/10 border-chart-2/30 text-chart-2"
            : "bg-destructive/10 border-destructive/30 text-destructive-foreground",
        )}>
          {result.ok
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}

      {/* Submit + preview switch */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!jobId || submitting}
          className="flex-1"
          size="lg"
        >
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying Pipeline...</>
          ) : (
            "FAZER ALTERAÇÕES"
          )}
        </Button>

        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all select-none",
          pipelineApplied
            ? previewOn
              ? "border-chart-2/50 bg-chart-2/10"
              : "border-border bg-card"
            : "border-border bg-muted/20 opacity-40 pointer-events-none",
        )}>
          <Switch
            id="preview-switch"
            checked={previewOn}
            onCheckedChange={handlePreviewToggle}
            disabled={!pipelineApplied}
          />
          <Label
            htmlFor="preview-switch"
            className={cn(
              "text-xs font-medium cursor-pointer whitespace-nowrap",
              previewOn ? "text-chart-2" : "text-muted-foreground",
            )}
          >
            Ver resultado
          </Label>
        </div>
      </div>

      {/* Export buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={handleDownloadCsv}
          disabled={!pipelineApplied}
          className={cn("w-full gap-2 text-sm", !pipelineApplied && "opacity-40 cursor-not-allowed")}
          title={!pipelineApplied ? "Aplique o pipeline primeiro" : "Baixar CSV processado"}
        >
          <Download className="h-4 w-4" />
          Baixar CSV
        </Button>
        <Button
          variant="outline"
          onClick={handleExportJson}
          className="w-full gap-2 text-sm"
        >
          <FileJson className="h-4 w-4" />
          Exportar JSON
        </Button>
      </div>

      {!jobId && (
        <p className="text-center text-xs text-muted-foreground">
          Upload a CSV file first to enable the pipeline.
        </p>
      )}

      {/* Transformed preview */}
      {previewOn && pipelineApplied && (
        <div className="mt-2">
          {previewLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 rounded-xl border border-border bg-muted/20 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando CSV transformado...
            </div>
          ) : previewData ? (
            <TransformedPreview headers={previewData.headers} rows={previewData.rows} />
          ) : (
            <div className="flex items-center justify-center py-8 rounded-xl border border-border bg-muted/20 text-muted-foreground text-sm">
              Não foi possível carregar o CSV.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
