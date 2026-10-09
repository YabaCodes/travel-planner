// A new version is downloaded in the background. Instead of reloading the page on its own (which
// could throw away a half-filled form), the app shows a banner and reloads only when asked.
type Listener = () => void

let ready = false
let apply: (() => Promise<void>) | null = null
const listeners = new Set<Listener>()

export const pwaUpdate = {
  setApply(fn: () => Promise<void>) {
    apply = fn
  },
  markReady() {
    ready = true
    listeners.forEach((listener) => listener())
  },
  isReady: () => ready,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  async reload() {
    if (apply) await apply()
    else window.location.reload()
  },
}
