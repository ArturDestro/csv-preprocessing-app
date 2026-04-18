"use client"

import { useState } from "react"
import { GripVertical, ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import {
  type PipelineBlock,
  type CleanerConfig,
  type TypecasterConfig,
  type EncoderConfig,
  type ScalerConfig,
  type ColumnType,
  STEP_LABELS,
  STEP_DESCRIPTIONS,
  STEP_COLORS,
} from "@/lib/pipeline-types"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface PipelineBlockCardProps {
  block: PipelineBlock
  columns: string[]
  index: number
  total: number
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>
  isDragging: boolean
  onToggle: (id: string) => void
  onChange: (id: string, config: PipelineBlock["config"]) => void
}

export function PipelineBlockCard({
  block,
  columns,
  dragHandleProps,
  isDragging,
  onToggle,
  onChange,
}: PipelineBlockCardProps) {
  const [expanded, setExpanded] = useState(false)
  const color = STEP_COLORS[block.step]
  const isLoader = block.step === "loader"

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-all duration-150",
        isDragging ? "shadow-2xl scale-[1.02] opacity-90 border-primary" : "shadow-sm",
        !block.enabled && !isLoader && "opacity-60",
      )}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className={cn(
            "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors",
            isLoader && "invisible pointer-events-none",
          )}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Color dot */}
        <div
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        />

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground">{STEP_LABELS[block.step]}</p>
          <p className="text-xs text-muted-foreground truncate">{STEP_DESCRIPTIONS[block.step]}</p>
        </div>

        {/* Toggle */}
        {!isLoader && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch
              id={`toggle-${block.id}`}
              checked={block.enabled}
              onCheckedChange={() => onToggle(block.id)}
            />
            <Label htmlFor={`toggle-${block.id}`} className="sr-only">
              Enable {STEP_LABELS[block.step]}
            </Label>
          </div>
        )}

        {/* Expand chevron */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse block settings" : "Expand block settings"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          {block.step === "loader" && (
            <LoaderSettings block={block} onChange={onChange} />
          )}
          {block.step === "cleaner" && (
            <CleanerSettings block={block} columns={columns} onChange={onChange} />
          )}
          {block.step === "typecaster" && (
            <TypecasterSettings block={block} columns={columns} onChange={onChange} />
          )}
          {block.step === "encoder" && (
            <EncoderSettings block={block} columns={columns} onChange={onChange} />
          )}
          {block.step === "scaler" && (
            <ScalerSettings block={block} columns={columns} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  )
}

// ----- Sub-settings components -----

