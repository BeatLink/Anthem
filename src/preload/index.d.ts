import type { AnthemApi, Channel } from '../shared/ipc'

declare global {
  interface Window {
    anthem: { [C in Channel]: (...args: Parameters<AnthemApi[C]>) => Promise<ReturnType<AnthemApi[C]>> }
  }
}

export {}
