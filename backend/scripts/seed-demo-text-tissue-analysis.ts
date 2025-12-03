import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db/pool.js'
import { ensureCaseReportsTable, ensureSampleTissueAnalysisTable } from '../src/db/init.js'

type RawMetrics = {
  pos_cells_1_weak: number
  pos_cells_2_moderate: number
  pos_cells_3_strong: number
  iod_total_cells: number
  positive_area_mm2: number
  tissue_area_mm2: number
  positive_area_px: number
  tissue_area_px: number
  positive_intensity: number
}

type DerivedMetrics = {
  positive_cells_ratio: number
  positive_cells_density: number
  mean_density: number
  h_score: number
  irs: number
}

type Seed = {
  identifier: string
  displayName: string
  sourceImage: string
  raw: RawMetrics
  derived: DerivedMetrics
  ai: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const SOURCE_DIR = path.join(ROOT, 'ai', 'demo', 'pictures')
const UPLOADS_DIR = path.join(ROOT, 'uploads', 'demo')
const PUBLIC_BASE = '/uploads/demo'

const ensureDir = async (dir: string) => fs.mkdir(dir, { recursive: true })

const checksumFile = async (file: string) => {
  const buf = await fs.readFile(file)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

const runFFmpegCrop = (src: string, dest: string, side: 'left' | 'right') => {
  const vf = side === 'left' ? 'crop=iw/2:ih:0:0' : 'crop=iw/2:ih:iw/2:0'
  const result = spawnSync('ffmpeg', ['-y', '-i', src, '-vf', vf, dest], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`裁剪失败: ${src} -> ${dest}\n${result.stderr || result.stdout}`)
  }
}

const prepareImages = async (seed: Seed) => {
  await ensureDir(UPLOADS_DIR)
  if (!fsSync.existsSync(seed.sourceImage)) {
    throw new Error(`源图不存在: ${seed.sourceImage}`)
  }
  const ext = path.extname(seed.sourceImage) || '.jpg'
  const rawPath = path.join(UPLOADS_DIR, `${seed.identifier}_raw${ext}`)
  const parsedPath = path.join(UPLOADS_DIR, `${seed.identifier}_parsed${ext}`)
  runFFmpegCrop(seed.sourceImage, rawPath, 'left')
  runFFmpegCrop(seed.sourceImage, parsedPath, 'right')
  return {
    rawAbs: path.resolve(rawPath),
    parsedAbs: path.resolve(parsedPath),
    rawPublic: `${PUBLIC_BASE}/${path.basename(rawPath)}`,
    parsedPublic: `${PUBLIC_BASE}/${path.basename(parsedPath)}`,
  }
}

const upsertCase = async (identifier: string, displayName: string) => {
  const r = await pool.query(
    `INSERT INTO cases (identifier, display_name, metadata)
     VALUES ($1, $2, $3)
     ON CONFLICT (identifier) DO UPDATE
     SET display_name = COALESCE(EXCLUDED.display_name, cases.display_name),
         metadata = cases.metadata || EXCLUDED.metadata,
         updated_at = NOW()
     RETURNING *`,
    [identifier, displayName, { source: 'demo-text-tissue' }],
  )
  return r.rows[0]
}

const upsertSample = async (caseId: string, identifier: string, publicPath: string, checksum: string, filename: string) => {
  const exists = await pool.query(
    `SELECT * FROM case_samples WHERE case_id = $1 AND modality = '组织切片' LIMIT 1`,
    [caseId],
  )
  if (exists.rowCount > 0) {
    const row = exists.rows[0]
    const upd = await pool.query(
      `UPDATE case_samples
       SET description = $2,
           original_filename = $3,
           storage_path = $4,
           storage_thumbnail = $4,
           checksum = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [row.id, `${identifier} 组织切片`, filename, publicPath, checksum],
    )
    return upd.rows[0]
  }
  const ins = await pool.query(
    `INSERT INTO case_samples (case_id, modality, description, original_filename, storage_path, storage_thumbnail, checksum)
     VALUES ($1, '组织切片', $2, $3, $4, $4, $5)
     RETURNING *`,
    [caseId, `${identifier} 组织切片`, filename, publicPath, checksum],
  )
  return ins.rows[0]
}

const upsertAnalysis = async (
  sampleId: string,
  seed: Seed,
  paths: { rawAbs: string; parsedAbs: string },
) => {
  const payload = {
    pos_cells_1_weak: seed.raw.pos_cells_1_weak,
    pos_cells_2_moderate: seed.raw.pos_cells_2_moderate,
    pos_cells_3_strong: seed.raw.pos_cells_3_strong,
    iod_total_cells: seed.raw.iod_total_cells,
    positive_area_mm2: seed.raw.positive_area_mm2,
    tissue_area_mm2: seed.raw.tissue_area_mm2,
    positive_area_px: seed.raw.positive_area_px,
    tissue_area_px: seed.raw.tissue_area_px,
    positive_intensity: seed.raw.positive_intensity,
    positive_cells_ratio: seed.derived.positive_cells_ratio,
    positive_cells_density: seed.derived.positive_cells_density,
    mean_density: seed.derived.mean_density,
    h_score: seed.derived.h_score,
    irs: seed.derived.irs,
    raw_image_path: paths.rawAbs,
    parsed_image_path: paths.parsedAbs,
    metadata: {
      source: 'demo-text-tissue',
      ai: seed.ai,
      iod: seed.raw.iod_total_cells,
      image: path.basename(seed.sourceImage),
    },
  }

  const exists = await pool.query(`SELECT id FROM sample_tissue_analysis WHERE sample_id = $1`, [sampleId])
  if (exists.rowCount > 0) {
    await pool.query(
      `UPDATE sample_tissue_analysis SET
        pos_cells_1_weak=$2,
        pos_cells_2_moderate=$3,
        pos_cells_3_strong=$4,
        iod_total_cells=$5,
        positive_area_mm2=$6,
        tissue_area_mm2=$7,
        positive_area_px=$8,
        tissue_area_px=$9,
        positive_intensity=$10,
        positive_cells_ratio=$11,
        positive_cells_density=$12,
        mean_density=$13,
        h_score=$14,
        irs=$15,
        raw_image_path=$16,
        parsed_image_path=$17,
        metadata=$18,
        updated_at=NOW()
       WHERE sample_id=$1`,
      [
        sampleId,
        payload.pos_cells_1_weak,
        payload.pos_cells_2_moderate,
        payload.pos_cells_3_strong,
        payload.iod_total_cells,
        payload.positive_area_mm2,
        payload.tissue_area_mm2,
        payload.positive_area_px,
        payload.tissue_area_px,
        payload.positive_intensity,
        payload.positive_cells_ratio,
        payload.positive_cells_density,
        payload.mean_density,
        payload.h_score,
        payload.irs,
        payload.raw_image_path,
        payload.parsed_image_path,
        payload.metadata,
      ],
    )
    return
  }
  await pool.query(
    `INSERT INTO sample_tissue_analysis (
      sample_id,
      pos_cells_1_weak, pos_cells_2_moderate, pos_cells_3_strong, iod_total_cells,
      positive_area_mm2, tissue_area_mm2, positive_area_px, tissue_area_px, positive_intensity,
      positive_cells_ratio, positive_cells_density, mean_density, h_score, irs,
      raw_image_path, parsed_image_path, metadata
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )`,
    [
      sampleId,
      payload.pos_cells_1_weak,
      payload.pos_cells_2_moderate,
      payload.pos_cells_3_strong,
      payload.iod_total_cells,
      payload.positive_area_mm2,
      payload.tissue_area_mm2,
      payload.positive_area_px,
      payload.tissue_area_px,
      payload.positive_intensity,
      payload.positive_cells_ratio,
      payload.positive_cells_density,
      payload.mean_density,
      payload.h_score,
      payload.irs,
      payload.raw_image_path,
      payload.parsed_image_path,
      payload.metadata,
    ],
  )
}

const SEEDS: Seed[] = [
  {
    identifier: 'DEMO-TEXT-01',
    displayName: '王梅',
    sourceImage: path.join(SOURCE_DIR, 'image100.jpeg'),
    raw: {
      pos_cells_1_weak: 950,
      pos_cells_2_moderate: 3200,
      pos_cells_3_strong: 2400,
      iod_total_cells: 9700,
      positive_area_mm2: 1.25,
      tissue_area_mm2: 2.05,
      positive_area_px: 2_100_500,
      tissue_area_px: 6_200_000,
      positive_intensity: 1.78,
    },
    derived: {
      positive_cells_ratio: 67.52,
      positive_cells_density: 0.085,
      mean_density: 0.09,
      h_score: 168,
      irs: 7,
    },
    ai: [
      '## 预测概述\n\n阳性细胞以中度为主（约 67%），强阳性为局灶散在，提示通路活性中等偏稳。像素面积与组织面积匹配，无明显坏死或压片伪影，整体信号均衡且背景干净。',
      '## 深度推理\n\n- 弱+中度染色大于强阳性，信号尚未进入饱和区间，可能受上游配体/受体数量限制。\n- 2.05 mm² 的组织覆盖保证统计稳健，局部未见极端异质性。\n- 光密度 0.09 且正强度 1.78，说明染色质量可接受，噪声低，适合作为基线切片。',
      '## 建议\n\n1. 4–6 周后在相邻区域复采，验证活性稳定性与空间一致性。\n2. 若计划治疗，建议补做转录因子核定位或磷酸化位点，确认通路下游是否被激活。\n3. 临床监测肝功与症状，如出现进展迹象提前复评。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-02',
    displayName: '李强',
    sourceImage: path.join(SOURCE_DIR, 'image101.jpeg'),
    raw: {
      pos_cells_1_weak: 1200,
      pos_cells_2_moderate: 3600,
      pos_cells_3_strong: 2600,
      iod_total_cells: 10_500,
      positive_area_mm2: 1.48,
      tissue_area_mm2: 2.20,
      positive_area_px: 2_850_000,
      tissue_area_px: 6_800_000,
      positive_intensity: 1.92,
    },
    derived: {
      positive_cells_ratio: 70.48,
      positive_cells_density: 0.094,
      mean_density: 0.11,
      h_score: 182,
      irs: 8,
    },
    ai: [
      '## 预测概述\n\n阳性比率约 70%，中度与强阳性混合分布，光密度 0.11、正强度 1.92，提示通路激活水平偏高但未完全饱和。',
      '## 深度推理\n\n- 总细胞量 1.05 万、组织面积 2.2 mm²，覆盖充分，误差低。\n- 强阳性占比提升但未压倒弱阳性，说明存在放大但仍有调控余量。\n- 光密度与 H-Score 182 同步升高，可能与上游驱动或局部微环境刺激相关。',
      '## 建议\n\n1. 联合 Ki-67/增殖标记或分子检测，甄别是否有驱动突变或活跃增殖。\n2. 6–8 周设随访节点，观察阳性比例与光密度是否持续上升。\n3. 若拟启动治疗，建议先评估耐受性并建立影像和 IHC 基线。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-03',
    displayName: '张丽华',
    sourceImage: path.join(SOURCE_DIR, 'image102.jpeg'),
    raw: {
      pos_cells_1_weak: 800,
      pos_cells_2_moderate: 2700,
      pos_cells_3_strong: 2100,
      iod_total_cells: 8800,
      positive_area_mm2: 1.06,
      tissue_area_mm2: 1.78,
      positive_area_px: 1_920_000,
      tissue_area_px: 5_700_000,
      positive_intensity: 1.7,
    },
    derived: {
      positive_cells_ratio: 63.64,
      positive_cells_density: 0.081,
      mean_density: 0.08,
      h_score: 155,
      irs: 6,
    },
    ai: [
      '## 预测概述\n\n阳性比率约 64%，中度阳性主导，强阳性相对有限，整体激活温和且均匀；光密度 0.08，背景噪声低。',
      '## 深度推理\n\n- 组织面积 1.78 mm²，统计可靠，未见大面积空白或坏死。\n- 强阳性聚集不明显，空间异质性较小，提示通路激活较为均衡。\n- Positive Intensity 1.7 与 H-Score 155 对应中低平台，通路存在但不具压倒性。',
      '## 建议\n\n1. 在相邻扇区补取样，排查是否存在局灶高活性点。\n2. 结合临床症状/生化指标，不宜过度解读单次 IHC；若后续治疗，保持此样本作为基线。\n3. 复查周期可放宽至 8–12 周，若症状变化提前复评。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-04',
    displayName: '王建国',
    sourceImage: path.join(SOURCE_DIR, 'image103.jpeg'),
    raw: {
      pos_cells_1_weak: 1400,
      pos_cells_2_moderate: 3300,
      pos_cells_3_strong: 2900,
      iod_total_cells: 11_200,
      positive_area_mm2: 1.52,
      tissue_area_mm2: 2.30,
      positive_area_px: 3_050_000,
      tissue_area_px: 6_900_000,
      positive_intensity: 2.05,
    },
    derived: {
      positive_cells_ratio: 67.86,
      positive_cells_density: 0.1,
      mean_density: 0.12,
      h_score: 194,
      irs: 9,
    },
    ai: [
      '## 预测概述\n\n阳性占比约 68%，强阳性贡献度上升，光密度 0.12、正强度 2.05，提示通路激活略高且有持续放大趋势。',
      '## 深度推理\n\n- 强/中度阳性数量接近，空间呈条带或片状分布，可能与局部微环境或血供有关。\n- Mean Density 0.12 与 H-Score 194 同步抬升，说明染色信号稳定且强。\n- 组织面积 2.3 mm²、总细胞 1.12 万，统计稳健，可作为后续对比基线。',
      '## 建议\n\n1. 补充分子检测（突变/拷贝数/表达）确认驱动因素；必要时做多标记共定位。\n2. 设 6–8 周短期复评窗口，关注强阳性是否继续攀升。\n3. 若规划干预，先评估肝功能与耐受性，避免过度抑制导致副作用。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-05',
    displayName: '刘芸',
    sourceImage: path.join(SOURCE_DIR, 'image104.jpeg'),
    raw: {
      pos_cells_1_weak: 1000,
      pos_cells_2_moderate: 2500,
      pos_cells_3_strong: 2300,
      iod_total_cells: 9400,
      positive_area_mm2: 0.98,
      tissue_area_mm2: 1.6,
      positive_area_px: 1_750_000,
      tissue_area_px: 5_400_000,
      positive_intensity: 1.66,
    },
    derived: {
      positive_cells_ratio: 61.7,
      positive_cells_density: 0.078,
      mean_density: 0.085,
      h_score: 148,
      irs: 5,
    },
    ai: [
      '## 预测概述\n\n阳性比率约 62%，弱/中度为主，光密度 0.085、正强度 1.66，整体信号偏温和，可作为低位基线样本。',
      '## 深度推理\n\n- 组织面积 1.6 mm²，采样紧凑，局部有轻度异质，但无明显坏死或压片伪影。\n- 强阳性数量有限，说明通路未显著放大，更可能受背景炎症或基础表达驱动。\n- H-Score 148、IRS 5 处于中低区间，可用于后续疗程对比。',
      '## 建议\n\n1. 作为基线记录，治疗或随访中复采相同位置以观测变化。\n2. 若决策需更高置信度，建议加做分子检测并与影像学同频评估。\n3. 复查周期可适度延后，但如症状或生化指标波动应提前复评。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-06',
    displayName: '赵海',
    sourceImage: path.join(SOURCE_DIR, 'image105.jpeg'),
    raw: {
      pos_cells_1_weak: 900,
      pos_cells_2_moderate: 3800,
      pos_cells_3_strong: 3300,
      iod_total_cells: 11_800,
      positive_area_mm2: 1.7,
      tissue_area_mm2: 2.45,
      positive_area_px: 3_400_000,
      tissue_area_px: 7_200_000,
      positive_intensity: 2.1,
    },
    derived: {
      positive_cells_ratio: 67.8,
      positive_cells_density: 0.107,
      mean_density: 0.125,
      h_score: 206,
      irs: 10,
    },
    ai: [
      '## 预测概述\n\n阳性比率约 68%，强阳性数量可观，光密度 0.125、正强度 2.1，提示通路处于偏高激活区间且可能有上游放大。',
      '## 深度推理\n\n- 强阳性 3300 个，与中度接近，显示信号已进入高台阶但仍有弱阳性缓冲。\n- 组织面积 2.45 mm²，覆盖宽，统计稳健，可排除取样不足导致的偏差。\n- H-Score 206、IRS 10 处于高位，可能与驱动突变或高表达相关，需警惕进展风险。',
      '## 建议\n\n1. 优先开展多标记 IHC 或分子检测，确认是否存在明确驱动事件。\n2. 如进入治疗，设 6–8 周短周期复评，监控抑制效果与耐受性。\n3. 结合影像及临床症状，必要时增加炎症/纤维化评分以排除背景干扰。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-07',
    displayName: '周敏',
    sourceImage: path.join(SOURCE_DIR, 'image106.jpeg'),
    raw: {
      pos_cells_1_weak: 1500,
      pos_cells_2_moderate: 3000,
      pos_cells_3_strong: 2500,
      iod_total_cells: 10_200,
      positive_area_mm2: 1.35,
      tissue_area_mm2: 2.05,
      positive_area_px: 2_500_000,
      tissue_area_px: 6_400_000,
      positive_intensity: 1.83,
    },
    derived: {
      positive_cells_ratio: 68.63,
      positive_cells_density: 0.095,
      mean_density: 0.105,
      h_score: 176,
      irs: 8,
    },
    ai: [
      '## 预测概述\n\n阳性比率约 69%，弱阳性略多，中强阳性均衡，光密度 0.105、正强度 1.83，整体活性中等偏高但未到饱和。',
      '## 深度推理\n\n- 组织面积 2.05 mm²，覆盖平衡，统计稳定。\n- 空间异质性有限，强阳性未形成大片聚集，提示信号更可能由整体背景驱动。\n- H-Score 176 与 IRS 8 处于中高区，提示有生物学效应但尚不极端。',
      '## 建议\n\n1. 持续随访，若担心异质性可增加分层取样或多点扫描。\n2. 与炎症/代谢指标联读，区分通路活化与背景炎症因素。\n3. 如需干预，建议先完成基线影像与分子检测，制定 8–10 周复评计划。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-08',
    displayName: '陈磊',
    sourceImage: path.join(SOURCE_DIR, 'image107.jpeg'),
    raw: {
      pos_cells_1_weak: 700,
      pos_cells_2_moderate: 3100,
      pos_cells_3_strong: 2200,
      iod_total_cells: 8900,
      positive_area_mm2: 1.18,
      tissue_area_mm2: 1.92,
      positive_area_px: 2_150_000,
      tissue_area_px: 6_000_000,
      positive_intensity: 1.75,
    },
    derived: {
      positive_cells_ratio: 67.42,
      positive_cells_density: 0.089,
      mean_density: 0.095,
      h_score: 171,
      irs: 7,
    },
    ai: [
      '## 预测概述\n\n阳性比率约 67%，中度阳性主导，光密度 0.095、正强度 1.75，信号处于稳定中段，背景干净。',
      '## 深度推理\n\n- 弱阳性较少，中强阳性主导，说明上游激活较均衡而非噪声驱动。\n- 组织面积 1.92 mm²，统计可靠，未见明显伪影。\n- H-Score 171，IRS 7，提示存在生物学效应但远未到高饱和。',
      '## 建议\n\n1. 与分子标志物联合，验证通路持续性并评估潜在靶点。\n2. 保持 2–3 个月随访频率，观测比率/光密度变化趋势。\n3. 若进入治疗，建议记录同位点基线，便于纵向对比。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-09',
    displayName: '杨梅',
    sourceImage: path.join(SOURCE_DIR, 'image108.jpeg'),
    raw: {
      pos_cells_1_weak: 1300,
      pos_cells_2_moderate: 4200,
      pos_cells_3_strong: 3600,
      iod_total_cells: 12_600,
      positive_area_mm2: 1.9,
      tissue_area_mm2: 2.55,
      positive_area_px: 3_850_000,
      tissue_area_px: 7_500_000,
      positive_intensity: 2.18,
    },
    derived: {
      positive_cells_ratio: 72.22,
      positive_cells_density: 0.115,
      mean_density: 0.13,
      h_score: 218,
      irs: 11,
    },
    ai: [
      '## 预测概述\n\n阳性比率超 72%，强阳性显著，光密度 0.13、正强度 2.18，提示通路处于高激活阶段，可能存在明确驱动事件。',
      '## 深度推理\n\n- 强阳性 3600 个，与中度接近，信号已在高平台运作。\n- 组织面积 2.55 mm²、总细胞 1.26 万，定量可信，可排除取样偏差。\n- H-Score 218、IRS 11 处于高位，需警惕进展或侵袭性表现。',
      '## 建议\n\n1. 立即补充分子检测（突变/拷贝数/融合），明确靶点与驱动路径。\n2. 若进入治疗，设 4–6 周短周期复评，监控抑制效果与耐受性。\n3. 建议多标记共定位或空间转录组，评估高活性区域与微环境关系。',
    ],
  },
  {
    identifier: 'DEMO-TEXT-10',
    displayName: '孙伟',
    sourceImage: path.join(SOURCE_DIR, 'image10.jpeg'),
    raw: {
      pos_cells_1_weak: 1100,
      pos_cells_2_moderate: 2800,
      pos_cells_3_strong: 2400,
      iod_total_cells: 9600,
      positive_area_mm2: 1.08,
      tissue_area_mm2: 1.75,
      positive_area_px: 1_980_000,
      tissue_area_px: 6_050_000,
      positive_intensity: 1.74,
    },
    derived: {
      positive_cells_ratio: 65.63,
      positive_cells_density: 0.086,
      mean_density: 0.09,
      h_score: 164,
      irs: 6,
    },
    ai: [
      '## 预测概述\n\n阳性比率约 66%，中度与强阳性均衡，光密度 0.09、正强度 1.74，提示稳定的中等活性水平，可作长期基线。',
      '## 深度推理\n\n- 组织面积 1.75 mm²，覆盖适中，未见大片伪影或坏死。\n- 强阳性聚集度有限，分布均衡，说明信号可能受整体背景而非局灶克隆驱动。\n- H-Score 164、IRS 6 处中区，便于后续观测升降趋势。',
      '## 建议\n\n1. 作为基线样本保留，治疗/随访中在同位点或相邻位点复采对比。\n2. 结合影像和临床症状决定复查频率；若指标上升，提前复评。\n3. 可与血清或分子标记联合，提升对进展或缓解的敏感度。',
    ],
  },
]

async function main() {
  console.log('为 10 个 DEMO-TEXT 病例写入组织切片样本与分析数据...')
  await Promise.all([ensureSampleTissueAnalysisTable(), ensureCaseReportsTable(), ensureDir(UPLOADS_DIR)])

  for (const seed of SEEDS) {
    try {
      const images = await prepareImages(seed)
      const checksum = await checksumFile(images.rawAbs)
      const filename = path.basename(images.rawPublic)
      const caseRow = await upsertCase(seed.identifier, seed.displayName)
      const sampleRow = await upsertSample(caseRow.id, seed.identifier, images.rawPublic, checksum, filename)
      await upsertAnalysis(sampleRow.id, seed, { rawAbs: images.rawAbs, parsedAbs: images.parsedAbs })
      console.log(`完成 ${seed.identifier} (${seed.displayName})`)
    } catch (err) {
      console.error(`处理 ${seed.identifier} 失败:`, err)
      throw err
    }
  }

  console.log('写入完成')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
