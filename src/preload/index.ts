import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type AnthemApi, type Channel } from '@shared/ipc'

// The renderer gets exactly the channels declared in the contract, and nothing else.
const api = Object.fromEntries(
  CHANNELS.map((c) => [c, (...args: unknown[]) => ipcRenderer.invoke(c, ...args)])
) as { [C in Channel]: (...args: Parameters<AnthemApi[C]>) => Promise<ReturnType<AnthemApi[C]>> }

contextBridge.exposeInMainWorld('anthem', api)
