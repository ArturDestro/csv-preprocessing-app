"use client"

import { useCallback, useState } from "react"
import { Upload, FileText, X, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface CsvUploaderProps {
  onUploadSuccess: (jobId: string, columns: string[], rows: Record<string, string>[]) => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

export function CsvUploader({ onUploadSuccess }: CsvUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) {
      setError("Only CSV files are supported.")
      return
    }
    setError(null)
    setFile(f)
    setUploaded(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      // Parse CSV client-side for preview
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
      const rows: Record<string, string>[] = lines.slice(1).map((line) => {
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
        return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]))
      })

      // Upload to backend
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
      const data = await res.json()
      const jobId: string = data.job_id
      const columns: string[] = data.columns ?? headers
      setUploaded(true)
      onUploadSuccess(jobId, columns, rows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setUploaded(false)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        role="button"
        aria-label="Upload CSV file"
        tabIndex={0}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/60 hover:bg-muted/40",
          uploaded && "border-chart-2 bg-chart-2/10",
        )}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !file && document.getElementById("csv-file-input")?.click()}
        onKeyDown={(e) => e.key === "Enter" && document.getElementById("csv-file-input")?.click()}
      >
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={handleInputChange}
        />

        {uploaded ? (
          <CheckCircle className="h-10 w-10 text-chart-2" />
        ) : file ? (
          <FileText className="h-10 w-10 text-primary" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}

        {uploaded ? (
          <div className="text-center">
            <p className="font-medium text-chart-2">Upload successful</p>
            <p className="text-sm text-muted-foreground mt-1">{file?.name}</p>
          </div>
        ) : file ? (
          <div className="text-center">
            <p className="font-medium text-foreground">{file.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(file.size / 1024).toFixed(1)} KB — ready to upload
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium text-foreground">Drop a CSV here</p>
            <p className="text-sm text-muted-foreground mt-1">
              or{" "}
              <span className="text-primary underline-offset-2 hover:underline">
                click to browse
              </span>
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive-foreground bg-destructive/20 border border-destructive/40 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {file && !uploaded && (
        <div className="flex items-center gap-2">
          <Button onClick={handleUpload} disabled={uploading} className="flex-1">
            {uploading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Uploading...
              </>
            ) : (
              "Upload CSV"
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={handleClear} aria-label="Clear file">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {uploaded && (
        <Button variant="outline" size="sm" onClick={handleClear} className="self-start">
          Upload a different file
        </Button>
      )}
    </div>
  )
}
