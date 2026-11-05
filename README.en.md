<div align="center">
  <img src="assets/branding/dsh-banner-en.webp" alt="DSH Agency Agents" width="100%">
</div>

<div align="center">

  # DSH Agency Agents (personal fork)

  **331 domain experts · expert teams · per-expert model binding**

  [简体中文](README.zh-CN.md) · [Changelog](CHANGELOG.md) · [Apache-2.0](LICENSE)

  [![npm package](https://img.shields.io/npm/v/%40crookedman%2Fdsh-agency-agents.svg?label=npm%20package)](https://www.npmjs.com/package/@crookedman/dsh-agency-agents)
  [![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
  [![GitHub](https://img.shields.io/badge/GitHub-crookedman-181717.svg)](https://github.com/crookedman/dsh-agency-agents)
</div>

> This README describes version 1.2.29.
> This is a community-maintained DeepSeek Harness (DSH) plugin, not an official DeepSeek AI product.

## What this is

This repository is a personal fork of **[MichengAI/dsh-agency-agents](https://github.com/MichengAI/dsh-agency-agents)**.

Upstream gives DeepSeek Harness 331 summonable domain experts plus expert teams. This fork builds on
upstream 1.2.27 and publishes under `@crookedman/dsh-agency-agents`; the roster, the agent data and
every other feature are unchanged.

## What this fork adds

- **Per-expert provider and model**: each expert card in **Settings → Experts** gains a *Model* action
  that pins a provider and model for that single expert. Unset means "inherit the parent agent", so
  upgrading changes no existing behavior. The custom-expert dialog exposes the same picker.
- **Teams degrade automatically**: native Agent Team accepts no per-member model, so a team containing
  any bound member runs on standard subagents to honor the setting; a provider without `agentOptions`
  fails loudly instead of silently running on the parent model.
- **Card badge**: the model badge is width-capped and ellipsized, so a long model name no longer pushes
  the expert name out of the card header; hover shows the full provider/model.
- **Own package identity**: package name, cordis mount names, remote service ids and HTTP routes live
  under the `@crookedman` scope so this fork can coexist with upstream by package name. The settings
  namespace stays `agency-agents`, so switching packages keeps existing configuration.

## Install

Requires DeepSeek Harness `>= 0.2.0-rc.1`.

```powershell
dsh plugin --profile desktop add @crookedman/dsh-agency-agents@1.2.28
```

Replace `desktop` with the profile you use (for example `web`). To upgrade, rerun with a new version.

From source:

```powershell
git clone https://github.com/crookedman/dsh-agency-agents.git
cd dsh-agency-agents
pnpm install
pnpm build
```

## Usage in short

1. **Enable experts**: **Settings → Experts** toggles which experts can be summoned; search, division
   filters and bulk actions are available.
2. **Summon**: name an expert in the conversation, or group several of them into an *expert team*.
3. **Pick a model**: the *Model* action on each card pins provider/model; choose "follow main agent"
   to leave it unset.

## Model bindings are not shipped in the package

Per-expert bindings live in the local profile settings (`agency-agents.expertModels`), not in the npm
package. A new machine starts unbound and needs either reconfiguration or a copy of that profile section.

## License and attribution

This fork stays under the **Apache License 2.0**. The agent persona snapshots come from
[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) (MIT) and
[jnMetaCode/agency-agents-zh](https://github.com/jnMetaCode/agency-agents-zh) (MIT); see `NOTICE` and the
license files under `assets/`. Upstream project:
[MichengAI/dsh-agency-agents](https://github.com/MichengAI/dsh-agency-agents).
