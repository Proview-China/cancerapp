import type { AppConfig } from '@tarojs/taro'

const config: AppConfig = {
  pages: ['pages/index/index', 'pages/case-detail/index', 'pages/ai-chat/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f8f4ef',
    navigationBarTitleText: 'CancerApp 病例库',
    navigationBarTextStyle: 'black',
    navigationStyle: 'custom'
  }
}

export default config
