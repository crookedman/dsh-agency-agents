import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { agencySettingsSchema, createExpertLibrary, validateAgencySettings, type AgencySettings } from './expert-library.js'
import { settingsNamespaceCompat } from './settings-compat.js'
import { MemorySettings } from './settings-memory.js'
import {
  emptyModelCatalog, expertAgentOptions, expertModelOverrides, expertModelRouteOf, expertModelRouteSchema,
  modelCatalogSchema, modelRouteLabel, sameExpertModelRoute,
} from './expert-model.js'
import type { ExpertSummary } from './expert-contract.js'
import { apply } from './index.js'
import { detectTeamEngine } from './team-engine.js'

class TestSettings extends MemorySettings {
  protected async persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.disk[ns] = structuredClone(section)
  }
}

const builtin: ExpertSummary = {
  slug: 'builtin-reviewer',
  name: '审查员',
  nameEn: 'Reviewer',
  description: '代码审查',
  descriptionEn: '',
  division: 'engineering',
  divisionZh: '工程',
  emoji: '🔎',
  custom: false,
}

const customInput = {
  name: '租赁业务顾问',
  description: '订单与运营建议',
  division: 'specialized',
  emoji: '📦',
  avatar: 0,
  prompt: '请按租赁业务规则分析，不编造事实。',
}

function setup(
  document: Record<string, unknown> = { 'agency-agents': { enabled: ['builtin-reviewer'] } },
  base: () => Promise<ExpertSummary[]> = async () => [builtin],
) {
  const settings = new TestSettings(new Context())
  settings.restore(document)
  const ns = settingsNamespaceCompat('agency-agents')
  settings.register(ns, agencySettingsSchema, { validate: validateAgencySettings })
  const library = createExpertLibrary(base, {
    read: () => settings.get(ns) as AgencySettings,
    revision: () => settings.describe().find(item => item.ns === ns)!.revision,
    mutate: (ops, revision) => settings.mutate(ns, ops, revision),
  }, ['engineering', 'specialized'], () => 'zh')
  return { settings, ns, library }
}

describe('专家级模型路由契约', () => {
  it('provider 与 model 必须成对、非空且不接受多余字段', () => {
    expect(expertModelRouteSchema.safeParse({ provider: 'openai', model: 'gpt-5.1' }).success).toBe(true)
    expect(expertModelRouteSchema.safeParse({ provider: ' openai ', model: ' gpt-5.1 ' })).toMatchObject({
      success: true, data: { provider: 'openai', model: 'gpt-5.1' },
    })
    expect(expertModelRouteSchema.safeParse({ provider: '', model: 'gpt' }).success).toBe(false)
    expect(expertModelRouteSchema.safeParse({ provider: 'openai', model: '   ' }).success).toBe(false)
    expect(expertModelRouteSchema.safeParse({ provider: 'openai' }).success).toBe(false)
    expect(expertModelRouteSchema.safeParse({ provider: 'openai', model: 'gpt', extra: 1 }).success).toBe(false)
  })

  it('未配置模型时不产生 agentOptions，配置后原样下发并保留 reasoningEffort', () => {
    expect(expertAgentOptions(undefined)).toBeUndefined()
    expect(expertAgentOptions({ provider: 'p', model: 'm' })).toEqual({ provider: 'p', model: 'm' })
    expect(expertAgentOptions({ provider: 'p', model: 'm', reasoningEffort: 'high' }))
      .toEqual({ provider: 'p', model: 'm', reasoningEffort: 'high' })
  })

  it('存储条目折叠成按 slug 的路由表，比较与展示与条数无关', () => {
    const bindings = [
      { slug: 'a', provider: 'p', model: 'm' },
      { slug: 'b', provider: 'q', model: 'n', reasoningEffort: 'low' },
    ]
    expect(expertModelOverrides(bindings)).toEqual({
      a: { provider: 'p', model: 'm' },
      b: { provider: 'q', model: 'n', reasoningEffort: 'low' },
    })
    expect(expertModelOverrides(undefined)).toEqual({})
    expect(expertModelRouteOf(bindings[1]!)).toEqual({ provider: 'q', model: 'n', reasoningEffort: 'low' })
    expect(sameExpertModelRoute(undefined, undefined)).toBe(true)
    expect(sameExpertModelRoute({ provider: 'p', model: 'm' }, undefined)).toBe(false)
    expect(sameExpertModelRoute({ provider: 'p', model: 'm' }, { provider: 'p', model: 'm' })).toBe(true)
    expect(sameExpertModelRoute({ provider: 'p', model: 'm' }, { provider: 'p', model: 'n' })).toBe(false)
    expect(modelRouteLabel({ provider: 'p', model: 'm' })).toBe('p/m')
  })

  it('空模型目录合法：宿主没有 llm 服务时选择器仍可渲染', () => {
    expect(modelCatalogSchema.parse(emptyModelCatalog())).toEqual({ providers: [] })
  })
})

describe('专家模型持久化', () => {
  it('为内置专家写入路由并随名册返回，重复设置只保留最新一条', async () => {
    const { settings, ns, library } = setup()
    const before = await library.catalog()
    expect(before.models ?? []).toEqual([])

    const bound = await library.setExpertModel('builtin-reviewer', { provider: 'openai', model: 'gpt-5.1' }, before.revision)
    expect(bound.models).toEqual([{ slug: 'builtin-reviewer', provider: 'openai', model: 'gpt-5.1' }])
    expect((settings.get(ns) as AgencySettings).expertModels).toEqual([
      { slug: 'builtin-reviewer', provider: 'openai', model: 'gpt-5.1' },
    ])

    const rebound = await library.setExpertModel('builtin-reviewer', { provider: 'anthropic', model: 'claude' }, bound.revision)
    expect(rebound.models).toEqual([{ slug: 'builtin-reviewer', provider: 'anthropic', model: 'claude' }])
  })

  it('清除路由后恢复「按父 Agent」', async () => {
    const { library } = setup({
      'agency-agents': {
        enabled: ['builtin-reviewer'],
        expertModels: [{ slug: 'builtin-reviewer', provider: 'openai', model: 'gpt' }],
      },
    })
    const bound = await library.catalog()
    expect(bound.models?.length).toBe(1)
    const cleared = await library.setExpertModel('builtin-reviewer', null, bound.revision)
    expect(cleared.models ?? []).toEqual([])
  })

  it('拒绝未知专家与非法路由，且不产生任何写入', async () => {
    const { library } = setup()
    const before = await library.catalog()
    await expect(library.setExpertModel('missing-expert', { provider: 'p', model: 'm' }, before.revision)).rejects.toThrow()
    await expect(library.setExpertModel('builtin-reviewer', { provider: '', model: 'm' }, before.revision)).rejects.toThrow()
    const after = await library.catalog()
    expect(after.revision).toBe(before.revision)
    expect(after.models ?? []).toEqual([])
  })

  it('自定义专家改名后路由仍按 slug 生效，删除专家时一并清理', async () => {
    const { library } = setup()
    const created = await library.saveCustom(customInput, true, (await library.catalog()).revision)
    const custom = created.experts.find(expert => expert.custom)
    expect(custom).toBeDefined()

    const bound = await library.setExpertModel(custom!.slug, { provider: 'p', model: 'm' }, created.revision)
    expect(bound.models).toEqual([{ slug: custom!.slug, provider: 'p', model: 'm' }])

    const renamed = await library.saveCustom({ ...customInput, slug: custom!.slug, name: '新名字' }, true, bound.revision)
    expect(renamed.models).toEqual([{ slug: custom!.slug, provider: 'p', model: 'm' }])

    const removed = await library.deleteCustom(custom!.slug, renamed.revision)
    expect(removed.models ?? []).toEqual([])
  })

  it('名册只返回仍存在专家的路由，未知 slug 的配置保留在原处', async () => {
    const ghost = { slug: 'ghost-expert', provider: 'p', model: 'm' }
    const { settings, ns, library } = setup({ 'agency-agents': { enabled: ['builtin-reviewer'], expertModels: [ghost] } })
    const snapshot = await library.catalog()
    expect(snapshot.models ?? []).toEqual([])
    expect((settings.get(ns) as AgencySettings).expertModels).toEqual([ghost])
  })

  it('设置文档拒绝重复 slug 的绑定', () => {
    expect(() => validateAgencySettings({
      enabled: [],
      customExperts: [],
      expertModels: [
        { slug: 'dup', provider: 'p', model: 'm' },
        { slug: 'dup', provider: 'q', model: 'n' },
      ],
    } as never)).toThrow()
  })
})

interface Harness {
  tools: unknown[]
  specs: Array<Record<string, any>>
  summon: { execute: (args: unknown, exec: unknown) => Promise<unknown> }
}

