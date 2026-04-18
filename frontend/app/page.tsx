"use client"

import { useState } from "react"
import { Database, BarChart2, CheckCircle } from "lucide-react"
import { CsvUploader } from "@/components/csv-uploader"
import { CsvPreview } from "@/components/csv-preview"
import { PipelinePanel } from "@/components/pipeline-panel"
import { ChartPanel } from "@/components/chart-panel"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type Tab = "pipeline" | "charts"

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("pipeline")
  const [jobId, setJobId] = useState<string | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  const handleUploadSuccess = (id: string, cols: string[], rows: Record<string, string>[]) => {
    setJobId(id)
    setColumns(cols)
    setPreviewRows(rows)
    setSelectedColumns(cols) // select all by default
  }

  const activeColumns = selectedColumns.length > 0 ? selectedColumns : columns

  const tabs: { value: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "pipeline", label: "Pipeline", Icon: Database },
    { value: "charts", label: "Charts", Icon: BarChart2 },
  ]

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Database className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-mono text-sm font-semibold text-foreground tracking-tight">
            CSV Preprocessor
          </span>
        </div>

        {jobId && (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-chart-2" />
            <span className="font-mono text-xs text-muted-foreground">
              job_id:{" "}
              <span className="text-chart-2">{jobId.slice(0, 8)}…</span>
            </span>
            <Badge variant="secondary" className="font-mono text-xs">
              {selectedColumns.length}/{columns.length} col{columns.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Upload section */}
        <section aria-label="File upload">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            1. Upload CSV
          </h2>
          <CsvUploader onUploadSuccess={handleUploadSuccess} />
        </section>

        {/* Preview section — shown once a file is uploaded */}
        {columns.length > 0 && previewRows.length > 0 && (
          <section aria-label="CSV preview and column selection">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              2. Preview &amp; Select Columns
            </h2>
            <CsvPreview
              columns={columns}
              rows={previewRows}
              selectedColumns={selectedColumns}
              onSelectedColumnsChange={setSelectedColumns}
            />
          </section>
        )}

        {/* Tabs */}
        <section aria-label="Pipeline and charts" className="space-y-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            {columns.length > 0 ? "3." : "2."} Transform &amp; Visualize
          </h2>

          {/* Tab switcher */}
          <div
            role="tablist"
            aria-label="Workspace tabs"
            className="flex gap-1 p-1 rounded-lg bg-muted/60 border border-border"
          >
            {tabs.map(({ value, label, Icon }) => (
              <button
                key={value}
                role="tab"
                aria-selected={activeTab === value}
                aria-controls={`tabpanel-${value}`}
                id={`tab-${value}`}
                onClick={() => setActiveTab(value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all",
                  activeTab === value
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div
            id="tabpanel-pipeline"
            role="tabpanel"
            aria-labelledby="tab-pipeline"
            hidden={activeTab !== "pipeline"}
          >
            {activeTab === "pipeline" && (
              <PipelinePanel jobId={jobId} columns={activeColumns} />
            )}
          </div>

          <div
            id="tabpanel-charts"
            role="tabpanel"
            aria-labelledby="tab-charts"
            hidden={activeTab !== "charts"}
          >
            {activeTab === "charts" && (
              <ChartPanel jobId={jobId} columns={activeColumns} previewRows={previewRows} />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
