/**
 * 专家级模型路由：允许给单个专家指定 provider/model（可选 reasoningEffort）。
 *
 * 未配置的专家不写入任何 `agentOptions`，子代理因此沿用父会话当前模型——这正是
 * 宿主 `resolveChildAgentOptions()` 的默认语义，插件不需要复制继承逻辑。
 *
 * 该文件不依赖运行时服务，Host 与 Client 共用同一套校验。
 */
import { z } from 'zod'

export const EXPERT_MODEL_PROVIDER_MAX = 64
export const EXPERT_MODEL_ID_MAX = 128
export const EXPERT_MODEL_EFFORT_MAX = 64
/** 331 位内置专家加自定义专家的上限余量；超出视为配置损坏。 */
export const EXPERT_MODEL_LIMIT = 400

/** 一条 provider/model 路由。provider 与 model 必须成对出现，宿主不接受单独覆盖。 */
export const expertModelRouteSchema = z.object({
  provider: z.string().trim().min(1).max(EXPERT_MODEL_PROVIDER_MAX),
  model: z.string().trim().min(1).max(EXPERT_MODEL_ID_MAX),
  reasoningEffort: z.string().trim().min(1).max(EXPERT_MODEL_EFFORT_MAX).optional(),
}).strict()

export type ExpertModelRoute = z.infer<typeof expertModelRouteSchema>

/** settings 中的持久条目：按专家 slug 记录一条路由。 */
export const expertModelBindingSchema = expertModelRouteSchema.extend({
  slug: z.string().trim().min(1).max(128),
}).strict()

export type ExpertModelBinding = z.infer<typeof expertModelBindingSchema>

export const expertModelBindingsSchema = z.array(expertModelBindingSchema).max(EXPERT_MODEL_LIMIT)

/** 按 slug 查找的路由表；缺少某个 slug 表示该专家继承父会话模型。 */
export type ExpertModelOverrides = Readonly<Record<string, ExpertModelRoute>>

/** 传给宿主 `SubagentStartRequest.agentOptions` 的最小形状。 */
export interface ExpertAgentOptions {
  provider: string
  model: string
  reasoningEffort?: string
}

export function modelRouteLabel(route: { provider: string; model: string }): string {
  return `${route.provider}/${route.model}`
}

export function sameExpertModelRoute(a: ExpertModelRoute | undefined, b: ExpertModelRoute | undefined): boolean {
  if (a === undefined || b === undefined) return a === undefined && b === undefined
  return a.provider === b.provider && a.model === b.model && a.reasoningEffort === b.reasoningEffort
}

/** 去掉只用于存储的 slug，得到可直接交给宿主的路由。 */
export function expertModelRouteOf(binding: ExpertModelBinding): ExpertModelRoute {
  return {
    provider: binding.provider,
    model: binding.model,
    ...(binding.reasoningEffort === undefined ? {} : { reasoningEffort: binding.reasoningEffort }),
  }
}

/** 把 settings 数组折叠成按 slug 查找的路由表；写入端保证 slug 唯一，这里只做最后一次收敛。 */
export function expertModelOverrides(bindings: readonly ExpertModelBinding[] | undefined): ExpertModelOverrides {
  const map: Record<string, ExpertModelRoute> = {}
  for (const binding of bindings ?? []) map[binding.slug] = expertModelRouteOf(binding)
  return map
}

/** 合并成宿主的 `agentOptions`；没有配置时返回 undefined，保持「按父 Agent」的默认行为。 */
export function expertAgentOptions(route: ExpertModelRoute | undefined): ExpertAgentOptions | undefined {
  if (route === undefined) return undefined
  return {
    provider: route.provider,
    model: route.model,
    ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
  }
}

/** 宿主 `llm` 服务已注册的 provider 及其可发现模型，供设置页的模型选择器使用。 */
export const modelCatalogSchema = z.object({
  providers: z.array(z.object({
    provider: z.string(),
    name: z.string(),
    models: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
    })),
    /** provider 目录读取失败时仍保留该 provider，让用户看到原因而不是整页空白。 */
    error: z.string().optional(),
  })),
})

export type ModelCatalog = z.infer<typeof modelCatalogSchema>

/** 空目录：宿主没有 llm 服务或尚未注册 provider 时的确定结果。 */
export function emptyModelCatalog(): ModelCatalog {
  return { providers: [] }
}