async function summonHarness(
  config: Record<string, unknown>,
  capabilities: Record<string, unknown>,
  mode: 'activation' | 'start' = 'activation',
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'aag-model-'))
  await mkdir(join(dir, 'engineering'), { recursive: true })
  await writeFile(join(dir, 'engineering', 'reviewer.md'), '---\nname: Reviewer\ndescription: d\n---\nbody', 'utf8')
  const tools: unknown[] = []
  const specs: Array<Record<string, any>> = []
  const subagents = mode === 'activation'
    ? {
        getProvider: () => ({ capabilities }),
        startActivation: async (spec: Record<string, any>) => {
          specs.push(spec)
          return {
            childId: 'child-1',
            result: Promise.resolve({ output: [{ type: 'text', text: 'done' }], stopReason: 'completed' }),
            dispose: async () => undefined,
          }
        },
      }
    : {
        getProvider: () => ({ capabilities }),
        start: async (name: string, spec: Record<string, any>) => {
          specs.push({ provider: name, ...spec })
          return {
            result: Promise.resolve({ output: [{ type: 'text', text: 'done' }], stopReason: 'completed' }),
            dispose: async () => undefined,
          }
        },
      }
  const ctx = {
    tools: { register: (tool: unknown) => tools.push(tool) },
    subagents,
    systemPrompt: { section: () => undefined },
    on: () => () => undefined,
    settings: {
      describe: () => [{ ns: 'agency-agents', revision: 0 }],
      get: (namespace: string): unknown => (namespace === 'agency-agents' ? { enabled: ['reviewer'] } : undefined),
    },
    inject: (_deps: unknown, cb: (sctx: unknown) => void) => {
      cb({ settings: { register: () => ({ get: () => ({ enabled: ['reviewer'] }), watch: () => () => {} }) }, effect: () => () => {} })
    },
    reflect: { provide: () => undefined },
  } as unknown as Context
  apply(ctx, {
    root: dir,
    provider: 'spawn',
    divisions: ['engineering'],
    enabled: { get: () => ['reviewer'] },
    ...config,
  } as never)
  const summon = tools.find(tool => (tool as { name?: string }).name === 'summon_expert') as Harness['summon']
  return { tools, specs, summon }
}

describe('专家团引擎回退', () => {
  const nativeService = (): Record<string, unknown> => Object.fromEntries(
    ['tryMembership', 'listMembers', 'spawnTeammate', 'sendMessage', 'createTask', 'updateTask', 'waitForChange', 'interrupt']
      .map(name => [name, () => undefined]),
  )

  it('成员配置了专家级模型时放弃原生团队，改用普通子代理落实模型', () => {
    const status = detectTeamEngine(nativeService(), true, true, undefined, 'zh', true)
    expect(status.mode).toBe('subagent')
    expect(status.reason).toContain('模型')
  })

  it('没有成员配置模型时仍走原生团队', () => {
    expect(detectTeamEngine(nativeService(), true, true, undefined, 'zh', false).mode).toBe('native')
  })
})


const fullCapabilities = { persona: true, toolFilter: true, depthLimit: true, agentOptions: true }

describe('专家模型下发给子代理', () => {
  it('未配置模型时不传 agentOptions，子代理沿用父会话模型', async () => {
    const harness = await summonHarness({}, fullCapabilities)
    await expect(harness.summon.execute({ expert: 'reviewer', task: 'review' }, { agent: {} }))
      .resolves.toEqual({ expert: 'Reviewer', answer: 'done' })
    expect(harness.specs[0]!.request.agentOptions).toBeUndefined()
  })

  it('配置了模型的专家把 provider/model 交给 startActivation', async () => {
    const harness = await summonHarness({
      expertModels: [{ slug: 'reviewer', provider: 'openai', model: 'gpt-5.1' }],
    }, fullCapabilities)
    await harness.summon.execute({ expert: 'reviewer', task: 'review' }, { agent: {} })
    expect(harness.specs[0]!.request.agentOptions).toEqual({ provider: 'openai', model: 'gpt-5.1' })
  })

  it('旧版 start 通道同样转发模型设置', async () => {
    const harness = await summonHarness({
      expertModels: [{ slug: 'reviewer', provider: 'openai', model: 'gpt-5.1', reasoningEffort: 'high' }],
    }, fullCapabilities, 'start')
    await harness.summon.execute({ expert: 'reviewer', task: 'review' }, { agent: {} })
    expect(harness.specs[0]!.agentOptions).toEqual({ provider: 'openai', model: 'gpt-5.1', reasoningEffort: 'high' })
  })

  it('provider 不支持 agentOptions 时明确报错，而不是静默按父 Agent 运行', async () => {
    const harness = await summonHarness({
      expertModels: [{ slug: 'reviewer', provider: 'openai', model: 'gpt-5.1' }],
    }, { persona: true, toolFilter: true, depthLimit: true })
    await expect(harness.summon.execute({ expert: 'reviewer', task: 'review' }, { agent: {} }))
      .rejects.toThrow(/expert-level model|专家级模型/u)
    expect(harness.specs).toEqual([])
  })
})
