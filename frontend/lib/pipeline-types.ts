// Shared types for the pipeline builder

export type StepType = "loader" | "cleaner" | "typecaster" | "encoder" | "scaler"

export type ScalerMethod = "standard" | "minmax" | "robust" | "constant"
export type CleanerStrategy = "mean" | "median" | "mode"
export type EncoderType = "onehot" | "ordinal" | "label"
export type ColumnType = "int" | "float" | "string" | "bool" | "datetime"

export interface LoaderConfig {
  path: string
  type: "csv"
  separator: string
}

export interface CleanerConfig {
  type: CleanerStrategy
  remove_duplicates: boolean
  columns: string[]
}

export interface TypecasterConfig {
  schema: Record<string, ColumnType>
  columns: string[]
}

export interface EncoderConfig {
  type: EncoderType
  columns: string[]
  ordinal_order?: Record<string, string[]>
}

export interface ScalerConfig {
  type: ScalerMethod
  columns: string[]
}

export type BlockConfig =
  | { step: "loader"; config: LoaderConfig; enabled: boolean }
  | { step: "cleaner"; config: CleanerConfig; enabled: boolean }
  | { step: "typecaster"; config: TypecasterConfig; enabled: boolean }
  | { step: "encoder"; config: EncoderConfig; enabled: boolean }
  | { step: "scaler"; config: ScalerConfig; enabled: boolean }

export type PipelineBlock = BlockConfig & { id: string }

export const DEFAULT_BLOCKS: PipelineBlock[] = [
  {
    id: "loader",
    step: "loader",
    enabled: true,
    config: { path: "", type: "csv", separator: "," },
  },
  {
    id: "cleaner",
    step: "cleaner",
    enabled: false,
    config: { type: "mean", remove_duplicates: true, columns: [] },
  },
  {
    id: "typecaster",
    step: "typecaster",
    enabled: false,
    config: { schema: {}, columns: [] },
  },
  {
    id: "encoder",
    step: "encoder",
    enabled: false,
    config: { type: "onehot", columns: [] },
  },
  {
    id: "scaler",
    step: "scaler",
    enabled: false,
    config: { type: "standard", columns: [] },
  },
]

export const STEP_LABELS: Record<StepType, string> = {
  loader: "Loader",
  cleaner: "Cleaner",
  typecaster: "TypeCaster",
  encoder: "Encoder",
  scaler: "Scaler",
}

export const STEP_DESCRIPTIONS: Record<StepType, string> = {
  loader: "Reads the uploaded CSV file into the pipeline",
  cleaner: "Handles missing values and duplicate rows",
  typecaster: "Casts columns to specific data types",
  encoder: "Encodes categorical columns numerically",
  scaler: "Normalizes or scales numeric columns",
}

export const STEP_COLORS: Record<StepType, string> = {
  loader: "var(--block-loader)",
  cleaner: "var(--block-cleaner)",
  typecaster: "var(--block-typecaster)",
  encoder: "var(--block-encoder)",
  scaler: "var(--block-scaler)",
}
