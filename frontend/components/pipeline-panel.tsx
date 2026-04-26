"use client"

import { useState, useRef, useCallback } from "react"
import {
  ArrowRight, Loader2, CheckCircle2, AlertCircle,
  Download, FileJson, TableProperties, Clock,
} from "lucide-react"
import { PipelineBlockCard } from "@/components/pipeline-block-card"
import { type PipelineBlock, DEFAULT_BLOCKS } from "@/lib/pipeline-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PipelinePanelProps {
  jobId:        string | null
  columns:      string[]
  previewRows?: Record<string, string>[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""
const VISIBLE  = 10

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines   = text.trim().split("\n")
  const headers = lines[0].split(",").map((h) => h.trim())
  const rows    = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()))
  return { headers, rows }
}

// ── Poll /jobs/{id} until finished or failed ──────────────────────────────────
async function pollJobStatus(
  jobId: string,
  onTick: (status: string) => void,
  intervalMs = 800,
  timeoutMs  = 60_000,
): Promise<"finished" | "failed"> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (Date.now() > deadline) { reject(new Error("Timeout aguardando o pipeline.")); return }
      try {
        const res  = await fetch(`${API_BASE}/jobs/${jobId}`)
        const data = await res.json()
        onTick(data.status)
        if (data.status === "finished") { resolve("finished"); return }
        if (data.status === "failed")   { reject(new Error(data.error ?? "Pipeline falhou.")); return }
        setTimeout(check, intervalMs)
      } catch (e) { reject(e) }
    }
    check()
  })
}

