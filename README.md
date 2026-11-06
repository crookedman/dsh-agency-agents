<div align="center">
  <img src="assets/branding/dsh-banner.webp" alt="DSH Agency Agents" width="100%">
</div>

<div align="center">

  # DSH Agency Agents（个人分支）

  **331 位专业智能体 · 专家团 · 按专家指定模型**

  [English](README.en.md) · [更新日志](CHANGELOG.zh-CN.md) · [Apache-2.0](LICENSE)

  [![npm package](https://img.shields.io/npm/v/%40crookedman%2Fdsh-agency-agents.svg?label=npm%20package)](https://www.npmjs.com/package/@crookedman/dsh-agency-agents)
  [![许可证：Apache-2.0](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-Apache--2.0-blue.svg)](LICENSE)
  [![GitHub](https://img.shields.io/badge/GitHub-crookedman-181717.svg)](https://github.com/crookedman/dsh-agency-agents)
</div>

> 本 README 描述 1.2.30。
> 本插件是社区维护的 DeepSeek Harness（DSH）插件，并非 DeepSeek AI 官方产品。

## 这是什么

本仓库是 **[MichengAI/dsh-agency-agents](https://github.com/MichengAI/dsh-agency-agents)** 的个人分支（fork）。

上游为 DeepSeek Harness 提供 331 名可召唤的领域智能体与「专家团」；本分支基于上游 1.2.27 改造，
把包名与发布渠道换到 `@crookedman/dsh-agency-agents`，专家名册、智能体数据与其余功能与上游保持一致。

## 相对上游加了什么

- **按专家指定模型**：设置 → 专家 → 卡片上的「模型」按钮，可为单个专家固定 provider 与模型；
  不配置就继承主 Agent 的当前模型（升级前后行为一致）。自定义专家的新建/编辑弹窗同样支持。
- **专家团按模型自动降级**：原生 Agent Team 没有成员级模型参数，因此团队中只要有成员配置了模型，
  本次自动改用普通子代理执行以保证设置生效；provider 不支持时明确报错，而不是静默按父 Agent 运行。
- **卡片模型徽标**：限宽并省略显示，长模型名不再把专家名挤出标题行；悬停可看完整 provider/model。
- **独立发布身份**：包名、Cordis 挂载名、Remote 服务 id 与 HTTP 路由都在 `@crookedman` 域下，
  可与上游版本按包名区分；设置命名空间仍是 `agency-agents`，因此换包不丢已有配置。

## 安装

需要 DeepSeek Harness `>= 0.2.0-rc.1`。

```powershell
dsh plugin --profile desktop add @crookedman/dsh-agency-agents@1.2.28
```

也可以把命令里的 `desktop` 换成你使用的 profile 名（如 `web`）。升级时把版本号换掉重跑即可。

从源码构建：

```powershell
git clone https://github.com/crookedman/dsh-agency-agents.git
cd dsh-agency-agents
pnpm install
pnpm build
```

## 用法要点

1. **启用专家**：设置 → 专家，用开关选择哪些专家可以被召唤；支持搜索、按分区筛选与批量操作。
2. **召唤**：在对话里直接点名专家，或用「专家团」把多个专家编成一队并行评审。
3. **指定模型**：每位专家的「模型」按钮可单独指定 provider/模型；选择「按主 Agent」表示不指定。

## 模型绑定不随包走

每位专家的模型绑定保存在本机 profile 设置里（`agency-agents.expertModels`），不在 npm 包内。
换一台机器安装后需要重新配置，或迁移 profile 中的这段配置。

## 许可证与归属

本分支沿用 **Apache License 2.0**。智能体 persona 快照来自
[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)（MIT）与
[jnMetaCode/agency-agents-zh](https://github.com/jnMetaCode/agency-agents-zh)（MIT），
完整归属见 `NOTICE` 与 `assets/` 下的许可证文件。上游项目：
[MichengAI/dsh-agency-agents](https://github.com/MichengAI/dsh-agency-agents)。
