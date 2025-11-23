import { useState } from 'react'
import { Image, MovableArea, MovableView, Text, View } from '@tarojs/components'
import type { CaseReport, CaseSample } from '../types/cases'
import { StateHint } from './StateHint'
import './PreviewPanel.scss'

type PreviewPanelProps = {
  sample: CaseSample | null
  report: CaseReport | null
}

export function PreviewPanel({ sample, report }: PreviewPanelProps) {
  const [scale, setScale] = useState(1)

  const handleReset = () => setScale(1)

  if (sample?.imageUrl) {
    return (
      <View className='preview-panel card-surface'>
        <View className='preview-panel__bar'>
          <View className='preview-panel__titles'>
            <Text className='preview-panel__title'>
              {sample.displayName ?? sample.originalFilename ?? '未命名样本'}
            </Text>
            <Text className='preview-panel__subtitle'>{sample.modality}</Text>
          </View>
          <View className='preview-panel__tools'>
            <Text className='preview-panel__scale'>{Math.round(scale * 100)}%</Text>
            <Text className='preview-panel__pill' onClick={handleReset}>
              重置
            </Text>
          </View>
        </View>

        <MovableArea className='preview-panel__area' scaleArea>
          <MovableView
            className='preview-panel__movable'
            scale
            scaleMin={0.6}
            scaleMax={3}
            scaleValue={scale}
            onScale={(event) => setScale(event.detail.scale)}
            direction='all'
            friction={0.9}
          >
            <Image className='preview-panel__image' mode='widthFix' src={sample.imageUrl} />
          </MovableView>
        </MovableArea>

        {sample.thumbnailUrl && (
          <View className='preview-panel__thumb card-surface'>
            <Image className='preview-panel__thumb-img' mode='aspectFit' src={sample.thumbnailUrl} />
          </View>
        )}
      </View>
    )
  }

  if (report) {
    return (
      <View className='preview-panel card-surface'>
        <View className='preview-panel__bar'>
          <View className='preview-panel__titles'>
            <Text className='preview-panel__title'>{report.title}</Text>
            {report.summary && <Text className='preview-panel__subtitle'>{report.summary}</Text>}
          </View>
        </View>
        <View className='preview-panel__content'>
          {report.content
            .split(/\n{2,}/g)
            .map((block) => block.replace(/[#*`>-]/g, '').trim())
            .filter(Boolean)
            .map((block, index) => (
              <Text key={index} className='preview-panel__paragraph'>
                {block}
              </Text>
            ))}
        </View>
      </View>
    )
  }

  return <StateHint status='empty' message='暂无可预览的图像或文字' />
}