// ── Result table ──────────────────────────────────────────────────────────────
function ResultTable({
  headers, rows, loading, status,
}: {
  headers:  string[]
  rows:     string[][]
  loading:  boolean
  status:   string | null
}) {
  const [showAll, setShowAll] = useState(false)
  const visibleRows = showAll ? rows : rows.slice(0, VISIBLE)

  const statusLabel: Record<string, string> = {
    queued:     "Na fila…",
    processing: "Processando…",
    finished:   "Concluído",
    failed:     "Falhou",
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TableProperties className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">CSV Transformado</span>
        </div>
        {headers.length > 0 && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-chart-2/40 text-chart-2 bg-chart-2/10">
            {rows.length} × {headers.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground text-xs">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{status ? (statusLabel[status] ?? status) : "Aguardando…"}</span>
            </div>
          </div>
        ) : headers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground text-xs text-center px-6">
            <TableProperties className="h-8 w-8 opacity-20" />
            <span className="leading-relaxed">
              Aplique o pipeline para ver<br />o CSV transformado aqui.
            </span>
          </div>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20 sticky top-0">
                  <th className="px-2 py-2 text-left font-mono text-muted-foreground w-7">#</th>
                  {headers.map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-mono text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="px-2 py-1.5 text-muted-foreground/40 font-mono tabular-nums">{i + 1}</td>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        title={cell}
                        className={cn(
                          "px-2 py-1.5 font-mono whitespace-nowrap max-w-[140px] truncate",
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

            {rows.length > VISIBLE && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full py-1.5 text-[11px] text-muted-foreground hover:text-foreground border-t border-border bg-muted/10 hover:bg-muted/20 transition-colors"
              >
                {showAll ? "Mostrar menos" : `+${rows.length - VISIBLE} linhas`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function PipelinePanel({ jobId, columns, previewRows = [] }: PipelinePanelProps) {
  const [blocks,     setBlocks]     = useState<PipelineBlock[]>(DEFAULT_BLOCKS)
  const [submitting, setSubmitting] = useState(false)
  const [jobStatus,  setJobStatus]  = useState<string | null>(null)
  const [result,     setResult]     = useState<{ ok: boolean; message: string } | null>(null)
  const [pipelineApplied, setPipelineApplied] = useState(false)
  const [afterLoading, setAfterLoading] = useState(false)
  const [afterData,  setAfterData]  = useState<{ headers: string[]; rows: string[][] } | null>(null)

  const dragIndex      = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((i: number) => { dragIndex.current = i }, [])
  const handleDragEnter = useCallback((i: number) => { setDragOverIndex(i) }, [])
  const handleDragEnd   = useCallback(() => {
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

  const toggleBlock = useCallback((id: string) =>
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, enabled: !b.enabled } : b)), [])

  const updateBlock = useCallback((id: string, config: PipelineBlock["config"]) =>
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, config } as PipelineBlock : b)), [])

  const buildPayload = () => {
    const active  = blocks.filter((b) => b.enabled || b.step === "loader")
    const payload: Record<string, any> = { order: active.map((b) => b.step) }
    for (const b of active) payload[b.step === "loader" ? "loader" : b.step] = { ...b.config }
    return payload
  }

  const fetchAfterCsv = async () => {
    if (!jobId) return
    setAfterLoading(true)
    try {
      const res = await fetch(`${API_BASE}/download_csv/${jobId}`)
      if (!res.ok) throw new Error()
      setAfterData(parseCsv(await res.text()))
    } catch {
      setAfterData(null)
    } finally {
      setAfterLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!jobId) return
    setSubmitting(true)
    setResult(null)
    setAfterData(null)
    setJobStatus(null)

    try {
      // 1. Enqueue job
      const res = await fetch(`${API_BASE}/run_pipeline/${jobId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildPayload()),
      })
      if (!res.ok) throw new Error(`Pipeline failed: ${res.statusText}`)

      // 2. Show loading state in the result table while polling
      setAfterLoading(true)
      setJobStatus("queued")

      // 3. Poll until finished
      await pollJobStatus(jobId, (s) => setJobStatus(s))

      // 4. Download result
      setResult({ ok: true, message: "Pipeline aplicado com sucesso." })
      setPipelineApplied(true)
      await fetchAfterCsv()

    } catch (err: unknown) {
      setAfterLoading(false)
      setResult({ ok: false, message: err instanceof Error ? err.message : "Pipeline request failed." })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadCsv = async () => {
    if (!jobId) return
    try {
      const res  = await fetch(`${API_BASE}/download_csv/${jobId}`)
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `resultado_${jobId.slice(0, 8)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Download falhou." })
    }
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = `pipeline_config_${jobId ? jobId.slice(0, 8) : "draft"}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const enabledSteps = blocks.filter((b) => b.enabled || b.step === "loader")
  const hasData      = previewRows.length > 0

  return (
    <div className={cn("gap-6", hasData ? "grid grid-cols-1 lg:grid-cols-[380px_1fr]" : "block")}>

      {/* ── LEFT: controls ── */}
      <div className="space-y-4 min-w-0">

        {/* Flow summary */}
        <div className="flex items-center gap-1.5 flex-wrap p-3 rounded-lg bg-muted/40 border border-border">
          {enabledSteps.map((b, i) => (
            <div key={b.id} className="flex items-center gap-1.5">
              <span
                className="font-mono text-xs px-2 py-0.5 rounded-full border"
                style={{
                  borderColor:     `var(--block-${b.step})`,
                  color:           `var(--block-${b.step})`,
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

        {/* Blocks */}
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              draggable={block.step !== "loader"}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={cn("transition-all", dragOverIndex === index && dragIndex.current !== index && "opacity-50")}
            >
              <PipelineBlockCard
                block={block}
                columns={columns}
                index={index}
                total={blocks.length}
                dragHandleProps={{ onMouseDown: (e) => { e.currentTarget.parentElement?.setAttribute("draggable", "true") } }}
                isDragging={dragOverIndex === index && dragIndex.current !== index}
                onToggle={toggleBlock}
                onChange={updateBlock}
              />
            </div>
          ))}
        </div>

        {/* Feedback */}
        {result && (
          <div className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
            result.ok
              ? "bg-chart-2/10 border-chart-2/30 text-chart-2"
              : "bg-destructive/10 border-destructive/30 text-destructive-foreground",
          )}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={!jobId || submitting} className="w-full" size="lg">
          {submitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying Pipeline...</>
            : "FAZER ALTERAÇÕES"}
        </Button>

        {/* Export */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadCsv}
            disabled={!pipelineApplied}
            className={cn("gap-2 text-sm", !pipelineApplied && "opacity-40 cursor-not-allowed")}
            title={!pipelineApplied ? "Aplique o pipeline primeiro" : "Baixar CSV processado"}
          >
            <Download className="h-4 w-4" />
            Baixar CSV
          </Button>
          <Button variant="outline" onClick={handleExportJson} className="gap-2 text-sm">
            <FileJson className="h-4 w-4" />
            Exportar JSON
          </Button>
        </div>

        {!jobId && (
          <p className="text-center text-xs text-muted-foreground">
            Upload a CSV file first to enable the pipeline.
          </p>
        )}
      </div>

      {/* ── RIGHT: result table ── */}
      {hasData && (
        <div style={{ minHeight: "420px" }}>
          <ResultTable
            headers={afterData?.headers ?? []}
            rows={afterData?.rows ?? []}
            loading={afterLoading}
            status={jobStatus}
          />
        </div>
      )}
    </div>
  )
}
