import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db/pool.js'
import { DEMO_TEXT_CASES } from '../src/demo/demoTextCasesConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

// 默认桌面路径：~/Desktop
const DEFAULT_DESKTOP_ROOT = path.resolve(process.env.HOME ?? path.resolve(ROOT, '..', '..'), 'Desktop')
const DESKTOP_ROOT = process.env.DEMO_CT_MRI_ROOT ?? DEFAULT_DESKTOP_ROOT

const UPLOADS_DIR = path.join(ROOT, 'uploads')

const ensureUploadsDir = async () => {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true })
}

const checksumFile = async (file: string) => {
  const buf = await fsp.readFile(file)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

const copyToUploads = async (src: string, targetBase: string) => {
  await ensureUploadsDir()
  const ext = path.extname(src) || '.png'
  const filename = `${targetBase}${ext}`
  const dest = path.join(UPLOADS_DIR, filename)
  await fsp.copyFile(src, dest)
  return { filename, abs: dest }
}

const upsertCase = async (identifier: string) => {
  const r = await pool.query(
    `INSERT INTO cases (identifier)
     VALUES ($1)
     ON CONFLICT (identifier) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [identifier],
  )
  return r.rows[0] as { id: string }
}

const upsertImagingSample = async (
  caseId: string,
  identifier: string,
  modality: 'CT片' | '核磁共振片',
  src: string,
  kind: 'CT' | 'MRI',
) => {
  const baseName = `${identifier}_${kind}_1`
  const copied = await copyToUploads(src, baseName)
  const storagePath = `/uploads/${copied.filename}`
  const checksum = await checksumFile(copied.abs)

  const exists = await pool.query(
    `SELECT * FROM case_samples
     WHERE case_id = $1 AND original_filename = $2
     LIMIT 1`,
    [caseId, copied.filename],
  )

  if (exists.rowCount > 0) {
    const row = exists.rows[0]
    const upd = await pool.query(
      `UPDATE case_samples
       SET modality = $2,
           description = $3,
           storage_path = $4,
           storage_thumbnail = $4,
           checksum = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [row.id, modality, `${identifier} ${modality}`, storagePath, checksum],
    )
    return upd.rows[0]
  }

  const ins = await pool.query(
    `INSERT INTO case_samples
       (case_id, modality, description, original_filename, storage_path, storage_thumbnail, checksum)
     VALUES ($1, $2, $3, $4, $5, $5, $6)
     RETURNING *`,
    [caseId, modality, `${identifier} ${modality}`, copied.filename, storagePath, checksum],
  )
  return ins.rows[0]
}

const findImageForIndex = (index: number, suffix: 'q' | 's') => {
  const base = String(index)
  const candidates = [`${base}${suffix}.png`, `${base}${suffix}.jpeg`, `${base}${suffix}.jpg`]
  for (const name of candidates) {
    const full = path.join(DESKTOP_ROOT, name)
    if (fs.existsSync(full)) return full
  }
  return null
}

const buildRiskSummary = (idx: number) => {
  if (idx <= 3) return '以局灶病灶为主的中早期风险'
  if (idx <= 7) return '以多灶或伴基础疾病为特征的中度复杂风险'
  return '肿瘤负荷或系统累及偏重的高危模式'
}

const buildCtMarkdown = (idx: number, displayName: string) => {
  const summary = buildRiskSummary(idx)
  const lines = [
    '## 影像预测概述（CT）',
    '',
    `- 平扫/增强 CT 显示病灶边界${idx <= 4 ? '相对清晰，以局灶结节或小片状为主' : idx <= 7 ? '部分模糊，部分区域与周围实质界面欠清' : '不规则，范围较广，提示可能存在多灶或大片累及' }。`,
    `- 灰度与强化模式与该患者（${displayName}）在文字病历中的原发病情基本吻合，整体属于：${summary}。`,
    '',
    '## 深度推理',
    '',
    '- 病灶与邻近血管、胆道或支气管的空间关系可辨认，为后续外科/介入路径规划提供了较好的解剖基础。',
    '- 动脉期/门静脉期强化方式与典型肿瘤模式相近，可与文字病历中的病理分型和分期相互印证。',
    '- 未见大面积条状伪影或明显运动伪影，提示本次 CT 检查技术质量整体可接受。',
    '',
    '## 建议',
    '',
    '- 建议在 3–6 个月内按相同扫描方案复查一次，以评估病灶体积、密度与强化模式的演变趋势。',
    '- 如已拟定手术或介入治疗方案，可将当前 CT 作为术前/术后随访的几何基线，建议同时保留完整 DICOM 数据和关键层面截图。',
    '- 对于合并肝肾功能异常或基础心血管疾病者，建议在复查 CT 前后同步监测相关实验室指标并评估治疗耐受性。',
  ]
  return lines.join('\n')
}

