"use client"

import React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CsvPreview } from "@/components/csv-preview"
import { ColumnSelector } from "@/components/column-selector"
import { PipelineStep } from "@/components/pipeline-step"

type JobStatus = "idle" | "uploading" | "queued" | "processing" | "finished" | "failed"

type CleanerType = "mean" | "median" | "mode" | "constant"
type EncoderType = "onehot" | "label" | "ordinal"
type ScalerType = "standard" | "minmax" | "robust"
type CastType = "int" | "float" | "bool" | "str"

type StepId = "cleaner" | "encoder" | "scaler" | "typecaster"

interface ParsedCsv {
  headers: string[]
  rows: string[][]
  totalRows: number
}

const STEP_LABELS: Record<StepId, string> = {
  cleaner: "Cleaner (Missing Values)",
  typecaster: "TypeCaster (Column Types)",
  encoder: "Encoder (Categorical Features)",
  scaler: "Scaler (Numeric Features)",
}

export function CsvProcessor() {
  const [file, setFile] = useState<File | null>(null)
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null)
  const [status, setStatus] = useState<JobStatus>("idle")
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Pipeline order
  const [stepOrder, setStepOrder] = useState<StepId[]>([
    "cleaner",
    "typecaster",
    "encoder",
    "scaler",
  ])

  // Cleaner config
  const [cleaner, setCleaner] = useState<CleanerType>("mean")
  const [cleanerRemoveDuplicates, setCleanerRemoveDuplicates] = useState(false)
  const [cleanerConstantValue, setCleanerConstantValue] = useState("")
  const [cleanerColumns, setCleanerColumns] = useState<string[]>([])

  // TypeCaster config
  const [typecasterSchema, setTypecasterSchema] = useState<Record<string, CastType>>({})

  // Encoder config
  const [encoder, setEncoder] = useState<EncoderType>("onehot")
  const [ordinalMapping, setOrdinalMapping] = useState(
    '{\n  "column_name": {\n    "low": 0,\n    "medium": 1,\n    "high": 2\n  }\n}'
  )
  const [encoderColumns, setEncoderColumns] = useState<string[]>([])

  // Scaler config
  const [scaler, setScaler] = useState<ScalerType>("standard")
  const [scalerColumns, setScalerColumns] = useState<string[]>([])

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const parseCsvFile = useCallback((csvFile: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return

      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")
      if (lines.length === 0) return

      const parseRow = (line: string): string[] => {
        const result: string[] = []
        let current = ""
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === "," && !inQuotes) {
            result.push(current.trim())
            current = ""
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }

      const headers = parseRow(lines[0])
      const totalRows = lines.length - 1
      const previewRows = lines.slice(1, 21).map(parseRow)

      setParsedCsv({ headers, rows: previewRows, totalRows })
      setCleanerColumns([...headers])
      setEncoderColumns([...headers])
      setScalerColumns([...headers])
      // Initialize typecaster schema with "str" for all columns
      const initialSchema: Record<string, CastType> = {}
      for (const h of headers) {
        initialSchema[h] = "str"
      }
      setTypecasterSchema(initialSchema)
    }
    reader.readAsText(csvFile)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (
      selectedFile &&
      (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv"))
    ) {
      setFile(selectedFile)
      setStatus("idle")
      setJobId(null)
      setErrorMessage(null)
      parseCsvFile(selectedFile)
    } else if (selectedFile) {
      setErrorMessage("Please select a valid CSV file")
    }
  }

  const removeFile = () => {
    setFile(null)
    setParsedCsv(null)
    setCleanerColumns([])
    setEncoderColumns([])
    setScalerColumns([])
    setTypecasterSchema({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (
        droppedFile &&
        (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv"))
      ) {
        setFile(droppedFile)
        setStatus("idle")
        setJobId(null)
        setErrorMessage(null)
        parseCsvFile(droppedFile)
      } else {
        setErrorMessage("Please drop a valid CSV file")
      }
    },
    [parseCsvFile]
  )

  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/${id}`)
      if (!response.ok) throw new Error("Failed to fetch job status")

      const data = await response.json()
      setStatus(data.status)

      if (data.status === "finished" || data.status === "failed") {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        if (data.status === "failed") {
          setErrorMessage(data.error || "Processing failed")
        }
      }
    } catch {
      setStatus("failed")
      setErrorMessage("Failed to check job status")
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  const handleProcess = async () => {
    if (!file) return

    setStatus("uploading")
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      // Build cleaner config
      const cleanerConfig: Record<string, unknown> = {
        type: cleaner,
        remove_duplicates: cleanerRemoveDuplicates,
        columns:
          cleanerColumns.length === parsedCsv?.headers.length ? null : cleanerColumns,
      }
      if (cleaner === "constant") {
        cleanerConfig.value = cleanerConstantValue
      }

      // Build typecaster config - only include columns that aren't "str" (the default)
      const filteredSchema: Record<string, string> = {}
      for (const [col, type] of Object.entries(typecasterSchema)) {
        if (type !== "str") {
          filteredSchema[col] = type
        }
      }

      const pipelineConfig: Record<string, unknown> = {
        order: ["loader", ...stepOrder],
        loader: {
          type: "csv",
          separator: ",",
        },
        cleaner: cleanerConfig,
        typecaster: {
          schema: Object.keys(filteredSchema).length > 0 ? filteredSchema : typecasterSchema,
        },
        encoder: {
          type: encoder,
          ...(encoder === "ordinal" && {
            mapping: JSON.parse(ordinalMapping),
          }),
          columns:
            encoderColumns.length === parsedCsv?.headers.length ? null : encoderColumns,
        },
        scaler: {
          type: scaler,
          columns:
            scalerColumns.length === parsedCsv?.headers.length ? null : scalerColumns,
        },
      }
      formData.append("config", JSON.stringify(pipelineConfig))

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Upload failed")

      const data = await response.json()
      setJobId(data.job_id)
      setStatus("queued")

      pollingRef.current = setInterval(() => {
        pollJobStatus(data.job_id)
      }, 2000)
    } catch {
      setStatus("failed")
      setErrorMessage("Failed to upload file")
    }
  }

  const handleDownload = () => {
    if (jobId) {
      window.location.href = `/api/jobs/${jobId}/download`
    }
  }

  const resetForm = () => {
    setFile(null)
    setParsedCsv(null)
    setStatus("idle")
    setJobId(null)
    setErrorMessage(null)
    setCleanerColumns([])
    setEncoderColumns([])
    setScalerColumns([])
    setTypecasterSchema({})
    setCleaner("mean")
    setCleanerRemoveDuplicates(false)
    setCleanerConstantValue("")
    setStepOrder(["cleaner", "typecaster", "encoder", "scaler"])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Drag handlers for pipeline reordering
  const handleStepDragStart = (id: string) => {
    setDraggedId(id)
  }

  const handleStepDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setOverId(id)
  }

  const handleStepDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedId || !overId || draggedId === overId) {
      setDraggedId(null)
      setOverId(null)
      return
    }

    setStepOrder((prev) => {
      const fromIndex = prev.indexOf(draggedId as StepId)
      const toIndex = prev.indexOf(overId as StepId)
      if (fromIndex === -1 || toIndex === -1) return prev

      const next = [...prev]
      next.splice(fromIndex, 1)
      next.splice(toIndex, 0, draggedId as StepId)
      return next
    })

    setDraggedId(null)
    setOverId(null)
  }

  const handleStepDragEnd = () => {
    setDraggedId(null)
    setOverId(null)
  }

  const updateColumnType = (column: string, type: CastType) => {
    setTypecasterSchema((prev) => ({ ...prev, [column]: type }))
  }

  const isProcessing =
    status === "uploading" || status === "queued" || status === "processing"

  const getStatusDisplay = () => {
    switch (status) {
      case "idle":
        return null
      case "uploading":
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading file...</span>
          </div>
        )
      case "queued":
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Job queued, waiting to process...</span>
          </div>
        )
      case "processing":
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing CSV...</span>
          </div>
        )
      case "finished":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Processing complete!</span>
          </div>
        )
      case "failed":
        return (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage || "An error occurred"}</span>
          </div>
        )
    }
  }

  const renderStepContent = (stepId: StepId) => {
    switch (stepId) {
      case "cleaner":
        return (
          <>
            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                id="cleaner-remove-duplicates"
                checked={cleanerRemoveDuplicates}
                onCheckedChange={(checked) =>
                  setCleanerRemoveDuplicates(checked === true)
                }
                disabled={isProcessing}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="cleaner-remove-duplicates"
                className="text-sm font-normal cursor-pointer"
              >
                Remove duplicate rows
              </Label>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Missing value strategy
              </Label>
              <RadioGroup
                value={cleaner}
                onValueChange={(v: string) => setCleaner(v as CleanerType)}
                disabled={isProcessing}
                className="flex flex-wrap gap-x-6 gap-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="mean" id="cleaner-mean" />
                  <Label
                    htmlFor="cleaner-mean"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Mean
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="median" id="cleaner-median" />
                  <Label
                    htmlFor="cleaner-median"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Median
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="mode" id="cleaner-mode" />
                  <Label
                    htmlFor="cleaner-mode"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Mode
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="constant" id="cleaner-constant" />
                  <Label
                    htmlFor="cleaner-constant"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Constant
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {cleaner === "constant" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="constant-value"
                  className="text-xs text-muted-foreground"
                >
                  Fill value
                </Label>
                <Input
                  id="constant-value"
                  value={cleanerConstantValue}
                  onChange={(e) => setCleanerConstantValue(e.target.value)}
                  disabled={isProcessing}
                  placeholder='e.g. "unknown", 0, N/A'
                  className="h-8 text-sm"
                />
              </div>
            )}

            <ColumnSelector
              label="Apply to columns"
              description="Select which columns to clean"
              columns={parsedCsv?.headers ?? []}
              selected={cleanerColumns}
              onChange={setCleanerColumns}
              disabled={isProcessing}
            />
          </>
        )

      case "typecaster":
        return (
          <>
            <p className="text-xs text-muted-foreground">
              Set the target type for each column. Columns left as{" "}
              <span className="font-mono">str</span> will not be cast.
            </p>
            {parsedCsv && parsedCsv.headers.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-md border p-2">
                <div className="space-y-2">
                  {parsedCsv.headers.map((col) => (
                    <div key={col} className="flex items-center justify-between gap-4">
                      <Label className="text-sm font-mono truncate flex-1 min-w-0">
                        {col}
                      </Label>
                      <Select
                        value={typecasterSchema[col] ?? "str"}
                        onValueChange={(v) => updateColumnType(col, v as CastType)}
                        disabled={isProcessing}
                      >
                        <SelectTrigger className="w-24 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="str">str</SelectItem>
                          <SelectItem value="int">int</SelectItem>
                          <SelectItem value="float">float</SelectItem>
                          <SelectItem value="bool">bool</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                Upload a CSV to see available columns
              </p>
            )}
          </>
        )

      case "encoder":
        return (
          <>
            <RadioGroup
              value={encoder}
              onValueChange={(v: string) => setEncoder(v as EncoderType)}
              disabled={isProcessing}
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="onehot" id="encoder-onehot" />
                <Label
                  htmlFor="encoder-onehot"
                  className="text-sm font-normal cursor-pointer"
                >
                  One-Hot
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="label" id="encoder-label" />
                <Label
                  htmlFor="encoder-label"
                  className="text-sm font-normal cursor-pointer"
                >
                  Label
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ordinal" id="encoder-ordinal" />
                <Label
                  htmlFor="encoder-ordinal"
                  className="text-sm font-normal cursor-pointer"
                >
                  Ordinal
                </Label>
              </div>
            </RadioGroup>

            {encoder === "ordinal" && (
              <div className="space-y-2">
                <Label
                  htmlFor="ordinal-mapping"
                  className="text-xs text-muted-foreground"
                >
                  Ordinal Mapping (JSON)
                </Label>
                <Textarea
                  id="ordinal-mapping"
                  value={ordinalMapping}
                  onChange={(e) => setOrdinalMapping(e.target.value)}
                  disabled={isProcessing}
                  className="font-mono text-xs h-24"
                  placeholder='{"column": {"low": 0, "medium": 1, "high": 2}}'
                />
              </div>
            )}

            <ColumnSelector
              label="Apply to columns"
              description="Select which columns to encode"
              columns={parsedCsv?.headers ?? []}
              selected={encoderColumns}
              onChange={setEncoderColumns}
              disabled={isProcessing}
            />
          </>
        )

      case "scaler":
        return (
          <>
            <RadioGroup
              value={scaler}
              onValueChange={(v: string) => setScaler(v as ScalerType)}
              disabled={isProcessing}
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="standard" id="scaler-standard" />
                <Label
                  htmlFor="scaler-standard"
                  className="text-sm font-normal cursor-pointer"
                >
                  Standard
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="minmax" id="scaler-minmax" />
                <Label
                  htmlFor="scaler-minmax"
                  className="text-sm font-normal cursor-pointer"
                >
                  Min-Max
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="robust" id="scaler-robust" />
                <Label
                  htmlFor="scaler-robust"
                  className="text-sm font-normal cursor-pointer"
                >
                  Robust
                </Label>
              </div>
            </RadioGroup>
            <ColumnSelector
              label="Apply to columns"
              description="Select which columns to scale"
              columns={parsedCsv?.headers ?? []}
              selected={scalerColumns}
              onChange={setScalerColumns}
              disabled={isProcessing}
            />
          </>
        )
    }
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6" />
          CSV Preprocessing Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV file, preview the data, select columns, and configure
          the processing pipeline.
        </p>
      </div>

      {/* File Upload */}
      <Card>
        <CardContent className="pt-6">
          {!file ? (
            <div
              className="border-2 border-dashed border-input rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onKeyDown={(e) =>
                e.key === "Enter" && fileInputRef.current?.click()
              }
              role="button"
              tabIndex={0}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={isProcessing}
              />
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV files only
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              {!isProcessing && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </Button>
              )}
            </div>
          )}

          {errorMessage && status === "idle" && (
            <p className="text-xs text-destructive mt-2">{errorMessage}</p>
          )}
        </CardContent>
      </Card>

      {/* CSV Preview */}
      {parsedCsv && (
        <Card>
          <CardContent className="pt-6">
            <CsvPreview
              headers={parsedCsv.headers}
              rows={parsedCsv.rows}
              totalRows={parsedCsv.totalRows}
            />
          </CardContent>
        </Card>
      )}

      {/* Pipeline Configuration */}
      {parsedCsv && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Pipeline Configuration
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Drag steps to reorder the pipeline
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stepOrder.map((stepId, index) => (
              <PipelineStep
                key={stepId}
                id={stepId}
                index={index}
                total={stepOrder.length}
                label={STEP_LABELS[stepId]}
                disabled={isProcessing}
                draggedId={draggedId}
                overId={overId}
                onDragStart={handleStepDragStart}
                onDragOver={handleStepDragOver}
                onDragEnd={handleStepDragEnd}
                onDrop={handleStepDrop}
              >
                {renderStepContent(stepId)}
              </PipelineStep>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Status & Actions */}
      {parsedCsv && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>{getStatusDisplay()}</div>
              <div className="flex gap-2">
                {(status === "finished" || status === "failed") && (
                  <Button onClick={resetForm} variant="ghost" size="sm">
                    Reset
                  </Button>
                )}
                {status === "finished" && (
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
                <Button
                  onClick={handleProcess}
                  disabled={!file || isProcessing}
                  size="sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Process CSV"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
