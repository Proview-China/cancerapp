import * as mammoth from 'mammoth/mammoth.browser'
import type { CaseReportDraft } from '../types/cases'

const MAX_SUMMARY_LENGTH = 220

const stripMarkdown = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
    .replace(/[*_#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const plainTextToMarkdown = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.replace(/\n/g, '  \n'))
    .join('\n\n')

const normalizeMarkdown = (value: string) => value.replace(/\r\n/g, '\n').trim()

const suggestTagsFromContent = (content: string): string[] => {
  const lower = content.toLowerCase()
  const tags = new Set<string>()
  const catalog: Array<[RegExp, string]> = [
    [/ct|computed tomography|ct片/, 'CT'],
    [/mri|磁共振/, 'MRI'],
    [/病理|病理学|穿刺/, '病理'],
    [/术后|手术/, '术后'],
    [/化疗|诱导|巩固/, '化疗'],
    [/靶向|lenvatinib|osimertinib|egfr/, '靶向'],
    [/免疫|pd-l1|checkpoint/, '免疫'],
    [/mdt|多学科/, 'MDT'],
  ]
  catalog.forEach(([pattern, label]) => {
    if (pattern.test(lower)) {
      tags.add(label)
    }
  })
  return Array.from(tags)
}

const extractSummary = (markdown: string) => {
  const plain = stripMarkdown(markdown)
  if (plain.length <= MAX_SUMMARY_LENGTH) {
    return plain
  }
  return `${plain.slice(0, MAX_SUMMARY_LENGTH - 1)}…`
}

const convertDocxToMarkdown = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const { value } = await mammoth.convertToMarkdown({ arrayBuffer })
  return normalizeMarkdown(value)
}

export const convertFileToReportDraft = async (file: File): Promise<CaseReportDraft> => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  let markdown = ''

  if (extension === 'docx') {
    markdown = await convertDocxToMarkdown(file)
  } else if (extension === 'md' || file.type === 'text/markdown') {
    markdown = normalizeMarkdown(await file.text())
  } else {
    markdown = normalizeMarkdown(plainTextToMarkdown(await file.text()))
  }

  const title = file.name.replace(/\.[^.]+$/, '') || '未命名文字病历'
  const summary = extractSummary(markdown)
  const tags = suggestTagsFromContent(markdown)

  return {
    title,
    summary,
    content: markdown,
    tags,
    metadata: {
      source: 'file-upload',
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    },
  }
}

export const normalizeManualReport = (report: Partial<CaseReportDraft>): CaseReportDraft => {
  const title = (report.title ?? '').trim() || '未命名病例笔记'
  const content = normalizeMarkdown(report.content ?? '')
  const summary = report.summary?.trim() || extractSummary(content)
  const tags = report.tags?.map((tag) => tag.trim()).filter(Boolean) ?? suggestTagsFromContent(content)
  return {
    title,
    summary,
    content,
    tags,
    metadata: report.metadata ?? {},
  }
}