const buildMriMarkdown = (idx: number, displayName: string) => {
  const summary = buildRiskSummary(idx)
  const signal = idx % 2 === 0 ? '以中高信号为主' : '呈混杂信号，内部可见信号不均'
  const lines = [
    '## 影像预测概述（MRI）',
    '',
    `- 在 T2 及弥散加权序列上病灶 ${signal}，增强后呈${idx <= 5 ? '进行性强化' : '边缘强化或不均匀强化'}，与文字病历所述原发病灶特征基本一致。`,
    `- 结合该病例（${displayName}）的既往病史与治疗背景，整体仍归入：${summary}。`,
    '',
    '## 深度推理',
    '',
    '- MRI 对软组织对比度更敏感，有助于区分肿瘤实质、坏死区及周围炎性反应，为后续局部治疗边界的判定提供参考。',
    '- 弥散受限区域与增强后高信号区域大致重叠，增加了病灶活动性的可信度，降低了简单缺血/炎症导致假阳性的可能性。',
    '- 未观察到明显磁敏感伪影或严重运动伪影，说明本次检查在技术层面满足随访和定量评估的需要。',
    '',
    '## 建议',
    '',
    '- 建议将当前 MRI 作为后续功能成像（如 DWI、动态增强）随访的基线，以便更早识别微小进展或治疗反应。',
    '- 如计划进行放疗或局部消融，可在本次 MRI 基础上进行靶区勾画，并与 CT/组织学信息进行三方比对。',
    '- 对高危或已接受系统治疗的患者，建议在复查周期内结合肿瘤标志物和症状评分，综合判定疾病活动度。',
  ]
  return lines.join('\n')
}

async function main() {
  console.log('为 DEMO-TEXT-01~10 写入 CT/核磁共振样本...')
  console.log('DESKTOP_ROOT =', DESKTOP_ROOT)

  if (!fs.existsSync(DESKTOP_ROOT)) {
    console.error('桌面目录不存在：', DESKTOP_ROOT)
    process.exitCode = 1
    return
  }

  for (const cfg of DEMO_TEXT_CASES) {
    const idx = cfg.index
    // 约定：Ns 为 CT，Nq 为核磁共振
    const ctSrc = findImageForIndex(idx, 's')
    const mriSrc = findImageForIndex(idx, 'q')

    if (!ctSrc || !mriSrc) {
      console.warn('跳过，未找到完整 CT/MRI 图像：', {
        index: idx,
        identifier: cfg.identifier,
        ct: !!ctSrc,
        mri: !!mriSrc,
      })
      continue
    }

    const caseRow = await upsertCase(cfg.identifier)
    const ctSample = await upsertImagingSample(caseRow.id, cfg.identifier, 'CT片', ctSrc, 'CT')
    const mriSample = await upsertImagingSample(caseRow.id, cfg.identifier, '核磁共振片', mriSrc, 'MRI')

    // 清理旧的影像预测文书（包含旧版合并 CT/MRI 的 demo-ct-mri）
    await pool.query(
      `DELETE FROM case_reports
       WHERE case_id = $1 AND metadata->>'source' IN ('demo-ct', 'demo-mri', 'demo-ct-mri')`,
      [caseRow.id],
    )

    const ctContent = buildCtMarkdown(idx, cfg.displayName)
    const mriContent = buildMriMarkdown(idx, cfg.displayName)

    await pool.query(
      `INSERT INTO case_reports (case_id, title, summary, content, tags, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        caseRow.id,
        'CT 影像预测与建议',
        '基于当前 CT 图像的结构特征，对病灶风险与随访策略进行初步评估。',
        ctContent,
        ['demo', 'imaging', 'ct', `demo-case-${String(idx).padStart(2, '0')}`],
        { source: 'demo-ct', sampleId: ctSample.id },
      ],
    )

    await pool.query(
      `INSERT INTO case_reports (case_id, title, summary, content, tags, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        caseRow.id,
        'MRI 影像预测与建议',
        '基于当前核磁共振图像的信号与强化模式，对病灶活动度与随访策略进行初步分析。',
        mriContent,
        ['demo', 'imaging', 'mri', `demo-case-${String(idx).padStart(2, '0')}`],
        { source: 'demo-mri', sampleId: mriSample.id },
      ],
    )

    console.log(`完成病例 ${cfg.identifier} (index=${idx}) 的 CT/MRI 导入与单独影像建议写入`)
  }

  console.log('CT/MRI 导入完成')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
