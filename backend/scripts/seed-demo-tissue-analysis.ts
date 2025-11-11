import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import crypto from 'node:crypto'
import { pool } from '../src/db/pool.js'
import { ensureSampleTissueAnalysisTable, ensureCaseReportsTable } from '../src/db/init.js'

type ParsedOriginal = {
  pos_cells_1_weak?: number
  pos_cells_2_moderate?: number
  pos_cells_3_strong?: number
  total_cells_number?: number
  positive_area_mm2?: number
  tissue_area_mm2?: number
  positive_area_px?: number
  tissue_area_px?: number
  positive_intensity?: number
  iod_value?: number
}

type ParsedRecognition = {
  positive_cells_ratio?: number
  positive_cells_density?: number
  mean_density?: number
  h_score?: number
  irs?: number
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const DEMO_DIR = path.join(ROOT, 'demo_fake')
const UPLOADS_DIR = path.join(ROOT, 'uploads')

const CASES = ['BIOBANK-F10', 'BIOBANK-F11', 'BIOBANK-F13']

const parseNumber = (input: string) => {
  const cleaned = input.trim().replace(/%$/, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

const parseOriginalTxt = async (file: string): Promise<ParsedOriginal> => {
  const text = await fs.readFile(file, 'utf8')
  const lines = text.split(/\r?\n/) // 某些末尾可能为空
  const result: ParsedOriginal = {}
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const [keyPart, valuePart] = line.split('=')
    if (!valuePart) continue
    const key = keyPart.trim()
    const value = valuePart.trim()
    if (key.includes('1级弱阳性') || key.includes('Positive Cells 1 Weak')) result.pos_cells_1_weak = parseNumber(value)
    else if (key.includes('2级中度阳性') || key.includes('Positive Cells 2 Moderate'))
      result.pos_cells_2_moderate = parseNumber(value)
    else if (key.includes('3级强阳性') || key.includes('Positive Cells 3 Strong'))
      result.pos_cells_3_strong = parseNumber(value)
    else if (key === 'IOD') result.iod_value = parseNumber(value)
    else if (key.includes('细胞总数') || key.includes('Total Cells Number')) result.total_cells_number = parseNumber(value)
    else if (key.includes('Positive Area, mm²')) result.positive_area_mm2 = parseNumber(value)
    else if (key.includes('Tissue Area, mm²')) result.tissue_area_mm2 = parseNumber(value)
    else if (key.includes('Positive Area, pixel')) result.positive_area_px = parseNumber(value)
    else if (key.includes('Tissue Area, pixel')) result.tissue_area_px = parseNumber(value)
    else if (key.includes('Positive Intensity')) result.positive_intensity = parseNumber(value)
  }
  return result
}

const parseRecognitionTxt = async (file: string): Promise<ParsedRecognition> => {
  const text = await fs.readFile(file, 'utf8')
  const lines = text.split(/\r?\n/)
  const result: ParsedRecognition = {}
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const [keyPart, valuePart] = line.split('=')
    if (!valuePart) continue
    const key = keyPart.trim()
    const value = valuePart.trim()
    // 避免 "Positive Cells Density" 误匹配为比率
    if (key.includes('阳性细胞比率') || key.includes('Positive Cells, %')) result.positive_cells_ratio = parseNumber(value)
    else if (key.includes('阳性细胞密度') || key.includes('Density')) result.positive_cells_density = parseNumber(value)
    else if (key.includes('平均光密度值') || key.includes('Mean Density')) result.mean_density = parseNumber(value)
    else if (key.includes('H-Score')) result.h_score = parseNumber(value)
    else if (key.includes('IRS')) result.irs = parseNumber(value)
  }
  return result
}

const ensureUploadsDir = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
}

const copyToUploads = async (src: string, targetBase: string) => {
  await ensureUploadsDir()
  const ext = path.extname(src)
  const filename = `${targetBase}${ext}`
  const dest = path.join(UPLOADS_DIR, filename)
  await fs.copyFile(src, dest)
  return { filename, abs: dest }
}

const checksumFile = async (file: string) => {
  const buf = await fs.readFile(file)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

async function upsertCase(identifier: string) {
  const r = await pool.query(
    `INSERT INTO cases (identifier) VALUES ($1)
     ON CONFLICT (identifier) DO UPDATE SET updated_at = NOW() RETURNING *`,
    [identifier],
  )
  return r.rows[0]
}

async function upsertSample(caseId: string, identifier: string, srcImage: string) {
  const baseName = `${identifier}_组织切片_1`
  const copied = await copyToUploads(srcImage, baseName)
  const storagePublic = `/uploads/${copied.filename}`
  const cs = await checksumFile(copied.abs)
  const exists = await pool.query(
    `SELECT * FROM case_samples WHERE case_id = $1 AND modality = '组织切片' LIMIT 1`,
    [caseId],
  )
  if (exists.rowCount > 0) {
    const row = exists.rows[0]
    const upd = await pool.query(
      `UPDATE case_samples SET description = $1, original_filename = $2, storage_path = $3, storage_thumbnail = $3, checksum = $4, updated_at = NOW() WHERE id = $5 RETURNING *`,
      [`${identifier} 组织切片`, copied.filename, storagePublic, cs, row.id],
    )
    return upd.rows[0]
  }
  const ins = await pool.query(
    `INSERT INTO case_samples (case_id, modality, description, original_filename, storage_path, storage_thumbnail, checksum)
     VALUES ($1, '组织切片', $2, $3, $4, $4, $5) RETURNING *`,
    [caseId, `${identifier} 组织切片`, copied.filename, storagePublic, cs],
  )
  return ins.rows[0]
}

async function upsertAnalysis(sampleId: string, original: ParsedOriginal, recog: ParsedRecognition, paths: { raw: string; parsed: string }) {
  // 指定三例的平均光密度值映射（以演示为准）
  const identifierFromPath = (p: string) => path.basename(path.dirname(p))
  const id = identifierFromPath(paths.raw)
  const meanMap: Record<string, number> = {
    'BIOBANK-F10': 0.0820,
    'BIOBANK-F11': 0.1209,
    'BIOBANK-F13': 0.0875,
  }
  const forcedMean = meanMap[id]
  const payload = {
    pos_cells_1_weak: original.pos_cells_1_weak ?? null,
    pos_cells_2_moderate: original.pos_cells_2_moderate ?? null,
    pos_cells_3_strong: original.pos_cells_3_strong ?? null,
    iod_total_cells: original.total_cells_number ?? null,
    positive_area_mm2: original.positive_area_mm2 ?? null,
    tissue_area_mm2: original.tissue_area_mm2 ?? null,
    positive_area_px: original.positive_area_px ?? null,
    tissue_area_px: original.tissue_area_px ?? null,
    positive_intensity: original.positive_intensity ?? null,
    positive_cells_ratio: recog.positive_cells_ratio ?? null,
    positive_cells_density: recog.positive_cells_density ?? null,
    mean_density: forcedMean ?? recog.mean_density ?? null,
    h_score: recog.h_score ?? null,
    irs: recog.irs ?? null,
    raw_image_path: paths.raw,
    parsed_image_path: paths.parsed,
    metadata: JSON.stringify({
      source: 'demo',
      iod: original.iod_value ?? null,
      ai: generateAIMarkdownFor(id),
    }),
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

function generateAIMarkdownFor(id: string): string[] {
  if (id === 'BIOBANK-F10') {
    return [
      `## 预测概述\n\n该切片免疫染色呈弥散性中弱阳性，阴性背景清晰，阳性细胞主要局灶分布于腺体周缘与间质交界区。结合定量指标（阳性细胞比率 77.70%、密度 0.082/mm²、H-Score 157），提示信号通路存在持续而较温和的激活状态。`,
      `## 深度推理\n\n- 弱/中度染色细胞占比高于强阳性，提示总体活性受限于上游配体或受体数量，而非下游放大环节。\n- 组织结构保存良好，无明显坏死或出血，像素级阳性面积与组织面积匹配，排除了显著的取样偏倚。\n- 若合并轻度纤维化或慢性炎症史，建议联合炎症评分评估免疫微环境对染色的影响。`,
      `## 建议\n\n1. 建议 4–6 周后复检或在相邻区域重复采样，以确认通路活性稳定性。\n2. 可与下游磷酸化位点或转录因子核定位免疫标记联合验证。\n3. 临床上关注肝、胆、胰相关生化与肿瘤标志物动态，避免单点结论过度解释。`,
    ]
  }
  if (id === 'BIOBANK-F11') {
    return [
      `## 预测概述\n\n切片表现为中高强度阳性，阳性细胞比率 83.67%、密度 0.121/mm²、H-Score 204，提示通路激活水平较高并具有一定持续性。阳性区域以腺体上皮及其相邻基质为主，呈带状或片状分布。`,
      `## 深度推理\n\n- 以中强阳性为主，提示信号转导处于相对饱和区间，可能与驱动突变或上游配体过量有关。\n- 若合并 Ki-67 增高或分裂象活跃，需警惕增殖相关风险。\n- IOD 与细胞总数匹配，说明测量范围覆盖充分，定量可信。`,
      `## 建议\n\n1. 建议开展多标记 IHC 或免疫荧光共定位，验证与增殖/凋亡/迁移相关指标的耦合。\n2. 临床路径上可考虑影像学随访与分子检测（如突变/拷贝数），以判断是否存在驱动事件。\n3. 如拟定治疗策略，优先评估耐受性并设置 6–8 周动态复评节点。`,
    ]
  }
  // BIOBANK-F13
  return [
    `## 预测概述\n\n标本呈中度阳性为主，阳性细胞比率 87.91%、密度 0.0875/mm²、H-Score 179，阳性像素分布均匀，提示通路激活较为广泛但峰值强度有限。`,
    `## 深度推理\n\n- 中度阳性比例高且区域广，提示整体背景激活而非少数强阳性克隆主导。\n- 结合组织学形态与像素级面积，可排除大范围坏死或压片伪影造成的误判。\n- IRS 得分为 8，倾向临床可观测的生物学效应，但仍需纵向追踪。`,
    `## 建议\n\n1. 建议在同一病例的不同取材面增加取样点位，形成空间分布剖面。\n2. 与炎症/纤维化评分、肿瘤微环境细胞谱（如TILs）联合评估。\n3. 设定 3 个月随访，与影像学进展及症状量表共同判定疗效与风险。`,
  ]
}

async function upsertReports(caseId: string, identifier: string) {
  const docs = generateCaseDocuments(identifier)
  for (const doc of docs) {
    // 避免重复：按标题查重
    const exists = await pool.query(
      `SELECT id FROM case_reports WHERE case_id = $1 AND title = $2 LIMIT 1`,
      [caseId, doc.title],
    )
    if (exists.rowCount > 0) continue
    await pool.query(
      `INSERT INTO case_reports (case_id, title, summary, content, tags, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)` ,
      [caseId, doc.title, doc.summary, doc.content, doc.tags, JSON.stringify({ source: 'demo' })],
    )
  }
}

type Doc = { title: string; summary: string; content: string; tags: string[] }

function generateCaseDocuments(identifier: string): Doc[] {
  // 每个病例 4 篇示例文书（病程/会诊/检验解读/出院小结各一）
  const commonTags = ['demo', '文字病历']
  if (identifier === 'BIOBANK-F10') {
    return [
      { title: '门诊初诊病程记录', summary: '右上腹隐痛半年，近一月加重。', tags: [...commonTags, '病程'], content: `主诉：右上腹隐痛半年，近一月加重。\n\n现病史：间歇性右上腹不适，餐后加重，无寒战高热，无黑便。体检：右上腹轻压痛，无反跳痛。实验室：肝功能轻度异常，血清肿瘤标志物边缘升高。影像学：肝右叶见占位，边界尚清。组织学：针吸活检，上皮样细胞排列，间质轻度炎性浸润。免疫染色本次为弥散性中弱阳性。\n\n初步评估：倾向惰性进展，建议完善分子检测与多学科讨论。治疗建议：对症支持，暂不化疗；4–6 周复评 IHC 与影像。` },
      { title: '检验及影像结果解读', summary: 'IHC 中弱阳性为主，通路激活水平较低。', tags: [...commonTags, '检验解读'], content: `IHC 显示阳性细胞比率 77.70%，密度 0.082/mm²，H-Score 157。阳性像素面积与组织面积比例合理，提示测量范围覆盖充分。影像学未见广泛坏死或血供破坏。综合判断：信号通路存在持续但温和的激活，短期内进展风险有限。建议与转录因子核定位或磷酸化位点联合验证，以提高特异性。` },
      { title: '多学科会诊意见', summary: '建议随访评估，暂不进入系统治疗。', tags: [...commonTags, 'MDT'], content: `MDT 讨论要点：IHC 为中弱阳性；组织学结构完整；影像未见明确侵犯邻近结构。综合意见：以动态监测为主，设置 6–8 周复评节点；如分子检测提示驱动事件再评估系统治疗。营养与运动指导：高蛋白高纤维饮食，避免过度劳累。` },
      { title: '出院/随访小结（首次）', summary: '病情稳定，居家随访。', tags: [...commonTags, '随访'], content: `患者症状较前稳定，实验室与影像暂未见明显进展。IHC 指标与上次基本一致。计划：3 个月内复查影像与 IHC；如出现黄疸、体重下降或持续疼痛等警示症状，提前就诊。` },
    ]
  }
  if (identifier === 'BIOBANK-F11') {
    return [
      { title: '入院评估病程记录', summary: '上腹胀痛 3 月，消瘦 5 kg。', tags: [...commonTags, '病程'], content: `主诉：上腹胀痛 3 月，体重下降 5 kg。\n\n现病史：餐后饱胀不适，夜间偶有阵发痛，纳差。实验室：肝酶轻至中度升高，炎性指标轻度增高。影像：肝叶内见强化不均的结节影。病理：腺体样结构，核异质性中等。IHC 中高强阳性，H-Score 204。\n\n评估：考虑通路活化显著，可能伴有驱动突变。建议完善分子检测与肿瘤负荷评估。` },
      { title: '检验结果多学科解读', summary: 'IHC 强度较高，建议与增殖标志联合。', tags: [...commonTags, 'MDT'], content: `IHC：阳性细胞比率 83.67%，密度 0.121/mm²，H-Score 204。Ki-67 较高，提示增殖活跃。影像提示病灶边界欠清，需排除浸润。MDT 建议：进行多标记免疫荧光共定位，评估与增殖、凋亡、迁移相关指标的耦合关系；必要时行 PET-CT 明确代谢活性。` },
      { title: '治疗方案讨论记录', summary: '推荐随访+有条件的靶向/临床试验评估。', tags: [...commonTags, '治疗计划'], content: `在患者总体状况允许情况下，建议以观察与评估为主；若分子检测发现靶点，可进入靶向治疗或临床试验通道。治疗前需完善心肝肾功能评估并建立基线。随访节点：6–8 周复评 IHC 与影像。` },
      { title: '阶段性随访小结', summary: '通路活性仍高，症状控制尚可。', tags: [...commonTags, '随访'], content: `本次随访患者主诉症状较前略减，肝功能波动。影像提示病灶无显著扩大。IHC 仍为中高强度阳性。建议继续监测，必要时进行短程干预并评估疗效。` },
    ]
  }
  // BIOBANK-F13
  return [
    { title: '门急诊就诊记录', summary: '体检发现肝内结节，无明显症状。', tags: [...commonTags, '病程'], content: `因体检发现肝内结节来诊，无明显消化道症状。实验室：肝酶正常或轻度异常，炎性指标阴性。影像：肝内散在结节影。IHC 中度阳性，H-Score 179。综合判断：通路激活广泛但峰值强度有限，短期侵袭风险低。` },
    { title: '影像与病理会诊意见', summary: '建议扩大取样与空间分布评估。', tags: [...commonTags, '会诊'], content: `影像显示病灶分布多发，边界尚清；病理提示中度阳性为主。建议在不同扇区追加取样，构建空间分布剖面，评估是否存在异质性克隆。` },
    { title: '检查结果归纳解读', summary: '像素级阳性面积与组织面积匹配。', tags: [...commonTags, '检验解读'], content: `IHC：阳性细胞比率 87.91%，密度 0.0875/mm²，H-Score 179，阳性像素分布相对均匀。与组织面积比例匹配，排除大范围坏死与压片伪影。结论：整体背景激活明显，建议纵向追踪。` },
    { title: '出院/随访计划', summary: '3 个月随访，必要时加做分子检测。', tags: [...commonTags, '随访'], content: `建议 3 个月复查影像及 IHC；如出现疼痛加重、体重下降、黄疸或肝功异常等情况提前复诊。可考虑进行分子检测以明确驱动事件并指导后续个体化治疗。` },
  ]
}

async function main() {
  await ensureSampleTissueAnalysisTable()
  await ensureCaseReportsTable()
  for (const id of CASES) {
    const dir = path.join(DEMO_DIR, id)
    const origTxt = path.join(dir, 'Oringinal.txt')
    const recogTxt = path.join(dir, 'Recognition.txt')
    const rawJpg = path.join(dir, `${id}-Oringinal.jpg`)
    const parsedJpg = path.join(dir, `${id}-Recognition.jpg`)

    if (!fsSync.existsSync(dir)) {
      console.warn('跳过，目录不存在：', dir)
      continue
    }
    const [orig, recog] = await Promise.all([parseOriginalTxt(origTxt), parseRecognitionTxt(recogTxt)])

    const caseRow = await upsertCase(id)
    const sampleRow = await upsertSample(caseRow.id, id, rawJpg)
    await upsertAnalysis(sampleRow.id, orig, recog, { raw: rawJpg, parsed: parsedJpg })
    await upsertReports(caseRow.id, id)
    console.log('Seeded:', id)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
