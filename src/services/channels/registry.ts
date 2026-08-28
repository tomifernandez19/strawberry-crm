import type { Canal, ChannelAdapter } from "./types"
import { instagramAdapter } from "./instagram"

const ADAPTERS: Partial<Record<Canal, ChannelAdapter>> = {
  instagram: instagramAdapter,
}

export function getChannelAdapter(canal: Canal): ChannelAdapter {
  const adapter = ADAPTERS[canal]
  if (!adapter) throw new Error(`Todavía no hay adaptador para el canal "${canal}"`)
  return adapter
}
