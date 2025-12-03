import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'

export type AIProviderConfig = {
  baseUrl: string
  model: string
  apiKey: string | null
  temperature: number
}

const ensureDir = async (filePath: string) => {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
}

const readConfigFile = async (): Promise<Partial<AIProviderConfig>> => {
  try {
    const raw = await fs.readFile(config.ai.configPath, 'utf8')
    return JSON.parse(raw) as Partial<AIProviderConfig>
  } catch {
    return {}
  }
}

export const loadAIConfig = async (): Promise<AIProviderConfig> => {
  const fileCfg = await readConfigFile()
  return {
    baseUrl: fileCfg.baseUrl ?? config.ai.defaultBaseUrl,
    model: fileCfg.model ?? config.ai.defaultModel,
    apiKey: fileCfg.apiKey ?? config.ai.apiKey ?? null,
    temperature: Number.isFinite(fileCfg.temperature) ? Number(fileCfg.temperature) : config.ai.defaultTemperature,
  }
}

export const saveAIConfig = async (partial: Partial<AIProviderConfig>): Promise<AIProviderConfig> => {
  const current = await loadAIConfig()
  const next: AIProviderConfig = {
    baseUrl: partial.baseUrl?.trim() || current.baseUrl,
    model: partial.model?.trim() || current.model,
    apiKey:
      typeof partial.apiKey === 'string'
        ? partial.apiKey.trim() || null // 空字符串表示清除
        : current.apiKey,
    temperature:
      typeof partial.temperature === 'number' && Number.isFinite(partial.temperature)
        ? partial.temperature
        : current.temperature,
  }
  await ensureDir(config.ai.configPath)
  await fs.writeFile(config.ai.configPath, JSON.stringify(next, null, 2), 'utf8')
  return next
}
