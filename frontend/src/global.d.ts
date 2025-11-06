declare global {
  interface Window {
    electronAPI?: {
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
      platform: string
      openSampleImport?: () => Promise<Array<{ name: string; mimeType: string; data: string }> | undefined>
    }
  }
}

export {}
