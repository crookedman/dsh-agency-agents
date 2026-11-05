import type { TeamInput, TeamSnapshot } from '../team-contract.js'
import type { StoredProposal, LatestProposal } from '../creation-tools.js'
/**
 * 手写的 Typert Remote 贡献（等价 generator 的 typert.remote-client 产物）。
 * 本插件的名册、管理及启停方法采用手写贡献，避免依赖 monorepo
 * 专用 generator；严格 descriptor 与 host 共用同一来源，避免两侧契约漂移。
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { AGENCY_AGENTS_DESCRIPTORS } from '../remote-contract.js'
import type { CatalogSnapshot, CustomExpertInput } from '../expert-contract.js'
import type { ExpertModelRoute, ModelCatalog } from '../expert-model.js'

export interface AgencyTeamsRemote {
  getTeams(): Promise<RemoteResult<TeamSnapshot>>
  saveTeam(team: TeamInput, enabled: boolean, expectedRevision: number): Promise<RemoteResult<TeamSnapshot>>
  setTeamEnabled(id: string, enabled: boolean, expectedRevision: number): Promise<RemoteResult<TeamSnapshot>>
  deleteTeam(id: string, expectedRevision: number): Promise<RemoteResult<TeamSnapshot>>
}
export interface AgencyCatalogRemote {
  getCatalog(): Promise<RemoteResult<CatalogSnapshot>>
  getCustomExpert(slug: string): Promise<RemoteResult<CustomExpertInput>>
  saveCustomExpert(expert: CustomExpertInput, enabled: boolean, expectedRevision: number): Promise<RemoteResult<CatalogSnapshot>>
  deleteCustomExpert(slug: string, expectedRevision: number): Promise<RemoteResult<CatalogSnapshot>>
  /** 写入或清除一位专家的模型路由；null 表示恢复「按主 Agent」。 */
  setExpertModel(slug: string, route: ExpertModelRoute | null, expectedRevision: number): Promise<RemoteResult<CatalogSnapshot>>
  /** 宿主已注册的 provider/模型目录，供模型选择器使用。 */
  listModels(): Promise<RemoteResult<ModelCatalog>>
}

export interface AgencyCreationRemote {
  getPendingProposal(id: string): Promise<RemoteResult<StoredProposal | null>>
  getLatestProposal(afterTimestamp: number, sessionId?: string): Promise<RemoteResult<LatestProposal>>
}

export interface AgencyAgentsEnabledState {
  readonly enabled: string[]
  readonly revision: number
}

export interface AgencyAgentsPrompt {
  readonly prompt: string
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$agencyAgents extends AgencyCatalogRemote, AgencyTeamsRemote, AgencyCreationRemote {
    getEnabled: () => Promise<RemoteResult<AgencyAgentsEnabledState>>
    setEnabled: (enabled: string[], expectedRevision: number) => Promise<RemoteResult<AgencyAgentsEnabledState>>
    getPrompt: (slug: string, division: string) => Promise<RemoteResult<AgencyAgentsPrompt>>
  }
  interface TypertRemoteMap {
    'agencyAgents/getTeams': AgencyTeamsRemote['getTeams']
    'agencyAgents/saveTeam': AgencyTeamsRemote['saveTeam']
    'agencyAgents/setTeamEnabled': AgencyTeamsRemote['setTeamEnabled']
    'agencyAgents/deleteTeam': AgencyTeamsRemote['deleteTeam']
    'agencyAgents/getCatalog': AgencyCatalogRemote['getCatalog']
    'agencyAgents/getCustomExpert': AgencyCatalogRemote['getCustomExpert']
    'agencyAgents/saveCustomExpert': AgencyCatalogRemote['saveCustomExpert']
    'agencyAgents/deleteCustomExpert': AgencyCatalogRemote['deleteCustomExpert']
    'agencyAgents/setExpertModel': AgencyCatalogRemote['setExpertModel']
    'agencyAgents/listModels': AgencyCatalogRemote['listModels']
    'agencyAgents/getEnabled': () => Promise<RemoteResult<AgencyAgentsEnabledState>>
    'agencyAgents/setEnabled': (enabled: string[], expectedRevision: number) => Promise<RemoteResult<AgencyAgentsEnabledState>>
    'agencyAgents/getPrompt': (slug: string, division: string) => Promise<RemoteResult<AgencyAgentsPrompt>>
    'agencyAgents/getPendingProposal': AgencyCreationRemote['getPendingProposal']
    'agencyAgents/getLatestProposal': AgencyCreationRemote['getLatestProposal']
  }
  interface TypertRemoteNamespaceMap {
    'agencyAgents': TypertRemoteNamespace$agencyAgents
  }
}

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@crookedman/dsh-agency-agents',
  descriptors: AGENCY_AGENTS_DESCRIPTORS,
}
export default TYPERT_REMOTE
