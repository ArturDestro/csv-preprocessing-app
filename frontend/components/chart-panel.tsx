"use client"

import { useState, useMemo, useCallback } from "react"
import {
  LineChart, Line,
  BarChart, Bar,
  ScatterChart, Scatter,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  BarChart2, TrendingUp, CircleDot, Activity,
  PieChart as PieIcon, AlignLeft, Loader2, AlertCircle,
  Lightbulb, Download, RefreshCw, Hash, ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type ChartType = "line" | "bar" | "scatter" | "area" | "histogram" | "pie"
type ColKind   = "numeric" | "categorical"

interface ChartPanelProps {
  jobId:        string | null
  columns:      string[]
  previewRows?: Record<string, string>[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataPoint = Record<string, any>

interface ChartMeta {
  value:  ChartType
  label:  string
  Icon:   React.ComponentType<{ className?: string }>
  needsY: boolean
  xKind:  ColKind | "any"
  yKind:  ColKind | "any"
  tip:    string
  color:  string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

const PIE_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
]

const TOOLTIP_STYLE = {
  background:   "var(--card)",
  border:       "1px solid var(--border)",
  borderRadius: "8px",
  fontSize:     "12px",
  boxShadow:    "0 4px 12px rgba(0,0,0,0.3)",
}

const CHART_TYPES: ChartMeta[] = [
  {
    value: "line",      label: "Line",      Icon: TrendingUp, color: "var(--chart-1)",
    needsY: true,  xKind: "any",         yKind: "numeric",
    tip: "Evolução ao longo de uma sequência ou tempo",
  },
  {
    value: "bar",       label: "Bar",       Icon: BarChart2,  color: "var(--chart-2)",
    needsY: true,  xKind: "categorical", yKind: "numeric",
    tip: "Comparar valores entre categorias",
  },
  {
    value: "scatter",   label: "Scatter",   Icon: CircleDot,  color: "var(--chart-3)",
    needsY: true,  xKind: "numeric",     yKind: "numeric",
    tip: "Correlação entre duas colunas numéricas",
  },
  {
    value: "area",      label: "Area",      Icon: Activity,   color: "var(--chart-4)",
    needsY: true,  xKind: "any",         yKind: "numeric",
    tip: "Volume acumulado ao longo de uma sequência",
  },
  {
    value: "histogram", label: "Histogram", Icon: AlignLeft,  color: "var(--chart-5)",
    needsY: false, xKind: "numeric",     yKind: "any",
    tip: "Distribuição de frequência de uma coluna numérica",
  },
  {
    value: "pie",       label: "Pie",       Icon: PieIcon,    color: "var(--chart-1)",
    needsY: false, xKind: "categorical", yKind: "any",
    tip: "Proporção de cada categoria",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferColKinds(columns: string[], rows: Record<string, string>[]): Record<string, ColKind> {
  const result: Record<string, ColKind> = {}
  for (const col of columns) {
    const values = rows.map((r) => r[col]).filter(Boolean)
    const numericCount = values.filter((v) => !isNaN(Number(v))).length
    result[col] = numericCount / (values.length || 1) >= 0.8 ? "numeric" : "categorical"
  }
  return result
}

function getSuggestions(meta: ChartMeta, colKinds: Record<string, ColKind>) {
  const numeric     = Object.entries(colKinds).filter(([, k]) => k === "numeric").map(([c]) => c)
  const categorical = Object.entries(colKinds).filter(([, k]) => k === "categorical").map(([c]) => c)
  const bestX =
    meta.xKind === "numeric"     ? numeric[0]     ?? null :
    meta.xKind === "categorical" ? categorical[0] ?? null :
    Object.keys(colKinds)[0]     ?? null
  const bestY = !meta.needsY ? null :
    meta.yKind === "numeric"
      ? numeric.find((c) => c !== bestX) ?? null
      : Object.keys(colKinds).find((c) => c !== bestX) ?? null
  return { x: bestX, y: bestY }
}

function computeStats(data: DataPoint[], yKey: string) {
  const vals = data.map((d) => Number(d[yKey])).filter((v) => !isNaN(v))
  if (!vals.length) return null
  const min  = Math.min(...vals)
  const max  = Math.max(...vals)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  return { min, max, mean, count: vals.length }
}

function downloadCSV(data: DataPoint[], filename: string) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const rows = [keys.join(","), ...data.map((d) => keys.map((k) => d[k]).join(","))]
  const blob = new Blob([rows.join("\n")], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg bg-muted/50 border border-border min-w-[80px]">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

function EmptyState({ jobId }: { jobId: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-dashed border-border bg-muted/20">
      <div className="relative">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
          <BarChart2 className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div className="absolute -right-3 -bottom-2 flex items-end gap-0.5">
          {[3, 5, 4, 6, 2].map((h, i) => (
            <div key={i} className="w-1.5 rounded-sm bg-primary/20" style={{ height: `${h * 4}px` }} />
          ))}
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          {jobId ? "Configure e gere um gráfico" : "Nenhum arquivo carregado"}
        </p>
        <p className="text-xs text-muted-foreground">
          {jobId
            ? "Escolha o tipo, os eixos e clique em Generate Chart"
            : "Faça upload de um CSV primeiro para visualizar os dados"}
        </p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChartPanel({ jobId, columns, previewRows = [] }: ChartPanelProps) {
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [xColumn,   setXColumn]   = useState<string>("")
  const [yColumn,   setYColumn]   = useState<string>("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [chartData, setChartData] = useState<DataPoint[] | null>(null)
  const [renderedType, setRenderedType] = useState<ChartType>("bar")
  const [renderedX,    setRenderedX]    = useState<string>("")
  const [renderedY,    setRenderedY]    = useState<string>("")

  const colKinds    = useMemo(() => inferColKinds(columns, previewRows), [columns, previewRows])
  const currentMeta = CHART_TYPES.find((t) => t.value === chartType)!
  const suggestion  = useMemo(() => getSuggestions(currentMeta, colKinds), [currentMeta, colKinds])

  const xKindMismatch = xColumn && currentMeta.xKind !== "any" && colKinds[xColumn] !== currentMeta.xKind
  const yKindMismatch = yColumn && currentMeta.needsY && currentMeta.yKind !== "any" && colKinds[yColumn] !== currentMeta.yKind

  const handleChartTypeChange = useCallback((type: ChartType) => {
    setChartType(type)
    setChartData(null)
    setError(null)
    const meta = CHART_TYPES.find((t) => t.value === type)!
    const sug  = getSuggestions(meta, colKinds)
    if (sug.x) setXColumn(sug.x)
    setYColumn(sug.y ?? "")
  }, [colKinds])

  const handleGenerate = async () => {
    if (!jobId) return
    setLoading(true)
    setError(null)
    setChartData(null)
    try {
      const res = await fetch(`${API_BASE}/generate_chart`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          type:   chartType,
          x:      xColumn || undefined,
          y:      yColumn || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `Chart generation failed: ${res.statusText}`)
      }
      const data = await res.json()
      const arr  = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : null
      if (!arr) throw new Error("Unexpected response format from chart endpoint.")
      setChartData(arr)
      setRenderedType(chartType)
      setRenderedX(xColumn)
      setRenderedY(yColumn)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Chart generation failed.")
    } finally {
      setLoading(false)
    }
  }

  const xKey = renderedX || (chartData?.[0] ? Object.keys(chartData[0])[0] ?? "" : "")
  const yKey = renderedY || (chartData?.[0] ? Object.keys(chartData[0]).find((k) => k !== xKey) ?? "" : "")
  const stats = chartData && yKey ? computeStats(chartData, yKey) : null
  const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" }

  return (
    <div className="space-y-5">

      {/* ── Chart type grid ── */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest">
          Tipo de gráfico
        </Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CHART_TYPES.map(({ value, label, Icon, tip, color }) => {
            const active = chartType === value
            return (
              <button
                key={value}
                onClick={() => handleChartTypeChange(value)}
                title={tip}
                aria-pressed={active}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-1 rounded-xl py-3 px-2 border text-xs font-medium transition-all duration-150",
                  active
                    ? "border-primary/60 bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                )}
                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", active && "scale-110")} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground/70 italic pl-0.5">{currentMeta.tip}</p>
      </div>

      {/* ── Axis selectors ── */}
      <div className={cn(
        "grid gap-3 p-4 rounded-xl bg-muted/30 border border-border",
        currentMeta.needsY ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
            <Hash className="h-3 w-3" />
            {currentMeta.needsY ? "Eixo X" : "Coluna"}
          </Label>
          <Select value={xColumn || "__auto__"} onValueChange={(v) => setXColumn(v === "__auto__" ? "" : v)}>
            <SelectTrigger className={cn("h-9 text-sm bg-card", xKindMismatch && "border-yellow-500/70")}>
              <SelectValue placeholder="Automático" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__"><span className="text-muted-foreground">Automático</span></SelectItem>
              {columns.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    {c}
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      colKinds[c] === "numeric" ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400",
                    )}>
                      {colKinds[c] ?? "?"}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {xKindMismatch && (
            <p className="text-[11px] text-yellow-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Funciona melhor com coluna <strong>{currentMeta.xKind}</strong>
            </p>
          )}
        </div>

        {currentMeta.needsY && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
              <ArrowUpDown className="h-3 w-3" />
              Eixo Y
            </Label>
            <Select value={yColumn || "__auto__"} onValueChange={(v) => setYColumn(v === "__auto__" ? "" : v)}>
              <SelectTrigger className={cn("h-9 text-sm bg-card", yKindMismatch && "border-yellow-500/70")}>
                <SelectValue placeholder="Automático" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__"><span className="text-muted-foreground">Automático</span></SelectItem>
                {columns.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      {c}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        colKinds[c] === "numeric" ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400",
                      )}>
                        {colKinds[c] ?? "?"}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {yKindMismatch && (
              <p className="text-[11px] text-yellow-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Funciona melhor com coluna <strong>{currentMeta.yKind}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Suggestion ── */}
      {(suggestion.x || suggestion.y) && !chartData && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <span>
            Sugestão para <strong className="text-foreground">{currentMeta.label}</strong>:{" "}
            X = <code className="text-primary bg-primary/10 px-1 rounded">{suggestion.x ?? "—"}</code>
            {currentMeta.needsY && suggestion.y && (
              <> / Y = <code className="text-primary bg-primary/10 px-1 rounded">{suggestion.y}</code></>
            )}
          </span>
        </div>
      )}

      {/* ── Generate button ── */}
      <Button onClick={handleGenerate} disabled={!jobId || loading} className="w-full" size="lg">
        {loading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando gráfico...</>
        ) : chartData ? (
          <><RefreshCw className="mr-2 h-4 w-4" />Regerar gráfico</>
        ) : (
          "Generate Chart"
        )}
      </Button>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm border bg-destructive/10 border-destructive/30 text-destructive-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!chartData && !loading && !error && <EmptyState jobId={jobId} />}

      {/* ── Chart ── */}
      {chartData && chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {renderedX && renderedY ? `${renderedY} × ${renderedX}` : renderedX || "Gráfico"}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {renderedType.toUpperCase()} — {chartData.length} pontos
              </p>
            </div>
            <button
              onClick={() => downloadCSV(chartData, `chart_${renderedType}_${renderedX}.csv`)}
              title="Baixar dados como CSV"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>

          {/* Chart body */}
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={320}>
              {renderedType === "line" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Line type="monotone" dataKey={yKey} stroke="var(--chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "var(--chart-1)" }} />
                </LineChart>

              ) : renderedType === "bar" ? (
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar dataKey={yKey} fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>

              ) : renderedType === "scatter" ? (
                <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey={xKey} type="number" name={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis dataKey={yKey} type="number" name={yKey} tick={axisStyle} axisLine={false} tickLine={false} width={45} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={TOOLTIP_STYLE} />
                  <Scatter data={chartData} fill="var(--chart-3)" fillOpacity={0.8} />
                </ScatterChart>

              ) : renderedType === "area" ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--chart-4)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Area type="monotone" dataKey={yKey} stroke="var(--chart-4)" fill="url(#areaGrad)" strokeWidth={2.5} />
                </AreaChart>

              ) : renderedType === "histogram" ? (
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="bin" tick={{ ...axisStyle, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={35} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="count" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
                </BarChart>

              ) : (
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={40}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} · ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Stats strip */}
          {stats && renderedType !== "pie" && renderedType !== "histogram" && (
            <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-border bg-muted/20 flex-wrap">
              <StatBadge label="mín"   value={stats.min.toLocaleString("pt-BR",  { maximumFractionDigits: 2 })} />
              <StatBadge label="máx"   value={stats.max.toLocaleString("pt-BR",  { maximumFractionDigits: 2 })} />
              <StatBadge label="média" value={stats.mean.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
              <StatBadge label="pts"   value={String(stats.count)} />
            </div>
          )}
        </div>
      )}

      {chartData && chartData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 rounded-xl border border-dashed border-border">
          <BarChart2 className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum dado retornado pelo endpoint.</p>
        </div>
      )}
    </div>
  )
}
