import { GuidedScrollArea } from './GuidedScrollArea'
import { PondSwitch } from './PondSwitch'
import { VolcanoSelect } from './VolcanoSelect'
import './PreferencesContent.css'

type PreferencePage = 'appearance' | 'notification' | 'data' | 'performance'

type PreferencesContentProps = {
  activePage: PreferencePage
  onPageChange: (page: PreferencePage) => void
}

export const PreferencesContent = ({ activePage }: PreferencesContentProps) => {
  return (
    <GuidedScrollArea className="preferences-content">
      {activePage === 'appearance' && <AppearanceSettings />}
      {activePage === 'notification' && <NotificationSettings />}
      {activePage === 'data' && <DataSettings />}
      {activePage === 'performance' && <PerformanceSettings />}
    </GuidedScrollArea>
  )
}

// 外观设置
const AppearanceSettings = () => {
  return (
    <div className="preferences-page">
      <h2 className="preferences-page__title">外观</h2>

      {/* 主题模式 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">主题模式</h3>
        <div className="preferences-volcano__grid">
          <button className="pond-button">浅色模式</button>
          <button className="pond-button">深色模式</button>
          <button className="pond-button">跟随系统</button>
        </div>
      </div>

      {/* 界面缩放 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">界面缩放</h3>
        <div className="preferences-volcano__grid">
          <button className="pond-button">100%</button>
          <button className="pond-button">125%</button>
          <button className="pond-button">150%</button>
        </div>
      </div>

      {/* 其他选项 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">其他选项</h3>
        <div className="preferences-volcano__stack">
          <PondSwitch label="启用平滑滚动" defaultChecked />
          <PondSwitch label="显示动画效果" defaultChecked />
        </div>
      </div>
    </div>
  )
}

// 通知设置
const NotificationSettings = () => {
  return (
    <div className="preferences-page">
      <h2 className="preferences-page__title">通知</h2>

      {/* 桌面通知 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">桌面通知</h3>
        <div className="preferences-volcano__stack">
          <PondSwitch label="启用桌面通知" defaultChecked />
          <PondSwitch label="任务完成时通知" defaultChecked />
          <PondSwitch label="错误发生时通知" />
        </div>
      </div>

      {/* 结果通知 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">结果通知</h3>
        <div className="preferences-volcano__stack">
          <PondSwitch label="邮件推送分析结果" defaultChecked />
          <PondSwitch label="推送详细报告" />
        </div>
      </div>
    </div>
  )
}

// 数据设置
const DataSettings = () => {
  return (
    <div className="preferences-page">
      <h2 className="preferences-page__title">数据</h2>

      {/* 存储路径 - 火山口 */}
      <div className="preferences-volcano">
        <div className="preferences-volcano__header">
          <h3 className="preferences-volcano__title">存储路径</h3>
          <button className="pond-button pond-button--small">选择目录</button>
        </div>
        <div className="preferences-volcano__stack">
          <div className="pond-path-item">
            <label>数据存储位置</label>
            <input type="text" className="pond-input" placeholder="/path/to/data" readOnly />
          </div>
          <div className="pond-path-item">
            <label>缓存目录</label>
            <input type="text" className="pond-input" placeholder="/path/to/cache" readOnly />
          </div>
        </div>
      </div>

      {/* 自动备份 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">自动备份</h3>
        <div className="preferences-volcano__stack">
          <PondSwitch label="启用自动备份" />
          <VolcanoSelect label="备份频率" options={['每天', '每周', '每月']} defaultValue="每天" />
          <div className="pond-inline-group">
            <label>保留备份数</label>
            <input type="number" className="pond-input pond-input--small" placeholder="10" />
          </div>
        </div>
      </div>

      {/* 自动评估 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">自动评估</h3>
        <div className="preferences-volcano__stack">
          <PondSwitch label="导入后自动评估数据质量" defaultChecked />
          <PondSwitch label="标注完成后自动验证" />
        </div>
      </div>

      {/* 数据保留 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">数据保留</h3>
        <div className="preferences-volcano__grid">
          <button className="pond-button">7天</button>
          <button className="pond-button">15天</button>
          <button className="pond-button">30天</button>
          <button className="pond-button">90天</button>
          <button className="pond-button">1年</button>
          <button className="pond-button">永久</button>
        </div>
      </div>
    </div>
  )
}

// 性能设置
const PerformanceSettings = () => {
  return (
    <div className="preferences-page">
      <h2 className="preferences-page__title">性能</h2>

      {/* 硬件加速 - 火山口 */}
      <div className="preferences-volcano">
        <div className="preferences-volcano__header">
          <h3 className="preferences-volcano__title">硬件加速</h3>
          <button className="pond-button pond-button--small">检测 GPU</button>
        </div>
        <div className="preferences-volcano__stack">
          <PondSwitch label="启用 GPU 加速" defaultChecked />
          <PondSwitch label="使用硬件编解码" defaultChecked />
        </div>
      </div>

      {/* 限制占用 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">限制占用</h3>
        <div className="preferences-volcano__stack">
          <VolcanoSelect label="最大内存使用" options={['2GB', '4GB', '8GB', '无限制']} defaultValue="2GB" />
          <div className="pond-inline-group">
            <label>CPU 核心数</label>
            <input type="text" className="pond-input pond-input--small" placeholder="自动" />
          </div>
        </div>
      </div>

      {/* 后台行为 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">后台行为</h3>
        <div className="preferences-volcano__stack">
          <PondSwitch label="最小化时降低性能" />
          <PondSwitch label="允许后台推理任务" defaultChecked />
          <PondSwitch label="空闲时自动暂停" />
        </div>
      </div>

      {/* 日志行为 - 火山口 */}
      <div className="preferences-volcano">
        <h3 className="preferences-volcano__title">日志行为</h3>
        <div className="preferences-volcano__stack">
          <VolcanoSelect label="日志级别" options={['错误', '警告', '信息', '调试']} defaultValue="信息" />
          <PondSwitch label="记录性能数据" />
        </div>
      </div>
    </div>
  )
}

export type { PreferencePage }
