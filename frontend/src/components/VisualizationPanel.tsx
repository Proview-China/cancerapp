import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaseRecord, TissueAnalysis } from '../types/cases'
import { fetchSampleAnalysis } from '../services/caseService'

type EChartsInstance = {
  setOption: (option: Record<string, unknown>, notMerge?: boolean) => void
  resize: () => void
  dispose: () => void
} | null

type VisualizationPanelProps = {
  caseId: string
  sampleId: string
  cases: CaseRecord[]
}

type FeatureDef = {
  id: string
  label: string
  getNorm: (a: TissueAnalysis) => number
  getRaw: (a: TissueAnalysis) => number
}

// 旧版类型，当前实现不直接使用

// type HeatMode = 'value' | 'corr'

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

const asNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// 已移除旧的格式化工具（保留在 tooltip 内部简单格式）

const FALLBACK_ANALYSIS: TissueAnalysis = {
  raw: {
    pos_cells_1_weak: 1200,
    pos_cells_2_moderate: 3200,
    pos_cells_3_strong: 660,
    iod_total_cells: 5060,
    positive_area_mm2: 0.52,
    tissue_area_mm2: 1.8,
    positive_area_px: 1_720_000,
    tissue_area_px: 6_250_000,
    positive_intensity: 2,
  },
  derived: {
    positive_cells_ratio: 0.82,
    positive_cells_density: 0.12,
    mean_density: 0.11,
    h_score: 186,
    irs: 8,
  },
  images: {
    raw_image_path: null,
    parsed_image_path: null,
  },
}

// 旧版 METRIC_CONFIGS 已替换为特征集合 featList

const FALLBACK_NOTICE = '当前样本暂无分析结果，展示演示数据'

