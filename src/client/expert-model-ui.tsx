import React from 'react'
import { Button, Modal } from './plugin-ui.js'
import { CategorySelect } from './category-select.js'
import { useEscapeLayer } from './escape-layer.js'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CatalogSnapshot } from '../expert-contract.js'
import { modelRouteLabel, type ExpertModelRoute, type ModelCatalog } from '../expert-model.js'
import type { AgencyCatalogRemote } from './remote.js'

type Translator = TranslateNS<'agency'>

/** 共享的 provider/模型两级选择器；value 为 null 表示「按主 Agent」。 */
export function ModelPicker(props: {
  readonly catalog: ModelCatalog | null
  readonly value: ExpertModelRoute | null
  readonly disabled?: boolean
  readonly t: Translator
  readonly onChange: (value: ExpertModelRoute | null) => void
}): React.ReactElement {
  const catalog = props.catalog
  const provider = props.value?.provider ?? ''
  const providerEntry = catalog?.providers.find(item => item.provider === provider)
  const models = providerEntry?.models ?? []
  const providerOptions = [
    { value: '', label: props.t('model.inherit') },
    ...(catalog?.providers ?? []).map(item => ({ value: item.provider, label: item.name === item.provider ? item.provider : `${item.name} · ${item.provider}` })),
  ]
  const modelOptions = models.map(item => ({ value: item.id, label: item.name === item.id ? item.id : `${item.name} · ${item.id}` }))
  const selectProvider = (next: string): void => {
    if (next === '') {
      props.onChange(null)
      return
    }
    const first = catalog?.providers.find(item => item.provider === next)?.models[0]?.id ?? ''
    props.onChange({ provider: next, model: first })
  }
  return (
    <div className="aag-model-picker">
      <label className="aag-model-field">
        <span>{props.t('model.provider')}</span>
        <CategorySelect
          id="aag-model-provider"
          value={provider}
          disabled={props.disabled === true || catalog === null}
          label={props.t('model.provider')}
          options={providerOptions}
          onChange={selectProvider}
        />
      </label>
      <label className="aag-model-field">
        <span>{props.t('model.model')}</span>
        <CategorySelect
          id="aag-model-model"
          value={props.value?.model ?? ''}
          disabled={props.disabled === true || provider === '' || models.length === 0}
          label={props.t('model.model')}
          options={modelOptions}
          onChange={(next) => props.onChange({ provider, model: next })}
        />
      </label>
    </div>
  )
}

/** 专家卡片上的模型徽标；未配置模型的专家不渲染任何内容。 */
export function ExpertModelBadge(props: { readonly route: ExpertModelRoute | undefined; readonly t: Translator }): React.ReactElement | null {
  if (props.route === undefined) return null
  return (
    <span className="aag-model-pill" title={`${props.t('model.badge')}：${modelRouteLabel(props.route)}`}>
      {props.route.model}
    </span>
  )
}

/** 单专家模型配置弹窗：读取宿主模型目录、写入或清除该专家的路由。 */
export function ExpertModelDialog(props: {
  readonly name: string
  readonly slug: string
  readonly value: ExpertModelRoute | undefined
  readonly revision: number
  readonly remote: AgencyCatalogRemote
  readonly t: Translator
  readonly onSaved: (catalog: CatalogSnapshot) => void
  readonly onClose: () => void
}): React.ReactElement {
  const [catalog, setCatalog] = React.useState<ModelCatalog | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<ExpertModelRoute | null>(props.value ?? null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const saving = React.useRef(false)
  const close = (): void => { if (!saving.current) props.onClose() }
  useEscapeLayer(true, close)
  React.useEffect(() => {
    let cancelled = false
    void props.remote.listModels().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setLoadError(result.error.message)
        return
      }
      setCatalog(result.value)
    }).catch((cause: unknown) => {
      if (!cancelled) setLoadError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => { cancelled = true }
  }, [props.remote])
  const save = (): void => {
    if (saving.current) return
    if (draft !== null && (draft.provider.trim() === '' || draft.model.trim() === '')) {
      setError(props.t('model.invalid'))
      return
    }
    saving.current = true
    setBusy(true)
    setError(null)
    void props.remote.setExpertModel(props.slug, draft, props.revision).then((result) => {
      if (!result.ok) throw new Error(result.error.message)
      props.onSaved(result.value)
    }).catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : String(cause)
      const conflict = /changed since it was read|其他窗口|another window/iu.test(message)
      setError(conflict ? props.t('error.conflict') : message)
    }).finally(() => { saving.current = false; setBusy(false) })
  }
  const selectedProvider = draft === null ? undefined : catalog?.providers.find(item => item.provider === draft.provider)
  const emptyNote = catalog !== null && catalog.providers.length === 0
  return (
    <Modal
      open
      className="aag-model-modal"
      title={props.t('model.title', { name: props.name })}
      description={props.t('model.desc')}
      closeLabel={props.t('settings.promptClose')}
      onClose={close}
      footer={[
        <Button key="clear" disabled={busy || draft === null} onClick={() => { setDraft(null); setError(null) }}>{props.t('model.clear')}</Button>,
        <Button key="cancel" disabled={busy} onClick={close}>{props.t('model.cancel')}</Button>,
        <Button key="save" type="primary" disabled={busy} loading={busy} onClick={save}>{props.t(busy ? 'model.saving' : 'model.save')}</Button>,
      ]}
    >
      {catalog === null && loadError === null ? <p className="aag-model-note">{props.t('model.loading')}</p> : null}
      {loadError === null ? null : <p className="aag-error" role="alert">{props.t('model.error', { error: loadError })}</p>}
      {emptyNote ? <p className="aag-model-note">{props.t('model.empty')}</p> : null}
      <ModelPicker
        catalog={catalog}
        value={draft}
        disabled={busy}
        t={props.t}
        onChange={(next) => { setDraft(next); setError(null) }}
      />
      {selectedProvider?.error === undefined ? null : (
        <p className="aag-model-note">{props.t('model.error', { error: selectedProvider.error })}</p>
      )}
      {error === null ? null : <p className="aag-error" role="alert">{error}</p>}
    </Modal>
  )
}

export const EXPERT_MODEL_CSS = `
.aag-model-picker{display:flex;flex-wrap:wrap;gap:16px;margin:4px 0 12px}
.aag-model-field{display:flex;flex-direction:column;gap:8px;font-size:13px;min-width:0}
.aag-model-field>span{color:var(--dsw-alias-label-secondary);font-size:12px}
.aag-card-division{flex-wrap:nowrap;overflow:hidden;min-width:0}
.aag-card-division>.aag-division-pill,.aag-card-division>.aag-custom-badge{flex:0 0 auto}
.aag-model-pill{display:inline-block;flex:0 1 auto;min-width:0;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:16px;padding:0 6px;border-radius:var(--dsw-radius-xs,4px);border:0.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);vertical-align:middle}
.aag-model-modal{width:min(560px,100%)!important}
.aag-model-note{margin:4px 0 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:normal;overflow-wrap:anywhere}
`
