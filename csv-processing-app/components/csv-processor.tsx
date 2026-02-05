"use client"

import React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

type JobStatus = "idle" | "uploading" | "queued" | "processing" | "finished" | "failed"

type CleanerType = "mean" | "median" | "mode"
type EncoderType = "onehot" | "label" | "ordinal"
type ScalerType = "standard" | "minmax" | "robust"

interface PipelineConfig {
  cleaner: CleanerType
  encoder: EncoderType
  scaler: ScalerType
  ordinalMapping: string
}

export function CsvProcessor() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<JobStatus>("idle")
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [config, setConfig] = useState<PipelineConfig>({
    cleaner: "mean",
    encoder: "onehot",
    scaler: "standard",
    ordinalMapping: '{\n  "column_name": ["low", "medium", "high"]\n}',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv"))) {
      setFile(selectedFile)
      setStatus("idle")
      setJobId(null)
      setErrorMessage(null)
    } else if (selectedFile) {
      setErrorMessage("Please select a valid CSV file")
    }
  }

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
      setStatus("error")
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
      
      // Build config object for the backend
      const pipelineConfig = {
        order: ["loader", "cleaner", "encoder", "scaler"],

        loader: {
          type: "csv",
          separator: ","
        },

        cleaner: {
          type: config.cleaner,
          columns: null
        },

        encoder: {
          type: config.encoder,
          ...(config.encoder === "ordinal" && {
            mapping: JSON.parse(config.ordinalMapping)
          }),
          columns: null
        },

        scaler: {
          type: config.scaler,
          columns: null
        }
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

      // Start polling every 2 seconds
      pollingRef.current = setInterval(() => {
        pollJobStatus(data.job_id)
      }, 2000)
    } catch {
      setStatus("error")
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
    setStatus("idle")
    setJobId(null)
    setErrorMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

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

  const isProcessing = status === "uploading" || status === "queued" || status === "processing"

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CSV Preprocessing Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="csv-file">Upload CSV File</Label>
          <div
            className="border-2 border-dashed border-input rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
          </div>
        </div>

        {/* Missing Values Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Missing Values (Cleaners)</Label>
          <RadioGroup
            value={config.cleaner}
            onValueChange={(value: CleanerType) => setConfig({ ...config, cleaner: value })}
            disabled={isProcessing}
            className="gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="mean" id="cleaner-mean" />
              <Label htmlFor="cleaner-mean" className="text-sm font-normal cursor-pointer">
                Mean imputation (numeric columns)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="median" id="cleaner-median" />
              <Label htmlFor="cleaner-median" className="text-sm font-normal cursor-pointer">
                Median imputation (numeric columns)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="mode" id="cleaner-mode" />
              <Label htmlFor="cleaner-mode" className="text-sm font-normal cursor-pointer">
                Mode imputation (categorical columns)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Encoding Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Encoding (Categorical Features)</Label>
          <RadioGroup
            value={config.encoder}
            onValueChange={(value: EncoderType) => setConfig({ ...config, encoder: value })}
            disabled={isProcessing}
            className="gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="onehot" id="encoder-onehot" />
              <Label htmlFor="encoder-onehot" className="text-sm font-normal cursor-pointer">
                One-Hot Encoding
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="label" id="encoder-label" />
              <Label htmlFor="encoder-label" className="text-sm font-normal cursor-pointer">
                Label Encoding
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ordinal" id="encoder-ordinal" />
              <Label htmlFor="encoder-ordinal" className="text-sm font-normal cursor-pointer">
                Ordinal Encoding
              </Label>
            </div>
          </RadioGroup>
          
          {config.encoder === "ordinal" && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="ordinal-mapping" className="text-xs text-muted-foreground">
                Ordinal Mapping (JSON format)
              </Label>
              <Textarea
                id="ordinal-mapping"
                value={config.ordinalMapping}
                onChange={(e) => setConfig({ ...config, ordinalMapping: e.target.value })}
                disabled={isProcessing}
                className="font-mono text-xs h-24"
                placeholder='{"column_name": ["low", "medium", "high"]}'
              />
            </div>
          )}
        </div>

        {/* Scaling Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Scaling (Numeric Features)</Label>
          <RadioGroup
            value={config.scaler}
            onValueChange={(value: ScalerType) => setConfig({ ...config, scaler: value })}
            disabled={isProcessing}
            className="gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="standard" id="scaler-standard" />
              <Label htmlFor="scaler-standard" className="text-sm font-normal cursor-pointer">
                Standard Scaler
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="minmax" id="scaler-minmax" />
              <Label htmlFor="scaler-minmax" className="text-sm font-normal cursor-pointer">
                Min-Max Scaler
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="robust" id="scaler-robust" />
              <Label htmlFor="scaler-robust" className="text-sm font-normal cursor-pointer">
                Robust Scaler
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Status Display */}
        {status !== "idle" && (
          <div className="p-3 bg-muted rounded-lg">
            {getStatusDisplay()}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleProcess}
            disabled={!file || isProcessing}
            className="flex-1"
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
          
          {status === "finished" && (
            <Button onClick={handleDownload} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
          
          {(status === "finished" || status === "failed") && (
            <Button onClick={resetForm} variant="ghost">
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