export const VisualizationPanel = ({ caseId, sampleId, cases }: VisualizationPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const pieRef = useRef<HTMLDivElement>(null)
  const heatRef = useRef<HTMLDivElement>(null)
  const pieChart = useRef<EChartsInstance>(null)
  const heatChart = useRef<EChartsInstance>(null)
  const cacheRef = useRef<Record<string, TissueAnalysis | null>>({})
  const [analysis, setAnalysis] = useState<TissueAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 预留模式开关（后续加入相关矩阵）。
  // const [heatMode, setHeatMode] = useState<HeatMode>('value')

  const currentCase = useMemo(() => cases.find((record) => record.id === caseId) ?? null, [cases, caseId])
  const currentSample = useMemo(() => currentCase?.samples.find((sample) => sample.id === sampleId) ?? null, [currentCase, sampleId])

  useEffect(() => {
    setError(null)
    if (!currentSample) {
      setAnalysis(null)
      return
    }
    if (currentSample.analysis) {
      cacheRef.current[currentSample.id] = currentSample.analysis
      setAnalysis(currentSample.analysis)
      return
    }
    const cached = cacheRef.current[currentSample.id]
    if (cached !== undefined) {
      setAnalysis(cached)
      return
    }
    let aborted = false
    setLoading(true)
    fetchSampleAnalysis(caseId, sampleId)
      .then((result) => {
        if (aborted) return
        cacheRef.current[currentSample.id] = result
        setAnalysis(result)
      })
      .catch((err) => {
        if (aborted) return
        console.error('加载分析失败', err)
        cacheRef.current[currentSample.id] = null
        setAnalysis(null)
        setError('加载分析数据失败，已展示演示结果')
      })
      .finally(() => {
        if (!aborted) {
          setLoading(false)
        }
      })
    return () => {
      aborted = true
    }
  }, [caseId, sampleId, currentSample])

  useEffect(() => {
    let disposed = false
    ;(async () => {
      const mod = await import('echarts')
      if (disposed) return
      const echarts: any = (mod as any).default ?? (mod as any)
      if (pieRef.current && !pieChart.current) {
        pieChart.current = echarts.init(pieRef.current)
      }
      if (heatRef.current && !heatChart.current) {
        heatChart.current = echarts.init(heatRef.current)
      }
    })()
    const handleResize = () => {
      pieChart.current?.resize?.()
      heatChart.current?.resize?.()
    }
    window.addEventListener('resize', handleResize)

    // 实时居中：监听容器尺寸变化（包括左右分隔拖拽）
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => handleResize()) : undefined
    if (ro) {
      if (containerRef.current) ro.observe(containerRef.current)
      if (pieRef.current) ro.observe(pieRef.current)
      if (heatRef.current) ro.observe(heatRef.current)
    }
    return () => {
      disposed = true
      window.removeEventListener('resize', handleResize)
      ro?.disconnect()
      pieChart.current?.dispose?.()
      heatChart.current?.dispose?.()
      pieChart.current = null
      heatChart.current = null
    }
  }, [])

  const displayAnalysis = analysis ?? FALLBACK_ANALYSIS
  const usingFallback = !analysis

  // 全库 tissue 样本（带 analysis）
  const allTissueSamples = useMemo(() => {
    const out: Array<{
      id: string
      caseIdentifier: string
      label: string
      analysis: TissueAnalysis
    }> = []
    for (const c of cases) {
      if (c.id !== caseId) continue // 病例隔离：仅取当前病例
      for (const s of c.samples) {
        if (s.modality !== '组织切片') continue
        const a = s.analysis
        if (!a) continue
        const label = `${c.identifier} · ${(s.displayName || s.originalFilename || s.id)}`
        out.push({ id: s.id, caseIdentifier: c.identifier, label, analysis: a })
      }
    }
    // 若全库为空则以当前展示分析兜底
    if (out.length === 0 && displayAnalysis) {
      out.push({ id: 'current', caseIdentifier: currentCase?.identifier ?? '当前病例', label: '当前样本', analysis: displayAnalysis })
    }
    return out
  }, [cases, displayAnalysis, currentCase?.identifier])

  // HSI 组成（阴/弱/中/强）占比
  const getHSIComposition = (a: TissueAnalysis) => {
    const w = asNumber(a.raw.pos_cells_1_weak) ?? 0
    const m = asNumber(a.raw.pos_cells_2_moderate) ?? 0
    const s = asNumber(a.raw.pos_cells_3_strong) ?? 0
    const total = Math.max(asNumber(a.raw.iod_total_cells) ?? 0, w + m + s)
    const pos = total > 0 ? (w + m + s) / total : 0
    const neg = clamp01(1 - pos)
    const safe = (x: number) => (total > 0 ? x / total : 0)
    return {
      neg,
      weak: clamp01(safe(w)),
      moderate: clamp01(safe(m)),
      strong: clamp01(safe(s)),
    }
  }

  // 归一化（0-1）
  const normalize = (a: TissueAnalysis) => {
    const ratio = clamp01(asNumber(a.derived.positive_cells_ratio) ?? 0)
    const mean = clamp01((asNumber(a.derived.mean_density) ?? 0) / 0.2)
    const h = clamp01((asNumber(a.derived.h_score) ?? 0) / 300)
    const irs = clamp01((asNumber(a.derived.irs) ?? 0) / 12)
    const density = clamp01(asNumber(a.derived.positive_cells_density) ?? 0)
    return { ratio, mean, h, irs, density }
  }

  // 风险分（固定权重）
  const riskScore = (n: ReturnType<typeof normalize>) => clamp01(0.4 * n.h + 0.3 * n.irs + 0.2 * n.ratio + 0.1 * n.mean)

  // 置信度（线性组合）
  const confidence = (a: TissueAnalysis) => {
    const totalCells = asNumber(a.raw.iod_total_cells) ?? 0
    const cellsScore = Math.min(totalCells / 5000, 1)
    const areaMm = asNumber(a.raw.tissue_area_mm2)
    const areaPx = asNumber(a.raw.tissue_area_px)
    const areaScore = areaMm != null ? Math.min(areaMm / 1.5, 1) : Math.min((areaPx ?? 0) / 5_000_000, 1)
    const comp = getHSIComposition(a)
    const negPenalty = comp.neg
    return clamp01(0.5 * cellsScore + 0.5 * areaScore - 0.3 * negPenalty)
  }

  // 构建全库矩阵（用于热力图与相关）
  const matrix = useMemo(() => {
    // 构建特征集合：衍生 + 细胞分级占比 + 面积口径 + 原始强度 + 风险
    const featList: FeatureDef[] = [
      { id: 'positive_cells_ratio', label: '阳性细胞比率', getNorm: (a: TissueAnalysis) => normalize(a).ratio, getRaw: (a: TissueAnalysis) => asNumber(a.derived.positive_cells_ratio) ?? 0 },
      { id: 'mean_density', label: '平均光密度', getNorm: (a: TissueAnalysis) => normalize(a).mean, getRaw: (a: TissueAnalysis) => asNumber(a.derived.mean_density) ?? 0 },
      { id: 'h_score', label: 'H-Score', getNorm: (a: TissueAnalysis) => normalize(a).h, getRaw: (a: TissueAnalysis) => asNumber(a.derived.h_score) ?? 0 },
      { id: 'irs', label: 'IRS', getNorm: (a: TissueAnalysis) => normalize(a).irs, getRaw: (a: TissueAnalysis) => asNumber(a.derived.irs) ?? 0 },
      { id: 'positive_cells_density', label: '阳性细胞密度', getNorm: (a: TissueAnalysis) => normalize(a).density, getRaw: (a: TissueAnalysis) => asNumber(a.derived.positive_cells_density) ?? 0 },
      // HSI 分级占比（细胞法）
      { id: 'p_weak', label: '弱阳性占比', getNorm: (a: TissueAnalysis) => getHSIComposition(a).weak, getRaw: (a: TissueAnalysis) => getHSIComposition(a).weak },
      { id: 'p_moderate', label: '中阳性占比', getNorm: (a: TissueAnalysis) => getHSIComposition(a).moderate, getRaw: (a: TissueAnalysis) => getHSIComposition(a).moderate },
      { id: 'p_strong', label: '强阳性占比', getNorm: (a: TissueAnalysis) => getHSIComposition(a).strong, getRaw: (a: TissueAnalysis) => getHSIComposition(a).strong },
      { id: 'p_negative', label: '阴性占比', getNorm: (a: TissueAnalysis) => getHSIComposition(a).neg, getRaw: (a: TissueAnalysis) => getHSIComposition(a).neg },
      // 面积口径
      { id: 'ratio_area', label: '阳性面积比', getNorm: (a: TissueAnalysis) => {
        const pos = asNumber(a.raw.positive_area_mm2)
        const tissue = asNumber(a.raw.tissue_area_mm2)
        if (pos != null && tissue && tissue > 0) return clamp01(pos / tissue)
        const posPx = asNumber(a.raw.positive_area_px) ?? 0
        const tissuePx = asNumber(a.raw.tissue_area_px) ?? 0
        return tissuePx > 0 ? clamp01(posPx / tissuePx) : 0
      }, getRaw: (a: TissueAnalysis) => {
        const pos = asNumber(a.raw.positive_area_mm2)
        const tissue = asNumber(a.raw.tissue_area_mm2)
        if (pos != null && tissue && tissue > 0) return pos / tissue
        const posPx = asNumber(a.raw.positive_area_px) ?? 0
        const tissuePx = asNumber(a.raw.tissue_area_px) ?? 0
        return tissuePx > 0 ? posPx / tissuePx : 0
      } },
      { id: 'surface_density', label: '阳性面密度', getNorm: (a: TissueAnalysis) => {
        const iod = asNumber(a.raw.positive_intensity) ?? 0
        const areaPx = asNumber(a.raw.tissue_area_px) ?? 0
        return clamp01(areaPx > 0 ? iod / Math.max(areaPx, 1) : 0)
      }, getRaw: (a: TissueAnalysis) => {
        const iod = asNumber(a.raw.positive_intensity) ?? 0
        const areaPx = asNumber(a.raw.tissue_area_px) ?? 0
        return areaPx > 0 ? iod / Math.max(areaPx, 1) : 0
      } },
      { id: 'positive_intensity', label: '阳性强度', getNorm: (a: TissueAnalysis) => clamp01((asNumber(a.raw.positive_intensity) ?? 0) / 3), getRaw: (a: TissueAnalysis) => asNumber(a.raw.positive_intensity) ?? 0 },
      { id: 'risk_score', label: '综合风险', getNorm: (a: TissueAnalysis) => riskScore(normalize(a)), getRaw: (a: TissueAnalysis) => riskScore(normalize(a)) },
    ] as const
    const features = featList.map((f) => f.id)
    const labels = featList.map((f) => f.label)
    const rows = allTissueSamples.map((s) => {
      const n = normalize(s.analysis)
      return { id: s.id, label: s.label, n, a: s.analysis, risk: riskScore(n), conf: confidence(s.analysis) }
    })
    // 每个特征的值序列
    const byFeature: Record<string, number[]> = {}
    for (const f of features) byFeature[f] = rows.map((r) => featList[features.indexOf(f)].getNorm(r.a))
    const stats: Record<string, { mean: number; sd: number }> = {}
    for (const f of features) {
      const arr = byFeature[f]
      const mean = arr.reduce((s, v) => s + v, 0) / Math.max(arr.length, 1)
      const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(arr.length, 1)) || 1
      stats[f] = { mean, sd }
    }
    const z = rows.map((r) => {
      const obj: Record<string, number> = {}
      for (const f of features) {
        const v = featList[features.indexOf(f)].getNorm(r.a) ?? 0
        // 当样本数过少时直接用归一值；>=3 时用 z-score
        if (rows.length >= 3) {
          const z0 = (v - stats[f].mean) / (stats[f].sd || 1)
          obj[f] = clamp01((Math.max(Math.min(z0, 2.5), -2.5) + 2.5) / 5)
        } else {
          obj[f] = clamp01(v)
        }
      }
      return obj
    })
    return { features, labels, rows, z, featList }
  }, [allTissueSamples])

  // 相关与显著性（近似）：Spearman + BH-FDR
  // 预留：相关与显著性（本模式暂不直接使用）
  /* const corr = useMemo(() => {
    const rank = (arr: number[]) => {
      const pairs = arr.map((v, i) => ({ v, i }))
      pairs.sort((a, b) => a.v - b.v)
      const ranks = new Array(arr.length)
      let i = 0
      while (i < pairs.length) {
        let j = i
        while (j + 1 < pairs.length && pairs[j + 1].v === pairs[i].v) j++
        const r = (i + j + 2) / 2
        for (let k = i; k <= j; k++) ranks[pairs[k].i] = r
        i = j + 1
      }
      return ranks
    }
    const pearson = (x: number[], y: number[]) => {
      const n = Math.min(x.length, y.length)
      if (n < 2) return { r: 0, p: 1 }
      const mx = x.reduce((s, v) => s + v, 0) / n
      const my = y.reduce((s, v) => s + v, 0) / n
      let num = 0, dx = 0, dy = 0
      for (let i = 0; i < n; i++) {
        const ax = x[i] - mx
        const ay = y[i] - my
        num += ax * ay
        dx += ax * ax
        dy += ay * ay
      }
      const r = num / Math.sqrt((dx || 1) * (dy || 1))
      const t = r * Math.sqrt((n - 2) / Math.max(1 - r * r, 1e-6))
      // 双侧 p 值近似
      const p = Math.min(1, 2 * (1 - cdfT(Math.abs(t), n - 2)))
      return { r, p }
    }
    // t 分布 CDF 近似（贝塔函数简化），小样本近似足够 UI 使用
    const cdfT = (t: number, v: number) => {
      // 来自数值近似：将 t^2/(v+t^2) 代入不完全贝塔函数，这里使用近似多项式
      const x = v / (v + t * t)
      // 近似：I_x(a,b) ~ x^a / (a * B(a,b))（粗略，只用于视觉）
      const a = v / 2
      const b = 0.5
      const lgamma = (z: number) => {
        // Lanczos 近似的对数伽马（简化）
        const coefs = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -5.395239384953e-6]
        let x = z
        let y = z
        let tmp = x + 5.5
        tmp -= (x + 0.5) * Math.log(tmp)
        let ser = 1.000000000190015
        for (let j = 0; j < coefs.length; j++) {
          y += 1
          ser += coefs[j] / y
        }
        return Math.log(2.5066282746310005 * ser / z) - tmp + Math.log(x + 4.5)
      }
      const B = (a: number, b: number) => Math.exp(lgamma(a) + lgamma(b) - lgamma(a + b))
      const approx = Math.pow(x, a) / (a * (B(a, b) || 1))
      return Math.min(Math.max(approx, 0), 1)
    }

    const n = matrix.rows.length
    const valuesByFeature: Record<string, number[]> = {}
    for (const f of matrix.features) valuesByFeature[f] = matrix.rows.map((r) => (r.n as any)[f] ?? 0)
    const riskArr = matrix.rows.map((r) => r.risk)
    const result: Array<{ feature: string; r: number; p: number }> = []
    for (const f of matrix.features) {
      const rx = rank(valuesByFeature[f])
      const ry = rank(riskArr)
      const { r, p } = pearson(rx, ry) // Spearman = Pearson(秩)
      result.push({ feature: f, r, p })
    }
    // BH-FDR
    const sorted = [...result].sort((a, b) => a.p - b.p)
    const qmap = new Map<string, number>()
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i].p
      const q = (p * sorted.length) / (i + 1)
      qmap.set(sorted[i].feature, Math.min(q, 1))
    }
    const map: Record<string, { r: number; p: number; q: number; stars: string }> = {}
    for (const item of result) {
      const q = qmap.get(item.feature) ?? 1
      const stars = q <= 0.01 ? '***' : q <= 0.05 ? '**' : q <= 0.1 ? '*' : ''
      map[item.feature] = { r: item.r, p: item.p, q, stars }
    }
    return { map, n }
  }, [matrix]) */

  // 旧的单样本指标阵列不再直接用于图表

  // 旧的风险分层扇形统计不再使用

  // 复合热力图模型（医生判断维度为横轴；病例内统计）
  const heatmapModel = useMemo(() => {
    // 横轴“判断维度”（更丰富，让图不“素”）
    const dims = [
      { id: 'norm', label: '归一' },
      { id: 'norm_dec', label: '归一(十分位)' },
      { id: 'z', label: 'z分' },
      { id: 'z_abs', label: '|z|' },
      { id: 'pct', label: '分位' },
      { id: 'qgrp', label: '分位组(Q)' },
      { id: 'rank', label: '排名' },
      { id: 'dev_pos', label: '正偏' },
      { id: 'dev_neg', label: '负偏' },
      { id: 'iqr', label: 'IQR位' },
      { id: 'conf', label: '置信' },
      { id: 'stab', label: '稳定' },
      { id: 'w', label: '权重' },
      { id: 'comp', label: '完备' },
    ] as const

    // 取当前病例内样本集合
    const rowsLabels = matrix.labels
    const colsLabels = dims.map((d) => d.label)

    // 当前样本在病例内的 z 与分位需要病例内分布
    const caseValuesByFeature: Record<string, Array<number | null>> = {}
    for (let y = 0; y < rowsLabels.length; y++) {
      const f = matrix.features[y]
      caseValuesByFeature[f] = matrix.rows.map((r) => {
        const raw = matrix.featList[y].getRaw(r.a)
        if (raw == null || Number.isNaN(raw)) return null
        return matrix.featList[y].getNorm(r.a)
      })
    }
    // const selectedRowIndex = Math.max(0, matrix.rows.findIndex((r) => r.id === currentSample?.id))

    const riskWeights: Record<string, number> = {
      h_score: 0.4,
      irs: 0.3,
      positive_cells_ratio: 0.2,
      mean_density: 0.1,
    }

    const values: Array<{ value: [number, number, number]; meta: { dim: string; feature: string; display: string } }> = []
    for (let y = 0; y < rowsLabels.length; y++) {
      const f = matrix.features[y]
      const feat = matrix.featList[y]
      const valNorm = feat.getNorm(displayAnalysis)
      const arr = (caseValuesByFeature[f] ?? []).filter((v): v is number => typeof v === 'number')
      // z-score（病例内），样本数<3则回退
      let z01 = valNorm
      if (arr && arr.length >= 3) {
        const mean = arr.reduce((s, v) => s + v, 0) / arr.length
        const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) * (v - mean), 0) / arr.length) || 1
        const z = (valNorm - mean) / sd
        z01 = clamp01((Math.max(Math.min(z, 2.5), -2.5) + 2.5) / 5)
        // 偏差（绝对z，压缩到0-1）
        var devAbs01 = clamp01(Math.abs(z) / 3)
        var devPos01 = clamp01(z > 0 ? z01 : 0)
        var devNeg01 = clamp01(z < 0 ? -z01 + 0 : 0)
        // 稳定性（CV反向指标）
        const cv = Math.abs(sd / (mean || 1))
        var stab01 = clamp01(1 / (1 + cv))
      } else {
        var devAbs01 = 0.5
        var devPos01 = 0.5
        var devNeg01 = 0.5
        var stab01 = 0.5
      }
      // 分位（病例内）
      let pct01 = 0.5
      if (arr && arr.length >= 2) {
        const sorted = [...arr].sort((a, b) => a - b)
        const idx = sorted.findIndex((v) => v >= valNorm)
        const r = idx < 0 ? sorted.length - 1 : idx
        pct01 = r / Math.max(sorted.length - 1, 1)
      }
      // IQR 位置
      let iqr01 = 0.5
      if (arr && arr.length >= 4) {
        const qs = quantiles(arr, [0.25, 0.75])
        const iqr = Math.max(qs[1] - qs[0], 1e-6)
        iqr01 = clamp01((valNorm - qs[0]) / iqr)
      }
      const weight = riskWeights[f] ?? 0
      const conf01 = confidence(displayAnalysis)
      const completeness = (() => {
        const total = (caseValuesByFeature[f] ?? []).length
        const missing = (caseValuesByFeature[f] ?? []).filter((v) => v == null).length
        return total > 0 ? clamp01(1 - missing / total) : 0
      })()

      const rankVal = (() => {
        if (!arr || arr.length === 0) return 0.5
        const order = [...arr].sort((a, b) => a - b)
        const idx = order.findIndex((v) => v >= valNorm)
        const r = idx < 0 ? order.length - 1 : idx
        return r / Math.max(order.length - 1, 1)
      })()

      const qgrpVal = (() => {
        const q = Math.round(pct01 * 4) + 1 // 1..5
        return (q - 1) / 4
      })()

      const dimValues: Record<(typeof dims)[number]['id'], { val: number; text: string }> = {
        norm: { val: clamp01(valNorm), text: `${(valNorm * 100).toFixed(1)}%` },
        norm_dec: { val: Math.round(valNorm * 9) / 9, text: '十分位' },
        z: { val: z01, text: `z ${(z01 * 5 - 2.5).toFixed(2)}` },
        z_abs: { val: devAbs01, text: '|z|' },
        pct: { val: pct01, text: `${Math.round(pct01 * 100)} pctl` },
        qgrp: { val: qgrpVal, text: 'Q组' },
        rank: { val: rankVal, text: '相对排名' },
        dev_pos: { val: devPos01, text: '正偏' },
        dev_neg: { val: devNeg01, text: '负偏' },
        iqr: { val: iqr01, text: 'IQR相对位' },
        conf: { val: conf01, text: `${Math.round(conf01 * 100)}%` },
        w: { val: weight, text: `${Math.round(weight * 100)}%` },
        stab: { val: stab01, text: '稳定性' },
        comp: { val: completeness, text: '完备度' },
      }

      dims.forEach((d, x) => {
        const dv = dimValues[d.id]
        // 为了让色块更分离，对数值做确定性微抖动（不改真实数据）
        const key = `${caseId}|${currentSample?.id ?? 'sample'}|${f}|${d.id}`
        const mag = d.id === 'z_abs' || d.id === 'dev_pos' || d.id === 'dev_neg' ? 0.18 : d.id === 'norm_dec' || d.id === 'qgrp' ? 0.12 : 0.1
        const jval = jitter01(dv.val, key, mag)
        values.push({ value: [x, y, jval], meta: { dim: d.label, feature: rowsLabels[y], display: dv.text } })
      })
    }

    return { rowsLabels, colsLabels, values }
  }, [matrix, currentSample?.id, displayAnalysis])

  // const caseLabel = currentCase?.identifier ?? '当前病例'
  // const sampleLabel = currentSample?.displayName || currentSample?.originalFilename || '当前样本'

  useEffect(() => {
    if (!pieChart.current) return
    // 多层级环形图
    const currentNorm = normalize(displayAnalysis)
    const risk = riskScore(currentNorm)
    const comp = getHSIComposition(displayAnalysis)

    // R1 风险分层（按当前样本 4 指标阈值投票得到高/中/低计数占比）
    const levels = (() => {
      const vals = [currentNorm.h, currentNorm.irs, currentNorm.ratio, currentNorm.mean]
      let high = 0, mid = 0, low = 0
      for (const v of vals) {
        if (v >= 0.75) high++
        else if (v >= 0.5) mid++
        else low++
      }
      const total = vals.length || 1
      return { high: high / total, mid: mid / total, low: low / total }
    })()

    // R2 特征贡献（采用固定权重占比）
    const contrib = [
      { name: 'H-Score', weight: 0.4, mean: currentNorm.h },
      { name: 'IRS', weight: 0.3, mean: currentNorm.irs },
      { name: '阳性细胞比率', weight: 0.2, mean: currentNorm.ratio },
      { name: '平均光密度', weight: 0.1, mean: currentNorm.mean },
    ]

    // R5 缺失率（以全库缺失率估计）
    const missRates = (() => {
      const features = ['positive_cells_ratio', 'mean_density', 'h_score', 'irs']
      const rate = features.map((f) => {
        const total = matrix.rows.length
        const miss = matrix.rows.filter((r) => (r.a.derived as any)[f] == null).length
        return { f, miss: total ? miss / total : 0 }
      })
      return rate
    })()

    pieChart.current.setOption(
      {
        backgroundColor: 'rgba(0,0,0,0)',
        legend: {
          type: 'scroll',
          top: 2,
          left: 'center',
          orient: 'horizontal',
          itemWidth: 10,
          itemHeight: 10,
          pageIconColor: '#8a6d3b',
        },
        series: [
          // 中心仪表
          {
            type: 'gauge',
            startAngle: 220,
            endAngle: -40,
            center: ['50%', '60%'],
            radius: '22%',
            min: 0,
            max: 1,
            axisLine: { lineStyle: { width: 6, color: [[1, '#f39c12']] } },
            axisLabel: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            pointer: { width: 2, length: '55%' },
            progress: { show: true, width: 6 },
            detail: { formatter: (v: number) => `风险 ${(v * 100).toFixed(0)}%`, fontSize: 12, offsetCenter: [0, '0%'] },
            data: [{ value: risk }],
          },
          // R1 风险分层环
          {
            type: 'pie',
            center: ['50%', '60%'],
            radius: ['30%', '36%'],
            label: { show: false },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            data: [
              { name: '高', value: levels.high, itemStyle: { color: '#d73027' } },
              { name: '中', value: levels.mid, itemStyle: { color: '#fc8d59' } },
              { name: '低', value: levels.low, itemStyle: { color: '#fee090' } },
            ],
            silent: true,
            avoidLabelOverlap: false,
          },
          // R2 特征贡献环
          {
            type: 'pie',
            center: ['50%', '60%'],
            radius: ['40%', '54%'],
            label: { show: false },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            data: contrib.map((c) => ({ name: c.name, value: c.weight, itemStyle: { color: echartsYlOrRd(c.mean) }, mean: c.mean })),
            silent: true,
            avoidLabelOverlap: false,
          },
          // R3 分位细分环（简化：按全库分位统计，每特征 5 段）
          {
            type: 'pie',
            center: ['50%', '60%'],
            radius: ['58%', '66%'],
            label: { show: false },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            data: (() => {
              const items: Array<{ name: string; value: number; itemStyle: { color: string } }> = []
              const feats = [
                { id: 'h', name: 'H-Score', get: (n: any) => n.h },
                { id: 'irs', name: 'IRS', get: (n: any) => n.irs },
                { id: 'ratio', name: '阳性细胞比率', get: (n: any) => n.ratio },
                { id: 'mean', name: '平均光密度', get: (n: any) => n.mean },
              ]
              for (const f of feats) {
                const arr = matrix.rows.map((r) => f.get(r.n))
                const qs = quantiles(arr, [0, 0.2, 0.4, 0.6, 0.8, 1])
                for (let i = 0; i < 5; i++) {
                  const low = qs[i]
                  const high = qs[i + 1]
                  const inBin = arr.filter((v) => v >= low && (i === 4 ? v <= high : v < high))
                  const mean = inBin.length ? inBin.reduce((s, v) => s + v, 0) / inBin.length : 0
                  items.push({ name: `${f.name} Q${i + 1}`, value: Math.max(inBin.length, 1), itemStyle: { color: echartsYlOrRd(mean) } })
                }
              }
              return items
            })(),
            silent: true,
            avoidLabelOverlap: false,
          },
          // R4 HSI 组成环
          {
            type: 'pie',
            center: ['50%', '60%'],
            radius: ['70%', '78%'],
            label: { show: false },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            data: [
              { name: '阴性', value: comp.neg, itemStyle: { color: '#bbb' } },
              { name: '弱', value: comp.weak, itemStyle: { color: '#fee090' } },
          { name: '中', value: comp.moderate, itemStyle: { color: '#fc8d59' } },
          { name: '强', value: comp.strong, itemStyle: { color: '#d73027' } },
          ],
          },
          // R5 缺失率窄环
          {
            type: 'pie',
            center: ['50%', '60%'],
            radius: ['82%', '86%'],
            label: { show: false },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            data: missRates.map((r) => ({ name: `缺失·${r.f}`, value: Math.max(r.miss, 0.001), itemStyle: { color: `rgba(120,120,120,${0.3 + 0.7 * r.miss})` } })),
            },
        ],
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => {
            const n = p.data?.mean
            if (typeof n === 'number') {
              return `${p.name}<br/>均值: ${(n * 100).toFixed(1)}%`
            }
            return `${p.name}: ${(p.percent ?? 0).toFixed(1)}%`
          },
        },
      },
      true,
    )
  }, [pieChart.current, displayAnalysis, matrix])

  useEffect(() => {
    if (!heatChart.current) return
    const cols = heatmapModel.colsLabels
    const rows = heatmapModel.rowsLabels

    heatChart.current.setOption(
      {
        backgroundColor: 'rgba(0,0,0,0)',
        tooltip: {
          confine: true,
          formatter: (p: any) => {
            if (p.seriesType === 'heatmap') {
              const meta = p.data.meta
              return `${meta.feature} · ${meta.dim}: ${meta.display}`
            }
            return ''
          },
        },
        grid: { top: 10, left: '12%', right: '12%', bottom: 36, containLabel: true },
        xAxis: { type: 'category', data: cols, axisTick: { show: false } },
        yAxis: { type: 'category', data: rows, axisTick: { show: false } },
        visualMap: [{ min: 0, max: 1, calculable: false, orient: 'horizontal', left: 'center', bottom: 12, inRange: { color: ylOrRdColors } }],
        series: [
          {
            type: 'heatmap',
            data: heatmapModel.values.map((pt) => ({ value: pt.value, meta: pt.meta })),
            itemStyle: { borderColor: '#fff', borderWidth: 2, borderType: 'solid' },
          },
        ],
      },
      true,
    )
  }, [heatmapModel])

  if (!currentCase || !currentSample) {
    return <p role="alert">请选择病例并加载组织切片样本以查看“图像总结”。</p>
  }

  return (
    <div ref={containerRef} className="viz-panel" aria-label="图像总结">
      <div className="viz-grid" role="group" aria-label="图像总结图表">
        <section className="pond viz-card" aria-labelledby="viz-pie-title">
          <div id="viz-pie-title" className="pond__title" style={{ marginBottom: 6 }}>
            多层级环形图（综合风险）
          </div>
          {loading ? (
            <p className="viz-panel__notice" role="status">
              正在加载分析数据…
            </p>
          ) : null}
          {usingFallback ? (
            <p className="viz-panel__notice" role="status">
              {error ?? FALLBACK_NOTICE}
            </p>
          ) : null}
          <div ref={pieRef} className="viz-echart" aria-label="多层级环形图" />
        </section>
        <section className="pond viz-card" aria-labelledby="viz-heat-title">
          <div id="viz-heat-title" className="pond__title" style={{ marginBottom: 6 }}>
            复合热力图（样本×特征 + 谱带）
          </div>
          <div ref={heatRef} className="viz-echart" aria-label="关键影响因素热力图" />
        </section>
      </div>
    </div>
  )
}

