import { PropsWithChildren, useEffect } from 'react'
import { useLaunch } from '@tarojs/taro'

import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('CancerApp mini shell launched')
  })

  useEffect(() => {
    // 预留全局初始化逻辑
  }, [])

  return children
}

export default App
