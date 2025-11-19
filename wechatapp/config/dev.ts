import type { UserConfigExport } from '@tarojs/cli'

const config: UserConfigExport = {
  env: {
    NODE_ENV: 'development'
  },
  mini: {
    hot: true,
    debugReact: false
  },
  h5: {
    devServer: {
      host: '127.0.0.1',
      port: 10086
    }
  }
}

export default config
