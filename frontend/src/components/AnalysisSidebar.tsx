import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GuidedScrollArea } from './GuidedScrollArea'
import type { CaseCreateSample, CaseRecord, CaseReportDraft, Modality } from '../types/cases'
import { demoTextCases } from '../demo/textCases'
import { convertFileToReportDraft, normalizeManualReport } from '../utils/textReports'
import './AnalysisSidebar.css'

type PendingSample = {
  id: string
  file: File
  previewUrl: string
  displayName: string
  modality: Modality
}

type PendingReport = {
  id: string
  title: string
  summary: string
  tags: string[]
  content: string
  metadata?: Record<string, unknown>
  source?: string
}

type ReportEditorState = {
  mode: 'create' | 'edit'
  caseId: string
  reportId?: string
  title: string
  summary: string
  tagsText: string
  content: string
}

type AnalysisSidebarProps = {
  cases: CaseRecord[]
  selectedCaseId: string | null
  selectedSampleId: string | null
  selectedReportId: string | null
  onSelectCase: (caseId: string) => void
  onSelectSample: (caseId: string, sampleId: string) => void
  onSelectReport: (caseId: string, reportId: string) => void
  onImportCase: (payload: {
    identifier: string
    samples: CaseCreateSample[]
    textReports: CaseReportDraft[]
  }) => Promise<void>
  onDeleteCase: (caseId: string) => Promise<void>
  onDeleteSample: (caseId: string, sampleId: string) => Promise<void>
  onUpdateSample: (caseId: string, sampleId: string, payload: { displayName: string; modality: Modality }) => Promise<void>
  onDeleteReport: (caseId: string, reportId: string) => Promise<void>
  onRenameCase: (caseId: string, displayName: string) => Promise<void>
  onCreateReport: (caseId: string, payload: CaseReportDraft) => Promise<void>
  onUpdateReport: (caseId: string, reportId: string, payload: CaseReportDraft) => Promise<void>
  isImporting?: boolean
}

const MODALITIES: Modality[] = ['组织切片', 'CT片', '核磁共振片']
const TEXT_FILE_ACCEPT =
  '.md,.markdown,.txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const getFileBaseName = (filename: string) => filename.replace(/\.[^.]+$/, '')

