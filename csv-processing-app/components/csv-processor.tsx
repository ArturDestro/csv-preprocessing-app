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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { CsvPreview } from "@/components/csv-preview"
import { ColumnSelector } from "@/components/column-selector"
import { PipelineStep } from "@/components/pipeline-step"

type JobStatus = "idle" | "uploading" | "queued" | "processing" | "finished" | "failed"

type CleanerType = "mean" | "median" | "mode"
type EncoderType = "onehot" | "label" | "ordinal"
type ScalerType = "standard" | "minmax" | "robust"

type StepId = "cleaner" | "encoder" | "scaler"

interface ParsedCsv {
  headers: string[]
  rows: string[][]
  totalRows: number
}

const STEP_LABELS: Record<StepId, string> = {
  cleaner: "Missing Values (Cleaner)",
  encoder: "Encoding (Categorical Features)",
  scaler: "Scaling (Numeric Features)",
}

export function CsvProcessor() {
  const [file, setFile] = useState<File | null>(null)
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null)
  const [status, setStatus] = useState<JobStatus>("idle")
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Pipeline order
  const [stepOrder, setStepOrder] = useState<StepId[]>(["cleaner", "encoder", "scaler"])

  // Pipeline config
  const [cleaner, setCleaner] = useState<CleanerType>("mean")
  const [encoder, setEncoder] = useState<EncoderType>("onehot")
  const [scaler, setScaler] = useState<ScalerType>("standard")
  const [ordinalMapping, setOrdinalMapping] = useState(
    '{\n  "column_name": ["low", "medium", "high"]\n}'
  )

  // Column selections
  const [cleanerColumns, setCleanerColumns] = useState<string[]>([])
  const [encoderColumns, setEncoderColumns] = useState<string[]>([])
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

      const pipelineConfig = {
        order: ["loader", ...stepOrder],
        loader: {
          type: "csv",
          separator: ",",
        },
        cleaner: {
          type: cleaner,
          columns: cleanerColumns.length === parsedCsv?.headers.length ? null : cleanerColumns,
        },
        encoder: {
          type: encoder,
          ...(encoder === "ordinal" && {
            mapping: JSON.parse(ordinalMapping),
          }),
          columns: encoderColumns.length === parsedCsv?.headers.length ? null : encoderColumns,
        },
        scaler: {
          type: scaler,
          columns: scalerColumns.length === parsedCsv?.headers.length ? null : scalerColumns,
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
    setStepOrder(["cleaner", "encoder", "scaler"])
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
            <RadioGroup
              value={cleaner}
              onValueChange={(v: string) => setCleaner(v as CleanerType)}
              disabled={isProcessing}
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mean" id="cleaner-mean" />
                <Label htmlFor="cleaner-mean" className="text-sm font-normal cursor-pointer">
                  Mean
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="median" id="cleaner-median" />
                <Label htmlFor="cleaner-median" className="text-sm font-normal cursor-pointer">
                  Median
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mode" id="cleaner-mode" />
                <Label htmlFor="cleaner-mode" className="text-sm font-normal cursor-pointer">
                  Mode
                </Label>
              </div>
            </RadioGroup>
            <ColumnSelector
              label="Apply to columns"
              description="Select which columns to apply missing value imputation"
              columns={parsedCsv?.headers ?? []}
              selected={cleanerColumns}
              onChange={setCleanerColumns}
              disabled={isProcessing}
            />
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
                <Label htmlFor="encoder-onehot" className="text-sm font-normal cursor-pointer">
                  One-Hot
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="label" id="encoder-label" />
                <Label htmlFor="encoder-label" className="text-sm font-normal cursor-pointer">
                  Label
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ordinal" id="encoder-ordinal" />
                <Label htmlFor="encoder-ordinal" className="text-sm font-normal cursor-pointer">
                  Ordinal
                </Label>
              </div>
            </RadioGroup>

            {encoder === "ordinal" && (
              <div className="space-y-2">
                <Label htmlFor="ordinal-mapping" className="text-xs text-muted-foreground">
                  Ordinal Mapping (JSON)
                </Label>
                <Textarea
                  id="ordinal-mapping"
                  value={ordinalMapping}
                  onChange={(e) => setOrdinalMapping(e.target.value)}
                  disabled={isProcessing}
                  className="font-mono text-xs h-24"
                  placeholder='{"column_name": ["low", "medium", "high"]}'
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
                <Label htmlFor="scaler-standard" className="text-sm font-normal cursor-pointer">
                  Standard
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="minmax" id="scaler-minmax" />
                <Label htmlFor="scaler-minmax" className="text-sm font-normal cursor-pointer">
                  Min-Max
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="robust" id="scaler-robust" />
                <Label htmlFor="scaler-robust" className="text-sm font-normal cursor-pointer">
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
          Upload a CSV file, preview the data, select columns, and configure the processing pipeline.
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
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
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
              <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              {!isProcessing && (
                <Button variant="ghost" size="icon" onClick={removeFile} className="h-8 w-8">
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
              <CardTitle className="text-base">Pipeline Configuration</CardTitle>
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
                  <Button onClick={handleDownload} variant="outline" size="sm">
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
