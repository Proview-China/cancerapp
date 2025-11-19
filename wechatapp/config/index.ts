import { defineConfig } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig<{ env?: Record<string, any> }>(({ command, mode }) => {
  const baseConfig = {
    projectName: 'cancerapp-wechat-shell',
    date: '2024-11-19',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    defineConstants: {
      WECHATAPP_API_BASE: JSON.stringify(process.env.WECHATAPP_API_BASE ?? 'http://localhost:4000'),
      WECHATAPP_USE_DEMO: JSON.stringify(process.env.WECHATAPP_USE_DEMO ?? 'true'),
      ENABLE_INNER_HTML: JSON.stringify(true),
      ENABLE_ADJACENT_HTML: JSON.stringify(true),
      development: JSON.stringify(mode === 'production' ? 'production' : 'development')
    },
    copy: {
      patterns: [],
      options: {}
    },
    // 启用 React 框架插件，注入 taroDocumentProvider 等运行时代码
    plugins: ['@tarojs/plugin-framework-react'],
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false
      }
    },
    cache: {
      enable: false
    }
  }

  if (command === 'build' && mode === 'production') {
    return Object.assign({}, baseConfig, prodConfig)
  }
  return Object.assign({}, baseConfig, devConfig)
})
