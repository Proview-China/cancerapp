import { GuidedScrollArea } from './GuidedScrollArea'
import type { PreferencePage } from './PreferencesContent'
import './PreferencesSidebar.css'

type PreferencesSidebarProps = {
  activePage: PreferencePage
  onPageChange: (page: PreferencePage) => void
}

const PREFERENCE_CATEGORIES = [
  {
    title: '外观',
    page: 'appearance' as PreferencePage,
    items: ['主题模式', '界面缩放'],
  },
  {
    title: '通知',
    page: 'notification' as PreferencePage,
    items: ['桌面通知', '结果通知'],
  },
  {
    title: '数据',
    page: 'data' as PreferencePage,
    items: ['存储路径', '自动备份', '自动评估'],
  },
  {
    title: '性能',
    page: 'performance' as PreferencePage,
    items: ['硬件加速', '限制占用', '后台行为', '日志行为'],
  },
]

export const PreferencesSidebar = ({ activePage, onPageChange }: PreferencesSidebarProps) => {
  return (
    <aside className="sidebar preferences-sidebar">
      <GuidedScrollArea className="sidebar-content">
        {PREFERENCE_CATEGORIES.map((category) => (
          <div
            key={category.title}
            className={['preference-category', activePage === category.page ? 'is-active' : '']
              .join(' ')
              .trim()}
          >
            <p className="preference-category__title">{category.title}</p>
            <div className="preference-category__items">
              {category.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="pond-button"
                  onClick={() => onPageChange(category.page)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </GuidedScrollArea>
    </aside>
  )
}
