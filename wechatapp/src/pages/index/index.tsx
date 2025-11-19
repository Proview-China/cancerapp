import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { fetchCases } from '../../services/cases'
import type { CaseRecord } from '../../types/cases'
import { CaseCard } from '../../components/CaseCard'
import { FloatingAiButton } from '../../components/FloatingAiButton'
import { StateHint } from '../../components/StateHint'
import './index.scss'

function IndexPage() {
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCases()
      .then((data) => {
        setCases(data)
        const initialExpanded: Record<string, boolean> = {}
        data.forEach((item) => {
          initialExpanded[item.id] = false
        })
        setExpanded(initialExpanded)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      if (!search) return true
      const text = `${item.identifier}${item.displayName ?? ''}`
      return text.toLowerCase().includes(search.trim().toLowerCase())
    })
  }, [cases, search])

  const handleOpenCase = (record: CaseRecord) => {
    Taro.navigateTo({ url: `/pages/case-detail/index?caseId=${record.id}` })
  }

  const handleAiGlobal = () => {
    Taro.navigateTo({ url: '/pages/ai-chat/index?contextMode=global' })
  }

  return (
    <View className='page-index'>
      <View className='index-header'>
        <Text className='index-header__title'>病例库</Text>
        <Input
          className='index-header__search'
          placeholder='搜索病例编号'
          value={search}
          onInput={(event) => setSearch(event.detail.value)}
        />
      </View>

      {loading && <StateHint status='loading' message='加载病例中…' />}
      {error && !loading && <StateHint status='error' message={error} />}

      {!loading && filteredCases.length === 0 && (
        <StateHint status='empty' message='暂无匹配病例' />
      )}

      <View className='case-list'>
        {filteredCases.map((record) => (
          <CaseCard
            key={record.id}
            record={record}
            expanded={!!expanded[record.id]}
            onToggle={() => setExpanded((prev) => ({ ...prev, [record.id]: !prev[record.id] }))}
            onOpen={() => handleOpenCase(record)}
          />
        ))}
      </View>

      <FloatingAiButton onClick={handleAiGlobal} />
    </View>
  )
}

export default IndexPage
