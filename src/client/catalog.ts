import { EN_DIVISION } from '../names.js'
import type { CatalogSnapshot, ExpertSummary } from '../expert-contract.js'
import type { ExpertModelBinding, ExpertModelRoute } from '../expert-model.js'
import type { AgencyCatalogRemote } from './remote.js'

export interface ExpertView extends ExpertSummary { readonly divisionEn: string }
export interface CatalogState {
  readonly experts: readonly ExpertView[]
  readonly enabled: ReadonlySet<string>
  /** 专家级模型路由；缺少 slug 表示该专家按主 Agent 的模型运行。 */
  readonly models: readonly ExpertModelBinding[]
  readonly revision: number
}
interface CatalogCache {
  value: CatalogState
  listeners: Set<() => void>
  pending?: Promise<CatalogState>
  generation: number
}
const caches = new WeakMap<AgencyCatalogRemote, CatalogCache>()
function cache(remote: AgencyCatalogRemote): CatalogCache {
  let value = caches.get(remote)
  if (value === undefined) {
    value = { value: { experts: [], enabled: new Set(), models: [], revision: -1 }, listeners: new Set(), generation: 0 }
    caches.set(remote, value)
  }
  return value
}
export function catalogState(remote: AgencyCatalogRemote): CatalogState { return cache(remote).value }
export function subscribeCatalog(remote: AgencyCatalogRemote, listener: () => void): () => void {
  const entry = cache(remote)
  entry.listeners.add(listener)
  return () => { entry.listeners.delete(listener) }
}
/** 每个连接独立缓存，异步旧响应不能覆盖新提交；通知所有已打开的选择器。 */
export function acceptCatalog(remote: AgencyCatalogRemote, value: CatalogSnapshot): CatalogState {
  const entry = cache(remote)
  if (value.revision < entry.value.revision) return entry.value
  entry.pending = undefined
  return publishCatalog(remote, value)
}

// 查询允许宿主重启后的 revision 重置；写回执必须先通过上面的顺序检查。
function publishCatalog(remote: AgencyCatalogRemote, value: CatalogSnapshot): CatalogState {
  const entry = cache(remote)
  entry.generation += 1
  const experts = value.experts.map(expert => ({ ...expert, divisionEn: EN_DIVISION[expert.division] ?? expert.division }))
  const models = value.models ?? []
  if (value.revision === entry.value.revision && JSON.stringify(experts) === JSON.stringify(entry.value.experts)
    && JSON.stringify(models) === JSON.stringify(entry.value.models)
    && value.enabled.length === entry.value.enabled.size && value.enabled.every(slug => entry.value.enabled.has(slug))) return entry.value
  entry.value = {
    experts,
    enabled: new Set(value.enabled), revision: value.revision, models,
  }
  for (const listener of entry.listeners) listener()
  return entry.value
}
/** 该专家是否配置了模型；undefined 表示继承父会话。只依赖 models 字段，兼容各处的名册视图。 */
export function expertModelOf(state: { readonly models: readonly ExpertModelBinding[] }, slug: string): ExpertModelRoute | undefined {
  const binding = state.models.find(item => item.slug === slug)
  if (binding === undefined) return undefined
  return {
    provider: binding.provider,
    model: binding.model,
    ...(binding.reasoningEffort === undefined ? {} : { reasoningEffort: binding.reasoningEffort }),
  }
}
/** 专家团写入推进了同一份设置修订号。立刻通知已打开的专家页，避免它仍拿旧号保存。 */
export function adoptSharedRevision(remote: AgencyCatalogRemote, revision: number, enabled: readonly string[]): CatalogState {
  const current = catalogState(remote)
  if (current.revision < 0 || revision < current.revision) return current
  return acceptCatalog(remote, {
    experts: current.experts.map(({ divisionEn: _divisionEn, ...expert }) => expert),
    enabled: [...enabled],
    models: [...current.models],
    revision,
  })
}

export function acceptEnabled(remote: AgencyCatalogRemote, value: { enabled: string[]; revision: number }): CatalogState {
  const entry = cache(remote)
  if (value.revision < entry.value.revision) return entry.value
  return acceptCatalog(remote, {
    experts: [...entry.value.experts],
    enabled: value.enabled,
    models: [...entry.value.models],
    revision: value.revision,
  })
}
/** 一次 @ 查询会并发读取多个分区，复用同一个请求而不重复传输名册。 */
export function refreshCatalog(remote: AgencyCatalogRemote): Promise<CatalogState> {
  const entry = cache(remote)
  if (entry.pending !== undefined) return entry.pending
  const generation = entry.generation
  const pending = remote.getCatalog().then(result => {
    // 写入完成后的提交优先于此前发出的查询；新查询允许宿主重启后的 revision 回落。
    if (generation !== entry.generation) return entry.value
    if (!result.ok) throw new Error(result.error.message)
    return publishCatalog(remote, result.value)
  }).finally(() => { if (entry.pending === pending) entry.pending = undefined })
  entry.pending = pending
  return pending
}