export default VisualizationPanel

// 颜色工具：YlOrRd 顺序色（0→1）
const ylOrRdColors = ['#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02']
const echartsYlOrRd = (v01: number) => {
  const v = clamp01(v01)
  const idx = Math.min(ylOrRdColors.length - 1, Math.max(0, Math.floor(v * (ylOrRdColors.length - 1))))
  return ylOrRdColors[idx]
}

// 发散色 RdBu（-1→1）
// const rdBuColors = ['#2166ac', '#4393c3', '#92c5de', '#f7f7f7', '#f4a582', '#d6604d', '#b2182b']

// 分位
const quantiles = (arr: number[], qs: number[]) => {
  const a = [...arr].sort((x, y) => x - y)
  if (a.length === 0) return qs.map(() => 0)
  return qs.map((q) => {
    const pos = (a.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    if (a[base + 1] !== undefined) return a[base] + rest * (a[base + 1] - a[base])
    return a[base]
  })
}

// 抖动工具：基于 key 的确定性伪随机，让相邻色块不易连片
const jitter01 = (v: number, key: string, magnitude = 0.1) => {
  const seed = hashString(key)
  const rnd = mulberry32(seed)()
  const delta = (rnd * 2 - 1) * magnitude
  return clamp01(v + delta)
}

const hashString = (s: string) => {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
