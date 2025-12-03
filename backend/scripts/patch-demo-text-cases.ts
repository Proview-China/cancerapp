import { pool } from '../src/db/pool.js'
import { ensureCaseReportsTable } from '../src/db/init.js'
import { DEMO_TEXT_CASES, type DemoSectionKey } from '../src/demo/demoTextCasesConfig.js'

const SECTION_KEYWORDS: Record<DemoSectionKey, string> = {
  overview: '总体概述',
  guideline: '指南诊断分析',
  testing: '检测与病理/分子分析',
  treatment: '治疗方案与随访计划',
}

async function patchDemoTextCases() {
  await ensureCaseReportsTable()

  for (const cfg of DEMO_TEXT_CASES) {
    const caseResult = await pool.query<{ id: string }>(
      'SELECT id FROM cases WHERE identifier = $1',
      [cfg.identifier],
    )

    if (caseResult.rowCount === 0) {
      // 当前数据库中不存在该 demo 病例，跳过
      // eslint-disable-next-line no-console
      console.warn(`[patch-demo-text-cases] 跳过 ${cfg.identifier}，未在 cases 表中找到`)
      continue
    }

    const caseId = caseResult.rows[0].id

    // 同步病例显示名称为真实患者姓名
    await pool.query(
      'UPDATE cases SET display_name = $1, updated_at = NOW() WHERE id = $2',
      [cfg.displayName, caseId],
    )

    const reportsResult = await pool.query<{ id: string; title: string }>(
      'SELECT id, title FROM case_reports WHERE case_id = $1',
      [caseId],
    )

    const reports = reportsResult.rows

    const findReportBySection = (section: DemoSectionKey) => {
      const keyword = SECTION_KEYWORDS[section]
      return reports.find((report) => report.title.includes(keyword)) ?? null
    }

    ;(Object.keys(SECTION_KEYWORDS) as DemoSectionKey[]).forEach(async (section) => {
      const report = findReportBySection(section)
      if (!report) {
        return
      }

      const newTitle = SECTION_KEYWORDS[section]
      const newSummary = cfg.summaries[section]

      await pool.query(
        `UPDATE case_reports
         SET title = $1,
             summary = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newTitle, newSummary, report.id],
      )
    })

    // eslint-disable-next-line no-console
    console.log(
      `[patch-demo-text-cases] 已更新 ${cfg.identifier} (${cfg.displayName}) 的病例名称与文字病历标题/摘要`,
    )
  }
}

patchDemoTextCases()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[patch-demo-text-cases] 执行失败：', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })

