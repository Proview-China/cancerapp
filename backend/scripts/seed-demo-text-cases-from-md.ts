import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db/pool.js'
import { ensureCaseReportsTable } from '../src/db/init.js'
import { DEMO_TEXT_CASES, type DemoSectionKey, type DemoTextCaseConfig } from '../src/demo/demoTextCasesConfig.js'

type ReportInput = {
  title: string
  summary?: string
  content: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

// 默认从用户 Desktop 下的 01-10 目录读取 Markdown，
// 以适配当前项目实际放置路径：
//   /home/<user>/Desktop/01-10
// 也可以通过环境变量 DEMO_TEXT_CASES_ROOT 覆盖
const DEFAULT_DESKTOP_ROOT = path.resolve(process.env.HOME ?? path.resolve(ROOT, '..', '..'), 'Desktop', '01-10')
const CASES_ROOT = process.env.DEMO_TEXT_CASES_ROOT ?? DEFAULT_DESKTOP_ROOT

const CASES: DemoTextCaseConfig[] = DEMO_TEXT_CASES

const readMarkdown = async (filePath: string): Promise<string> => {
  const text = await fsp.readFile(filePath, 'utf8')
  return text
}

const SECTION_LABELS: Record<DemoSectionKey, string> = {
  overview: '总体概述',
  guideline: '指南诊断分析',
  testing: '检测与病理/分子分析',
  treatment: '治疗方案与随访计划',
}

const buildReportsForCase = (
  cfg: DemoTextCaseConfig,
  texts: { overview: string; guideline: string; testing: string; treatment: string },
): ReportInput[] => {
  const code = String(cfg.index).padStart(2, '0')
  const baseTag = `demo-case-${code}`
  const summaries = cfg.summaries

  return [
    {
      title: SECTION_LABELS.overview,
      summary: summaries.overview,
      content: texts.overview,
      tags: ['demo', 'overview', baseTag],
    },
    {
      title: SECTION_LABELS.guideline,
      summary: summaries.guideline,
      content: texts.guideline,
      tags: ['demo', 'guideline', baseTag],
    },
    {
      title: SECTION_LABELS.testing,
      summary: summaries.testing,
      content: texts.testing,
      tags: ['demo', 'testing', baseTag],
    },
    {
      title: SECTION_LABELS.treatment,
      summary: summaries.treatment,
      content: texts.treatment,
      tags: ['demo', 'treatment', baseTag],
    },
  ]
}

const upsertCase = async (cfg: DemoTextCaseConfig) => {
  const notes = 'Demo text case seeded from markdown (demo-text-md)'
  const metadata = { source: 'demo-text-md' }
  const result = await pool.query(
    `INSERT INTO cases (identifier, display_name, notes, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (identifier) DO UPDATE
     SET display_name = COALESCE(EXCLUDED.display_name, cases.display_name),
         notes = EXCLUDED.notes,
         metadata = cases.metadata || EXCLUDED.metadata,
         updated_at = NOW()
     RETURNING *`,
    [cfg.identifier, cfg.displayName, notes, metadata],
  )
  return result.rows[0] as { id: string }
}

const replaceReportsForCase = async (caseId: string, reports: ReportInput[]) => {
  // 删除旧的 demo-text-md 报告
  await pool.query(`DELETE FROM case_reports WHERE case_id = $1 AND metadata->>'source' = 'demo-text-md'`, [caseId])

  for (const report of reports) {
    const metadata = {
      ...(report.metadata ?? {}),
      source: 'demo-text-md',
    }
    await pool.query(
      `INSERT INTO case_reports (case_id, title, summary, content, tags, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [caseId, report.title, report.summary ?? null, report.content, report.tags ?? [], metadata],
    )
  }
}

async function main() {
  console.log('使用 Markdown 种子 demo 文字病例...')
  console.log('CASES_ROOT =', CASES_ROOT)

  if (!fs.existsSync(CASES_ROOT)) {
    console.error('指定的 DEMO_TEXT_CASES_ROOT/默认目录不存在：', CASES_ROOT)
    process.exitCode = 1
    return
  }

  await ensureCaseReportsTable()

  // 清理旧的 demo 文本（来自早期 seed-demo 脚本）
  // 保留非 demo 的真实病例文书
  try {
    const result = await pool.query(`DELETE FROM case_reports WHERE metadata->>'source' = 'demo'`)
    if (result.rowCount) {
      console.log(`已删除旧 demo 文本记录 ${result.rowCount} 条（metadata.source = 'demo'）`)
    }
  } catch (error) {
    console.warn('清理旧 demo 文本失败（可忽略）：', error)
  }

  for (const cfg of CASES) {
    const code = String(cfg.index).padStart(2, '0')
    const dir = path.join(CASES_ROOT, code)

    if (!fs.existsSync(dir)) {
      console.warn('跳过，病例目录不存在：', dir)
      continue
    }

    const overviewPath = path.join(dir, `${code}_case_overview.md`)
    const guidelinePath = path.join(dir, `${code}_guideline_diagnosis.md`)
    const testingPath1 = path.join(dir, `${code}_testing_pathology_molecular.md`)
    const testingPath2 = path.join(dir, `${code}_testing_strategy.md`)
    const treatmentPath = path.join(dir, `${code}_treatment_plan.md`)

    const testingPath = fs.existsSync(testingPath1) ? testingPath1 : testingPath2

    if (!fs.existsSync(overviewPath) || !fs.existsSync(guidelinePath) || !fs.existsSync(testingPath) || !fs.existsSync(treatmentPath)) {
      console.warn('跳过，病例文件不完整：', {
        dir,
        overview: fs.existsSync(overviewPath),
        guideline: fs.existsSync(guidelinePath),
        testing: fs.existsSync(testingPath),
        treatment: fs.existsSync(treatmentPath),
      })
      continue
    }

    const [overview, guideline, testing, treatment] = await Promise.all([
      readMarkdown(overviewPath),
      readMarkdown(guidelinePath),
      readMarkdown(testingPath),
      readMarkdown(treatmentPath),
    ])

    const docs = buildReportsForCase(cfg, { overview, guideline, testing, treatment })
    const caseRow = await upsertCase(cfg)
    await replaceReportsForCase(caseRow.id, docs)

    console.log(`已为病例 ${code} (${cfg.identifier}) 写入 ${docs.length} 条文字病历`)
  }

  console.log('demo 文本病例写入完成')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
