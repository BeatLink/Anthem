// Renderer-side entry point for every IPC call.
//
// contextBridge clones arguments as they cross from the page's world into the preload's isolated
// world, and that clone happens *before* any preload code runs. So a Svelte 5 reactive Proxy has to
// be flattened here, in the renderer, or the call fails with "An object could not be cloned" no
// matter what the preload does. Calling window.anthem directly is a bug waiting to happen; call
// this instead.

import { toCloneable, type AnthemApi, type Channel } from '@shared/ipc'

export function ipc<C extends Channel>(
  channel: C,
  ...args: Parameters<AnthemApi[C]>
): Promise<ReturnType<AnthemApi[C]>> {
  const plain = args.map(toCloneable) as Parameters<AnthemApi[C]>
  return window.anthem[channel](...plain)
}