const parseTagsInput = (value: string) =>
  value
    .split(/[,;，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)

const mapPendingReportToDraft = (report: PendingReport): CaseReportDraft => {
  const normalized = normalizeManualReport({
    title: report.title,
    summary: report.summary,
    content: report.content,
    tags: report.tags,
    metadata: report.metadata,
  })
  return {
    ...normalized,
    metadata: {
      ...(normalized.metadata ?? {}),
      source: report.source ?? 'manual-input',
    },
  }
}

const toPendingReport = (draft: CaseReportDraft, source: string): PendingReport => ({
  id: createId(),
  title: draft.title,
  summary: draft.summary ?? '',
  tags: draft.tags ?? [],
  content: draft.content,
  metadata: draft.metadata,
  source,
})

export const AnalysisSidebar = ({
  cases,
  selectedCaseId,
  selectedSampleId,
  selectedReportId,
  onSelectCase,
  onSelectSample,
  onSelectReport,
  onImportCase,
  onDeleteCase,
  onDeleteSample,
  onUpdateSample,
  onDeleteReport,
  onRenameCase,
  onCreateReport,
  onUpdateReport,
  isImporting = false,
}: AnalysisSidebarProps) => {
  const [showImportModal, setShowImportModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [isClosingImport, setIsClosingImport] = useState(false)
  const [isClosingSearch, setIsClosingSearch] = useState(false)
  const [identifierValue, setIdentifierValue] = useState('')
  const [pendingSamples, setPendingSamples] = useState<PendingSample[]>([])
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([])
  const [importTab, setImportTab] = useState<'images' | 'text'>('images')
  const [activeSampleMenu, setActiveSampleMenu] = useState<string | null>(null)
  const [showInfoWarning, setShowInfoWarning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(new Set())
  const [togglingCaseIds, setTogglingCaseIds] = useState<Set<string>>(new Set())
  const [expandedImagePanels, setExpandedImagePanels] = useState<Set<string>>(new Set())
  const [expandedTextPanels, setExpandedTextPanels] = useState<Set<string>>(new Set())
  const [renameTarget, setRenameTarget] = useState<{ id: string; identifier: string; value: string } | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenamingCase, setIsRenamingCase] = useState(false)
  const [showQuickImportMenu, setShowQuickImportMenu] = useState(false)
  const infoWarningTimeout = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reportFileInputRef = useRef<HTMLInputElement>(null)
  const quickImportRef = useRef<HTMLDivElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmClosing, setConfirmClosing] = useState(false)
  const confirmActionRef = useRef<null | (() => Promise<void> | void)>(null)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [reportEditor, setReportEditor] = useState<ReportEditorState | null>(null)
  const [reportEditorError, setReportEditorError] = useState<string | null>(null)
  const [isReportSaving, setIsReportSaving] = useState(false)
  const [sampleEditor, setSampleEditor] = useState<
    { caseId: string; sampleId: string; value: string; modality: Modality }
    | null
  >(null)
  const [sampleEditorError, setSampleEditorError] = useState<string | null>(null)
  const [isSampleSaving, setIsSampleSaving] = useState(false)

  const caseCountBadge = useMemo(() => cases.reduce((acc, item) => acc + item.samples.length, 0), [cases])

  const closeQuickImportMenu = useCallback(() => {
    setShowQuickImportMenu(false)
  }, [])

  useEffect(() => {
    if (!showQuickImportMenu) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!quickImportRef.current) {
        return
      }
      if (!quickImportRef.current.contains(event.target as Node)) {
        closeQuickImportMenu()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeQuickImportMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [closeQuickImportMenu, showQuickImportMenu])

  const resetModalState = useCallback(() => {
    setIdentifierValue('')
    setPendingSamples((current) => {
      current.forEach((sample) => URL.revokeObjectURL(sample.previewUrl))
      return []
    })
    setPendingReports([])
    setImportTab('images')
    setErrorMessage(null)
    setShowInfoWarning(false)
    setActiveSampleMenu(null)
    closeQuickImportMenu()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (reportFileInputRef.current) {
      reportFileInputRef.current.value = ''
    }
  }, [closeQuickImportMenu])

  const handleQuickImportSelect = useCallback(
    (mode: 'images' | 'text') => {
      setImportTab(mode)
      setIdentifierValue('')
      closeQuickImportMenu()
      setShowImportModal(true)
    },
    [closeQuickImportMenu],
  )

  const handleCloseImport = useCallback(() => {
    setIsClosingImport(true)
    setTimeout(() => {
      setShowImportModal(false)
      setIsClosingImport(false)
      resetModalState()
    }, 250)
  }, [resetModalState])

  const handleCloseSearch = useCallback(() => {
    setIsClosingSearch(true)
    setTimeout(() => {
      setShowSearchModal(false)
      setIsClosingSearch(false)
    }, 250)
  }, [])

  useEffect(() => {
    if (selectedCaseId) {
      setExpandedCaseIds((prev) => new Set(prev).add(selectedCaseId))
    }
  }, [selectedCaseId])

  useEffect(() => {
    if (!activeSampleMenu) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        setActiveSampleMenu(null)
        return
      }

      if (target.closest('.modal-sample-item__menu') || target.closest('.modal-sample-item__modality')) {
        return
      }

      setActiveSampleMenu(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [activeSampleMenu])

  useEffect(() => {
    return () => {
      if (infoWarningTimeout.current) {
        window.clearTimeout(infoWarningTimeout.current)
      }
      pendingSamples.forEach((sample) => URL.revokeObjectURL(sample.previewUrl))
    }
  }, [pendingSamples])

  const triggerInfoWarning = useCallback(() => {
    setShowInfoWarning(true)
    if (infoWarningTimeout.current) {
      window.clearTimeout(infoWarningTimeout.current)
    }
    infoWarningTimeout.current = window.setTimeout(() => {
      setShowInfoWarning(false)
      infoWarningTimeout.current = null
    }, 500)
  }, [])

  const processFiles = useCallback((files: File[]) => {
    if (!files || files.length === 0) {
      return
    }

    setPendingSamples((current) => {
      const next = [...current]
      files.forEach((file) => {
        const sample: PendingSample = {
          id: createId(),
          file,
          previewUrl: URL.createObjectURL(file),
          displayName: getFileBaseName(file.name),
          modality: '组织切片',
        }
        next.push(sample)
      })
      return next
    })
  }, [])

  const handleElectronImport = useCallback(async () => {
    if (!window.electronAPI?.openSampleImport) {
      return null
    }

    try {
      const result = await window.electronAPI.openSampleImport()
      if (!result || result.length === 0) {
        return []
      }

      const files = result.map((entry) => {
        const binary = atob(entry.data)
        const len = binary.length
        const buffer = new Uint8Array(len)
        for (let i = 0; i < len; i += 1) {
          buffer[i] = binary.charCodeAt(i)
        }
        const blob = new Blob([buffer], { type: entry.mimeType })
        return new File([blob], entry.name, { type: entry.mimeType })
      })
      return files
    } catch (error) {
      console.error('通过 Electron 导入样例失败', error)
      return null
    }
  }, [])

  const handleAddSampleClick = useCallback(async () => {
    const electronFiles = await handleElectronImport()
    if (Array.isArray(electronFiles) && electronFiles.length > 0) {
      processFiles(electronFiles)
      return
    }

    fileInputRef.current?.click()
  }, [handleElectronImport, processFiles])

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files
      if (fileList) {
        processFiles(Array.from(fileList))
        event.target.value = ''
      }
    },
    [processFiles],
  )

  const handleSampleDisplayNameChange = useCallback((sampleId: string, value: string) => {
    setPendingSamples((current) =>
      current.map((sample) => (sample.id === sampleId ? { ...sample, displayName: value } : sample)),
    )
  }, [])

  const handleSampleModalityChange = useCallback((sampleId: string, modality: Modality) => {
    setPendingSamples((current) =>
      current.map((sample) => (sample.id === sampleId ? { ...sample, modality } : sample)),
    )
  }, [])

  const handleRemoveSample = useCallback((sampleId: string) => {
    setPendingSamples((current) => {
      const next = current.filter((sample) => sample.id !== sampleId)
      const removed = current.find((sample) => sample.id === sampleId)
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return next
    })
  }, [])

  const handleAddPendingReport = useCallback(() => {
    setImportTab('text')
    setPendingReports((current) => [
      ...current,
      {
        id: createId(),
        title: '',
        summary: '',
        tags: [],
        content: '',
        source: 'manual-input',
      },
    ])
  }, [])

  const handlePendingReportFieldChange = useCallback(
    (reportId: string, field: keyof PendingReport, value: string | string[]) => {
      setPendingReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? {
                ...report,
                [field]: value,
              }
            : report,
        ),
      )
    },
    [],
  )

  const handlePendingReportTagsChange = useCallback((reportId: string, value: string) => {
    handlePendingReportFieldChange(reportId, 'tags', parseTagsInput(value))
  }, [handlePendingReportFieldChange])

  const handleRemovePendingReport = useCallback((reportId: string) => {
    setPendingReports((current) => current.filter((report) => report.id !== reportId))
  }, [])

  const handleReportFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files
      if (!fileList || fileList.length === 0) {
        return
      }
      try {
        const converted = await Promise.all(Array.from(fileList).map((file) => convertFileToReportDraft(file)))
        setPendingReports((current) => [...converted.map((draft) => toPendingReport(draft, 'file-upload')), ...current])
      } catch (error) {
        console.error('解析文字病历文件失败', error)
        setErrorMessage(error instanceof Error ? error.message : '解析文件失败，请重试')
      } finally {
        event.target.value = ''
      }
    },
    [],
  )

  const handleLoadDemoReports = useCallback(() => {
    setImportTab('text')
    setPendingReports(demoTextCases.map((draft) => toPendingReport(draft, 'demo-text')))
    if (!identifierValue && demoTextCases.length > 0) {
      setIdentifierValue(demoTextCases[0].suggestedIdentifier)
    }
  }, [identifierValue])

  const handleSubmitImport = useCallback(async () => {
    const identifier = identifierValue.trim()
    if (!identifier) {
      setErrorMessage('请填写病例编号或患者标识')
      triggerInfoWarning()
      return
    }

    if (pendingSamples.length === 0 && pendingReports.length === 0) {
      setErrorMessage('请至少添加一个影像样例或一条文字病历')
      triggerInfoWarning()
      return
    }

    const invalidReport = pendingReports.find(
      (report) => !report.title.trim() || !report.content.trim(),
    )
    if (invalidReport) {
      setErrorMessage('文字病历需要填写标题与正文')
      triggerInfoWarning()
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    const payloadSamples: CaseCreateSample[] = pendingSamples.map((sample) => ({
      file: sample.file,
      displayName: sample.displayName,
      modality: sample.modality,
    }))

    const payloadReports = pendingReports.map(mapPendingReportToDraft)

    try {
      await onImportCase({ identifier, samples: payloadSamples, textReports: payloadReports })
      handleCloseImport()
    } catch (error) {
      console.error('导入病例失败', error)
      setErrorMessage(error instanceof Error ? error.message : '导入失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }, [handleCloseImport, identifierValue, onImportCase, pendingReports, pendingSamples, triggerInfoWarning])

  const ensurePanelsExpanded = useCallback((caseId: string) => {
    setExpandedImagePanels((prev) => {
      if (prev.has(caseId)) {
        return prev
      }
      const next = new Set(prev)
      next.add(caseId)
      return next
    })
    setExpandedTextPanels((prev) => {
      if (prev.has(caseId)) {
        return prev
      }
      const next = new Set(prev)
      next.add(caseId)
      return next
    })
  }, [])

  const animateCaseToggle = useCallback((caseId: string) => {
    setTogglingCaseIds((prev) => {
      const next = new Set(prev)
      next.add(caseId)
      return next
    })
    window.setTimeout(() => {
      setTogglingCaseIds((prev) => {
        const next = new Set(prev)
        next.delete(caseId)
        return next
      })
    }, 220)
  }, [])

  const handleCaseToggleExpand = useCallback(
    (caseId: string) => {
      setExpandedCaseIds((prev) => {
        const next = new Set(prev)
        if (next.has(caseId)) {
          next.delete(caseId)
        } else {
          next.add(caseId)
          ensurePanelsExpanded(caseId)
        }
        return next
      })
      animateCaseToggle(caseId)
    },
    [animateCaseToggle, ensurePanelsExpanded],
  )

  const handleCaseSelect = useCallback(
    (caseId: string) => {
      onSelectCase(caseId)
      setExpandedCaseIds((prev) => {
        if (prev.has(caseId)) {
          return prev
        }
        const next = new Set(prev)
        next.add(caseId)
        return next
      })
      ensurePanelsExpanded(caseId)
    },
    [ensurePanelsExpanded, onSelectCase],
  )

  const togglePanelExpansion = useCallback((caseId: string, panel: 'images' | 'text') => {
    if (panel === 'images') {
      setExpandedImagePanels((prev) => {
        const next = new Set(prev)
        if (next.has(caseId)) {
          next.delete(caseId)
        } else {
          next.add(caseId)
        }
        return next
      })
    } else {
      setExpandedTextPanels((prev) => {
        const next = new Set(prev)
        if (next.has(caseId)) {
          next.delete(caseId)
        } else {
          next.add(caseId)
        }
        return next
      })
    }
  }, [])

  const openCaseRenameDialog = useCallback((caseItem: CaseRecord) => {
    setRenameTarget({
      id: caseItem.id,
      identifier: caseItem.identifier,
      value: caseItem.displayName ?? caseItem.identifier,
    })
    setRenameError(null)
  }, [])

  const closeCaseRenameDialog = useCallback(() => {
    setRenameTarget(null)
    setRenameError(null)
  }, [])

  const handleRenameSubmit = useCallback(async () => {
    if (!renameTarget) {
      return
    }

    const nextName = renameTarget.value.trim()
    if (!nextName) {
      setRenameError('病例名称不能为空')
      return
    }

    setIsRenamingCase(true)
    try {
      await onRenameCase(renameTarget.id, nextName)
      closeCaseRenameDialog()
    } catch (error) {
      console.error('重命名病例失败', error)
      setRenameError(error instanceof Error ? error.message : '重命名失败，请稍后重试')
    } finally {
      setIsRenamingCase(false)
    }
  }, [closeCaseRenameDialog, onRenameCase, renameTarget])

  const handleSampleClick = useCallback(
    (caseId: string, sampleId: string) => {
      onSelectCase(caseId)
      onSelectSample(caseId, sampleId)
      setExpandedCaseIds((prev) => {
        const next = new Set(prev)
        next.add(caseId)
        return next
      })
      setExpandedImagePanels((prev) => {
        const next = new Set(prev)
        next.add(caseId)
        return next
      })
    },
    [onSelectCase, onSelectSample],
  )

  const handleReportClick = useCallback(
    (caseId: string, reportId: string) => {
      onSelectCase(caseId)
      onSelectReport(caseId, reportId)
      setExpandedCaseIds((prev) => {
        const next = new Set(prev)
        next.add(caseId)
        return next
      })
      setExpandedTextPanels((prev) => {
        const next = new Set(prev)
        next.add(caseId)
        return next
      })
    },
    [onSelectCase, onSelectReport],
  )

  const openConfirm = useCallback((message: string, action: () => Promise<void> | void) => {
    setConfirmMessage(message)
    confirmActionRef.current = action
    setConfirmOpen(true)
  }, [])

  const openSampleEditor = useCallback((caseItem: CaseRecord, sample: CaseRecord['samples'][number]) => {
    setSampleEditor({
      caseId: caseItem.id,
      sampleId: sample.id,
      value: sample.displayName || sample.originalFilename,
      modality: sample.modality,
    })
    setSampleEditorError(null)
  }, [])

  const closeSampleEditor = useCallback(() => {
    setSampleEditor(null)
    setSampleEditorError(null)
  }, [])

  const closeConfirm = useCallback(() => {
    setConfirmClosing(true)
    setTimeout(() => {
      setConfirmOpen(false)
      setConfirmClosing(false)
      confirmActionRef.current = null
    }, 250)
  }, [])

  const handleConfirmOk = useCallback(async () => {
    try {
      await confirmActionRef.current?.()
    } finally {
      closeConfirm()
    }
  }, [closeConfirm])

  const handleCaseDelete = useCallback(
    async (caseItem: CaseRecord) => {
      openConfirm(`确定要删除病例“${caseItem.identifier}”及其所有数据吗？`, async () => {
        await onDeleteCase(caseItem.id)
        setExpandedCaseIds((prev) => {
          const next = new Set(prev)
          next.delete(caseItem.id)
          return next
        })
      })
    },
    [onDeleteCase, openConfirm],
  )

  const handleSampleDelete = useCallback(
    async (caseItem: CaseRecord, sampleId: string) => {
      openConfirm('确定删除这个影像样例吗？', async () => {
        await onDeleteSample(caseItem.id, sampleId)
      })
    },
    [onDeleteSample, openConfirm],
  )

  const handleReportDelete = useCallback(
    async (caseItem: CaseRecord, reportId: string) => {
      openConfirm('确定删除这条文字病历吗？', async () => {
        await onDeleteReport(caseItem.id, reportId)
      })
    },
    [onDeleteReport, openConfirm],
  )

  const openReportEditor = useCallback(
    (params: { caseId: string; reportId?: string; title?: string; summary?: string; tags?: string[]; content?: string }) => {
      setReportEditor({
        mode: params.reportId ? 'edit' : 'create',
        caseId: params.caseId,
        reportId: params.reportId,
        title: params.title ?? '',
        summary: params.summary ?? '',
        tagsText: params.tags?.join('、') ?? '',
        content: params.content ?? '',
      })
      setReportEditorError(null)
    },
    [],
  )

  const closeReportEditor = useCallback(() => {
    setReportEditor(null)
    setReportEditorError(null)
  }, [])

  const handleReportEditorSubmit = useCallback(async () => {
    if (!reportEditor) return
    if (!reportEditor.title.trim()) {
      setReportEditorError('标题不能为空')
      return
    }
    if (!reportEditor.content.trim()) {
      setReportEditorError('正文内容不能为空')
      return
    }

    setReportEditorError(null)
    setIsReportSaving(true)
    const payload = normalizeManualReport({
      title: reportEditor.title,
      summary: reportEditor.summary,
      content: reportEditor.content,
      tags: parseTagsInput(reportEditor.tagsText),
    })

    try {
      if (reportEditor.mode === 'create') {
        await onCreateReport(reportEditor.caseId, payload)
      } else if (reportEditor.reportId) {
        await onUpdateReport(reportEditor.caseId, reportEditor.reportId, payload)
      }
      closeReportEditor()
    } catch (error) {
      console.error('保存文字病历失败', error)
      setReportEditorError(error instanceof Error ? error.message : '保存失败，请稍后重试')
    } finally {
      setIsReportSaving(false)
    }
  }, [closeReportEditor, onCreateReport, onUpdateReport, reportEditor])

  const handleSampleEditorSubmit = useCallback(async () => {
    if (!sampleEditor) return
    const trimmedName = sampleEditor.value.trim()
    if (!trimmedName) {
      setSampleEditorError('名称不能为空')
      return
    }
    setSampleEditorError(null)
    setIsSampleSaving(true)
    try {
      await onUpdateSample(sampleEditor.caseId, sampleEditor.sampleId, {
        displayName: trimmedName,
        modality: sampleEditor.modality,
      })
      closeSampleEditor()
    } catch (error) {
      console.error('更新影像样例失败', error)
      setSampleEditorError(error instanceof Error ? error.message : '保存失败，请稍后重试')
    } finally {
      setIsSampleSaving(false)
    }
  }, [closeSampleEditor, onUpdateSample, sampleEditor])

  const renderImagePanel = (caseItem: CaseRecord, expanded: boolean) => (
    <section
      className={[
        'case-panel',
        'case-panel--images',
        expanded ? 'is-expanded' : 'is-collapsed',
      ]
        .join(' ')
        .trim()}
    >
      <div className="case-panel__header">
        <h4 className="case-panel__title">图像</h4>
        <div className="case-panel__actions">
          <button
            type="button"
            className="case-panel__action"
            disabled={isImporting}
            onClick={(event) => {
              event.stopPropagation()
              setIdentifierValue(caseItem.identifier)
              setImportTab('images')
              setShowImportModal(true)
            }}
          >
            新增
          </button>
          <button
            type="button"
            className="case-panel__action case-panel__action--ghost"
            onClick={(event) => {
              event.stopPropagation()
              togglePanelExpansion(caseItem.id, 'images')
            }}
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="case-panel__body case-panel__body--images">
          {caseItem.samples.length === 0 ? (
            <p className="case-panel__empty">暂无图像内容</p>
          ) : (
            caseItem.samples.map((sample) => {
              const isSampleActive = caseItem.id === selectedCaseId && selectedSampleId === sample.id
              return (
                <div
                  key={sample.id}
                  className={['case-panel__media-item', isSampleActive ? 'is-active' : '']
                    .join(' ')
                    .trim()}
                >
                  <button
                    type="button"
                    className="case-panel__media-main"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleSampleClick(caseItem.id, sample.id)
                    }}
                  >
                    <span className="case-panel__media-thumb">
                      <img
                        src={sample.thumbnailUrl ?? sample.imageUrl}
                        alt={sample.displayName ?? sample.originalFilename}
                        loading="lazy"
                      />
                    </span>
                    <span className="case-panel__media-text">
                      <strong>{sample.displayName || sample.originalFilename}</strong>
                      <span>{sample.modality}</span>
                    </span>
                  </button>
                  <div className="case-panel__media-actions">
                    <button
                      type="button"
                      className="case-panel__media-action"
                      onClick={(event) => {
                        event.stopPropagation()
                        openSampleEditor(caseItem, sample)
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="case-panel__media-action case-panel__media-action--danger"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleSampleDelete(caseItem, sample.id)
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </section>
  )

  const renderTextPanel = (caseItem: CaseRecord, expanded: boolean) => (
    <section
      className={[
        'case-panel',
        'case-panel--text',
        expanded ? 'is-expanded' : 'is-collapsed',
      ]
        .join(' ')
        .trim()}
    >
      <div className="case-panel__header">
        <h4 className="case-panel__title">文字</h4>
        <div className="case-panel__actions">
          <button
            type="button"
            className="case-panel__action"
            onClick={(event) => {
              event.stopPropagation()
              openReportEditor({ caseId: caseItem.id })
            }}
          >
            新增
          </button>
          <button
            type="button"
            className="case-panel__action case-panel__action--ghost"
            onClick={(event) => {
              event.stopPropagation()
              togglePanelExpansion(caseItem.id, 'text')
            }}
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="case-panel__body case-panel__body--text">
          {caseItem.reports.length === 0 ? (
            <p className="case-panel__empty">暂无文字记录</p>
          ) : (
            caseItem.reports.map((report) => {
              const isActive = caseItem.id === selectedCaseId && selectedReportId === report.id
              return (
                <div key={report.id} className={['report-item', isActive ? 'is-active' : ''].join(' ').trim()}>
                  <button
                    type="button"
                    className="report-item__main"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleReportClick(caseItem.id, report.id)
                    }}
                  >
                    <div className="report-item__title">{report.title}</div>
                    <p className="report-item__summary">{report.summary ?? '—'}</p>
                  </button>
                  <div className="report-item__actions">
                    <button
                      type="button"
                      className="report-item__action"
                      onClick={(event) => {
                        event.stopPropagation()
                        openReportEditor({
                          caseId: caseItem.id,
                          reportId: report.id,
                          title: report.title,
                          summary: report.summary ?? '',
                          tags: report.tags,
                          content: report.content,
                        })
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="report-item__action report-item__action--danger"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleReportDelete(caseItem, report.id)
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </section>
  )

  const renderImportModal = () => (
    <div className={`modal-overlay ${isClosingImport ? 'is-closing' : ''}`} onClick={handleCloseImport}>
      <div className={`modal-volcano ${isClosingImport ? 'is-closing' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-volcano__header">
          <h2>快速导入</h2>
          <div className="modal-volcano__tab-group">
            <button
              type="button"
              className={['modal-tab', importTab === 'images' ? 'is-active' : ''].join(' ').trim()}
              onClick={() => setImportTab('images')}
            >
              影像样例
            </button>
            <button
              type="button"
              className={['modal-tab', importTab === 'text' ? 'is-active' : ''].join(' ').trim()}
              onClick={() => setImportTab('text')}
            >
              文字病历
            </button>
          </div>
        </div>

        <div className="modal-volcano__panels">
          <div className="modal-volcano__panel">
            <h3 className="modal-volcano__subtitle">病例信息</h3>
            <div className="modal-volcano__input-group">
              <input
                type="text"
                className={['pond-input', showInfoWarning ? 'pond-input--warning' : ''].join(' ').trim()}
                placeholder="请输入患者姓名或编号"
                value={identifierValue}
                onChange={(event) => setIdentifierValue(event.target.value)}
              />
              <p className="modal-volcano__helper">共 {caseCountBadge} 个影像样例</p>
            </div>
          </div>

          {importTab === 'images' ? (
            <div className="modal-volcano__panel modal-volcano__panel--samples">
              <div className="modal-volcano__subtitle-row">
                <h3 className="modal-volcano__subtitle">样例导入</h3>
                <button
                  type="button"
                  className="pond-button modal-volcano__sample-button"
                  aria-label="添加样例"
                  onClick={handleAddSampleClick}
                >
                  <span aria-hidden>+</span>
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="modal-volcano__file-input"
                accept="image/*"
                multiple
                onChange={handleFileInputChange}
              />

              {pendingSamples.length === 0 ? (
                <p className="modal-volcano__empty">尚未选择样例</p>
              ) : (
                <div className={`modal-volcano__sample-list ${pendingSamples.length > 5 ? 'is-scrollable' : ''}`}>
                  {pendingSamples.map((sample) => (
                    <div key={sample.id} className="modal-sample-item">
                      <div className="modal-sample-item__preview">
                        <img src={sample.previewUrl} alt="样例预览" />
                      </div>
                      <div className="modal-sample-item__details">
                        <div className="modal-sample-item__controls">
                          <div className="modal-sample-item__modality-wrapper">
                            <button
                              type="button"
                              className="modal-sample-item__modality"
                              onClick={() => setActiveSampleMenu((prev) => (prev === sample.id ? null : sample.id))}
                              aria-haspopup="menu"
                              aria-expanded={activeSampleMenu === sample.id}
                            >
                              {sample.modality} ▾
                            </button>
                            {activeSampleMenu === sample.id && (
                              <div className="modal-sample-item__menu" role="menu">
                                {MODALITIES.map((modality) => (
                                  <button
                                    key={modality}
                                    type="button"
                                    className="modal-sample-item__menu-item"
                                    onClick={() => {
                                      handleSampleModalityChange(sample.id, modality)
                                      setActiveSampleMenu(null)
                                    }}
                                  >
                                    {modality}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="modal-sample-item__remove"
                            onClick={() => handleRemoveSample(sample.id)}
                            aria-label="移除样例"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="modal-sample-item__name">
                          <input
                            type="text"
                            value={sample.displayName}
                            placeholder="输入样例名称"
                            onChange={(event) => handleSampleDisplayNameChange(sample.id, event.target.value)}
                          />
                        </div>
                        <div className="modal-sample-item__filename" title={sample.file.name}>
                          {sample.file.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="modal-volcano__panel modal-volcano__panel--reports">
              <div className="modal-volcano__subtitle-row">
                <h3 className="modal-volcano__subtitle">文字病历导入</h3>
                <div className="modal-volcano__report-actions">
                  <button type="button" className="pond-button pond-button--tiny" onClick={handleAddPendingReport}>
                    新建
                  </button>
                  <button
                    type="button"
                    className="pond-button pond-button--tiny"
                    onClick={() => reportFileInputRef.current?.click()}
                  >
                    导入文档
                  </button>
                  <button type="button" className="pond-button pond-button--tiny" onClick={handleLoadDemoReports}>
                    加载示例
                  </button>
                </div>
              </div>

              <input
                type="file"
                ref={reportFileInputRef}
                className="modal-volcano__file-input"
                accept={TEXT_FILE_ACCEPT}
                multiple
                onChange={handleReportFileInputChange}
              />

              {pendingReports.length === 0 ? (
                <p className="modal-volcano__empty">尚未添加文字病历</p>
              ) : (
                <div className={`modal-volcano__report-list ${pendingReports.length > 3 ? 'is-scrollable' : ''}`}>
                  {pendingReports.map((report) => (
                    <article key={report.id} className="modal-report-item">
                      <header className="modal-report-item__header">
                        <input
                          type="text"
                          placeholder="标题"
                          value={report.title}
                          onChange={(event) => handlePendingReportFieldChange(report.id, 'title', event.target.value)}
                        />
                        <button type="button" className="modal-report-item__remove" onClick={() => handleRemovePendingReport(report.id)}>
                          ✕
                        </button>
                      </header>
                      <textarea
                        className="modal-report-item__summary"
                        placeholder="摘要（可选）"
                        value={report.summary}
                        onChange={(event) => handlePendingReportFieldChange(report.id, 'summary', event.target.value)}
                      />
                      <textarea
                        className="modal-report-item__content"
                        placeholder="正文内容（支持 Markdown）"
                        value={report.content}
                        onChange={(event) => handlePendingReportFieldChange(report.id, 'content', event.target.value)}
                      />
                      <input
                        type="text"
                        className="modal-report-item__tags"
                        placeholder="标签（以逗号或空格分隔）"
                        value={report.tags.join('、')}
                        onChange={(event) => handlePendingReportTagsChange(report.id, event.target.value)}
                      />
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {errorMessage ? <p className="modal-volcano__error">{errorMessage}</p> : null}

        <div className="modal-volcano__actions">
          <button type="button" className="pond-button pond-button--ghost" onClick={handleCloseImport} disabled={isSubmitting || isImporting}>
            取消
          </button>
          <button type="button" className="pond-button" onClick={handleSubmitImport} disabled={isSubmitting || isImporting}>
            {isSubmitting || isImporting ? '导入中…' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderReportEditorModal = () => {
    if (!reportEditor) return null
    return (
      <div className="modal-overlay" onClick={closeReportEditor}>
        <div className="modal-volcano modal-volcano--editor" onClick={(event) => event.stopPropagation()}>
          <header className="modal-editor__header">
            <div>
              <p className="modal-editor__eyebrow">{reportEditor.mode === 'create' ? '新增记录' : '编辑记录'}</p>
              <h2>{reportEditor.mode === 'create' ? '新增文字病历' : '编辑文字病历'}</h2>
            </div>
            <button type="button" className="modal-close-button" aria-label="关闭" onClick={closeReportEditor} />
          </header>

          <div className="modal-editor__grid">
            <label className="modal-editor__field modal-editor__field--title">
              <span>标题</span>
              <input
                type="text"
                value={reportEditor.title}
                placeholder="请输入文字病历标题"
                onChange={(event) => setReportEditor((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
              />
            </label>

            <label className="modal-editor__field modal-editor__field--summary">
              <span>摘要</span>
              <textarea
                rows={3}
                value={reportEditor.summary}
                placeholder="简要概述病例要点（可选）"
                onChange={(event) => setReportEditor((prev) => (prev ? { ...prev, summary: event.target.value } : prev))}
              />
            </label>

            <label className="modal-editor__field modal-editor__field--tags">
              <span>标签（以逗号或空格分隔）</span>
              <input
                type="text"
                value={reportEditor.tagsText}
                placeholder="示例：肝癌、术后、MDT"
                onChange={(event) => setReportEditor((prev) => (prev ? { ...prev, tagsText: event.target.value } : prev))}
              />
            </label>

            <label className="modal-editor__field modal-editor__field--full">
              <span>正文</span>
              <textarea
                rows={10}
                value={reportEditor.content}
                placeholder="支持 Markdown，可粘贴 docx / txt 转换内容"
                onChange={(event) => setReportEditor((prev) => (prev ? { ...prev, content: event.target.value } : prev))}
              />
            </label>
          </div>

          {reportEditorError ? <p className="modal-volcano__error">{reportEditorError}</p> : null}

          <div className="modal-volcano__actions modal-editor__actions">
            <button type="button" className="pond-button pond-button--ghost" onClick={closeReportEditor} disabled={isReportSaving}>
              取消
            </button>
            <button type="button" className="pond-button" onClick={handleReportEditorSubmit} disabled={isReportSaving}>
              {isReportSaving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <aside className="sidebar analysis-sidebar">
        <div className="analysis-header">
          <h3 className="analysis-header__title">病例库</h3>
          <div className="analysis-header__actions">
            <button
              type="button"
              className="pond-button--compact"
              onClick={() => {
                const allIds = new Set(cases.map((c) => c.id))
                const allExpanded = cases.length > 0 && cases.every((c) => expandedCaseIds.has(c.id))
                setExpandedCaseIds(allExpanded ? new Set() : allIds)
              }}
            >
              {cases.length > 0 && cases.every((c) => expandedCaseIds.has(c.id)) ? '全部收起' : '全部展开'}
            </button>
            <div
              className={['analysis-quick-import', showQuickImportMenu ? 'is-open' : ''].join(' ').trim()}
              ref={quickImportRef}
            >
              <button
                type="button"
                className="pond-button--compact"
                aria-haspopup="true"
                aria-expanded={showQuickImportMenu}
                aria-controls="analysis-quick-import-menu"
                onClick={() => setShowQuickImportMenu((prev) => !prev)}
              >
                快速导入
              </button>
              {showQuickImportMenu ? (
                <div
                  id="analysis-quick-import-menu"
                  className="analysis-quick-import__menu"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleQuickImportSelect('images')}
                    disabled={isImporting}
                  >
                    图像
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleQuickImportSelect('text')}
                    disabled={isImporting}
                  >
                    文字
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="pond-button--compact"
              onClick={() => {
                closeQuickImportMenu()
                setShowSearchModal(true)
              }}
            >
              搜索
            </button>
          </div>
        </div>

        <GuidedScrollArea className="analysis-scrollable">
          <div className="case-list">
            {cases.length === 0 ? (
              <p className="case-list__empty">尚未导入病例</p>
            ) : (
              cases.map((caseItem) => {
                const isActive = caseItem.id === selectedCaseId
                const isExpanded = expandedCaseIds.has(caseItem.id)
                const isToggling = togglingCaseIds.has(caseItem.id)
                const imagesExpanded = expandedImagePanels.has(caseItem.id)
                const textExpanded = expandedTextPanels.has(caseItem.id)
                return (
                  <div
                    key={caseItem.id}
                    className={['case-card', isActive ? 'is-active' : '', isExpanded ? 'is-expanded' : '', isToggling ? 'is-toggling' : '']
                      .join(' ')
                      .trim()}
                  >
                    <div className="case-card__header">
                      <button
                        type="button"
                        className="case-card__main"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleCaseSelect(caseItem.id)
                        }}
                      >
                        <div className="case-card__title-row">
                          <span className="case-card__name">{caseItem.identifier}</span>
                        </div>
                        {caseItem.displayName ? (
                          <div className="case-card__meta case-card__meta--alias">{caseItem.displayName}</div>
                        ) : null}
                      </button>
                      <div className="case-card__actions-row case-card__actions-row--primary">
                        <button
                          type="button"
                          className="case-card__action"
                          onClick={(event) => {
                            event.stopPropagation()
                            openCaseRenameDialog(caseItem)
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="case-card__action case-card__action--danger"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleCaseDelete(caseItem)
                          }}
                        >
                          删除
                        </button>
                        <button
                          type="button"
                          className="case-card__action"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleCaseToggleExpand(caseItem.id)
                          }}
                        >
                          {isExpanded ? '收起' : '展开'}
                        </button>
                      </div>
                    </div>
                    {isExpanded ? (
                      <div className="case-card__body">
                        {renderImagePanel(caseItem, imagesExpanded)}
                        {renderTextPanel(caseItem, textExpanded)}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </GuidedScrollArea>
      </aside>

      {showImportModal && renderImportModal()}
            {renderReportEditorModal()}
            {sampleEditor ? (
              <div className="modal-overlay" onClick={closeSampleEditor}>
                <div className="modal-volcano modal-volcano--editor" onClick={(event) => event.stopPropagation()}>
                  <header className="modal-editor__header">
              <div>
                <p className="modal-editor__eyebrow">编辑影像样例</p>
                <h2>设置样例名称与类别</h2>
              </div>
              <button type="button" className="modal-close-button" aria-label="关闭" onClick={closeSampleEditor} />
                  </header>
            <div className="modal-editor__grid modal-editor__grid--sample">
              <label className="modal-editor__field modal-editor__field--title">
                <span>名称</span>
                <input
                  type="text"
                  value={sampleEditor.value}
                  placeholder="请输入样例名称"
                  onChange={(event) =>
                    setSampleEditor((prev) => (prev ? { ...prev, value: event.target.value } : prev))
                  }
                />
              </label>
              <label className="modal-editor__field modal-editor__field--summary">
                <span>类别</span>
                <div className="modal-sample-editor__modality">
                  <select
                    value={sampleEditor.modality}
                    onChange={(event) =>
                      setSampleEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              modality: event.target.value as Modality,
                            }
                          : prev,
                      )
                    }
                  >
                    {MODALITIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
            {sampleEditorError ? <p className="modal-volcano__error">{sampleEditorError}</p> : null}
            <div className="modal-volcano__actions modal-editor__actions">
              <button type="button" className="pond-button pond-button--ghost" onClick={closeSampleEditor} disabled={isSampleSaving}>
                取消
              </button>
              <button type="button" className="pond-button" onClick={handleSampleEditorSubmit} disabled={isSampleSaving}>
                {isSampleSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renameTarget ? (
        <div className="modal-overlay" onClick={closeCaseRenameDialog}>
          <div className="modal-volcano modal-volcano--editor" onClick={(event) => event.stopPropagation()}>
            <header className="modal-editor__header">
              <div>
                <p className="modal-editor__eyebrow">编辑病例</p>
                <h2>更新病例名称</h2>
              </div>
              <button type="button" className="modal-close-button" aria-label="关闭" onClick={closeCaseRenameDialog} />
            </header>

            <div className="modal-editor__grid">
              <label className="modal-editor__field">
                <span>病例标识</span>
                <input type="text" value={renameTarget.identifier} disabled />
              </label>
              <label className="modal-editor__field">
                <span>病例名称</span>
                <input
                  type="text"
                  value={renameTarget.value}
                  placeholder="请输入病例名称"
                  onChange={(event) =>
                    setRenameTarget((prev) => (prev ? { ...prev, value: event.target.value } : prev))
                  }
                  autoFocus
                />
              </label>
            </div>

            {renameError ? <p className="modal-volcano__error">{renameError}</p> : null}

            <div className="modal-volcano__actions">
              <button type="button" className="pond-button pond-button--ghost" onClick={closeCaseRenameDialog} disabled={isRenamingCase}>
                取消
              </button>
              <button type="button" className="pond-button" onClick={handleRenameSubmit} disabled={isRenamingCase}>
                {isRenamingCase ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen && (
        <div className={`modal-overlay ${confirmClosing ? 'is-closing' : ''}`} onClick={closeConfirm}>
          <div className={`modal-volcano ${confirmClosing ? 'is-closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h2>确认操作</h2>
            <p style={{ margin: '0', color: 'var(--text-primary)' }}>{confirmMessage}</p>
            <div className="modal-volcano__actions">
              <button type="button" className="pond-button pond-button--ghost" onClick={closeConfirm}>
                取消
              </button>
              <button type="button" className="pond-button pond-button--danger" onClick={handleConfirmOk}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showSearchModal && (
        <div className={`modal-overlay ${isClosingSearch ? 'is-closing' : ''}`} onClick={handleCloseSearch}>
          <div className={`modal-volcano ${isClosingSearch ? 'is-closing' : ''}`} onClick={(event) => event.stopPropagation()}>
            <h2>搜索</h2>
            <input type="text" className="modal-search-input" placeholder="请输入您想查询的内容" autoFocus />
          </div>
        </div>
      )}
    </>
  )
}