function ColumnMultiSelect({
  label,
  selected,
  all,
  onChange,
}: {
  label: string
  selected: string[]
  all: string[]
  onChange: (cols: string[]) => void
}) {
  const toggle = (col: string) =>
    onChange(selected.includes(col) ? selected.filter((c) => c !== col) : [...selected, col])

  if (all.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Upload a CSV to select columns.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {all.map((col) => (
          <button
            key={col}
            onClick={() => toggle(col)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono border transition-all",
              selected.includes(col)
                ? "bg-primary/20 border-primary/60 text-primary"
                : "bg-muted border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {col}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selected.length} column{selected.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  )
}

function LoaderSettings({ block, onChange }: { block: PipelineBlock & { step: "loader" }; onChange: (id: string, config: PipelineBlock["config"]) => void }) {
  const cfg = block.config
  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Separator</Label>
        <Select
          value={cfg.separator}
          onValueChange={(v) => onChange(block.id, { ...cfg, separator: v })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=",">,  (comma)</SelectItem>
            <SelectItem value=";">; (semicolon)</SelectItem>
            <SelectItem value="\t">\t (tab)</SelectItem>
            <SelectItem value="|">| (pipe)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">File type</Label>
        <Input value="csv" disabled className="h-8 text-sm" />
      </div>
    </div>
  )
}

function CleanerSettings({ block, columns, onChange }: { block: PipelineBlock & { step: "cleaner" }; columns: string[]; onChange: (id: string, config: PipelineBlock["config"]) => void }) {
  const cfg = block.config as CleanerConfig
  return (
    <div className="space-y-4 mt-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Missing value strategy</Label>
        <Select
          value={cfg.type}
          onValueChange={(v) => onChange(block.id, { ...cfg, type: v as CleanerConfig["type"] })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mean">Mean</SelectItem>
            <SelectItem value="median">Median</SelectItem>
            <SelectItem value="mode">Mode</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="remove-dupes"
          checked={cfg.remove_duplicates}
          onCheckedChange={(v) => onChange(block.id, { ...cfg, remove_duplicates: !!v })}
        />
        <Label htmlFor="remove-dupes" className="text-sm cursor-pointer">Remove duplicate rows</Label>
      </div>
      <ColumnMultiSelect
        label="Apply to columns"
        selected={cfg.columns}
        all={columns}
        onChange={(cols) => onChange(block.id, { ...cfg, columns: cols })}
      />
    </div>
  )
}

function TypecasterSettings({ block, columns, onChange }: { block: PipelineBlock & { step: "typecaster" }; columns: string[]; onChange: (id: string, config: PipelineBlock["config"]) => void }) {
  const cfg = block.config as TypecasterConfig
  const schemaEntries = Object.entries(cfg.schema)

  const setType = (col: string, type: ColumnType) => {
    onChange(block.id, { ...cfg, schema: { ...cfg.schema, [col]: type } })
  }
  const removeMapping = (col: string) => {
    const next = { ...cfg.schema }
    delete next[col]
    onChange(block.id, { ...cfg, schema: next })
  }
  const addColumn = (col: string) => {
    if (!cfg.schema[col]) {
      onChange(block.id, { ...cfg, schema: { ...cfg.schema, [col]: "string" } })
    }
  }

  return (
    <div className="space-y-4 mt-3">
      <ColumnMultiSelect
        label="Apply to columns"
        selected={cfg.columns}
        all={columns}
        onChange={(cols) => onChange(block.id, { ...cfg, columns: cols })}
      />
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Column type mappings</p>
        {schemaEntries.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No mappings yet. Add columns below.</p>
        )}
        <div className="space-y-2">
          {schemaEntries.map(([col, type]) => (
            <div key={col} className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs flex-shrink-0">{col}</Badge>
              <Select value={type} onValueChange={(v) => setType(col, v as ColumnType)}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="int">int</SelectItem>
                  <SelectItem value="float">float</SelectItem>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="bool">bool</SelectItem>
                  <SelectItem value="datetime">datetime</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={() => removeMapping(col)} className="text-muted-foreground hover:text-destructive-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        {/* Add column */}
        {columns.filter((c) => !cfg.schema[c]).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {columns.filter((c) => !cfg.schema[c]).map((col) => (
              <button
                key={col}
                onClick={() => addColumn(col)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono border border-dashed border-border text-muted-foreground hover:border-primary/60 hover:text-primary transition-all"
              >
                <Plus className="h-2.5 w-2.5" />
                {col}
              </button>
            ))}
          </div>
        )}
        {columns.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Upload a CSV to see available columns.</p>
        )}
      </div>
    </div>
  )
}

function EncoderSettings({ block, columns, onChange }: { block: PipelineBlock & { step: "encoder" }; columns: string[]; onChange: (id: string, config: PipelineBlock["config"]) => void }) {
  const cfg = block.config as EncoderConfig
  return (
    <div className="space-y-4 mt-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Encoding type</Label>
        <Select
          value={cfg.type}
          onValueChange={(v) => onChange(block.id, { ...cfg, type: v as EncoderConfig["type"] })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onehot">One-Hot</SelectItem>
            <SelectItem value="ordinal">Ordinal</SelectItem>
            <SelectItem value="label">Label</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ColumnMultiSelect
        label="Apply to columns"
        selected={cfg.columns}
        all={columns}
        onChange={(cols) => onChange(block.id, { ...cfg, columns: cols })}
      />
    </div>
  )
}

function ScalerSettings({ block, columns, onChange }: { block: PipelineBlock & { step: "scaler" }; columns: string[]; onChange: (id: string, config: PipelineBlock["config"]) => void }) {
  const cfg = block.config as ScalerConfig
  return (
    <div className="space-y-4 mt-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Scaling method</Label>
        <Select
          value={cfg.type}
          onValueChange={(v) => onChange(block.id, { ...cfg, type: v as ScalerConfig["type"] })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard (Z-score)</SelectItem>
            <SelectItem value="minmax">Min-Max</SelectItem>
            <SelectItem value="robust">Robust</SelectItem>
            <SelectItem value="constant">Constant</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ColumnMultiSelect
        label="Apply to columns"
        selected={cfg.columns}
        all={columns}
        onChange={(cols) => onChange(block.id, { ...cfg, columns: cols })}
      />
    </div>
  )
}
