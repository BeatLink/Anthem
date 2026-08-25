import type { AnthemApi, AnthemEvents, Channel, EventName } from '../shared/ipc'

declare global {
  interface Window {
    anthem: { [C in Channel]: (...args: Parameters<AnthemApi[C]>) => Promise<ReturnType<AnthemApi[C]>> }
    anthemEvents: {
      on<E extends EventName>(name: E, handler: (payload: AnthemEvents[E]) => void): () => void
    }
  }
}

export {}
