module.exports = {
  presets: [
    [
      'taro',
      {
        framework: 'react',
        ts: true,
        // 对于微信小程序运行时，JS 引擎本身已经是现代环境，
        // 这里关闭基于 core-js-pure 的自动 polyfill 注入，
        // 避免与小程序环境的 window/document 兼容性问题。
        useBuiltIns: false
      }
    ]
  ]
}
