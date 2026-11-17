---
title: Git worktree
description: 在隔离的 Git worktree 中运行 Agent，并配置 setup 钩子、脚本和长时间运行的服务。
nav: Git worktree
---

# Git worktree {#git-worktrees}

Git worktree 是工作区的一种。

[工作区](/docs/workspaces)是任务发生的地方。当工作区由 Git worktree 支撑时，Paseo 会在单独的分支上创建一个单独的目录，让并行的 Agent 互不干扰。

本页介绍 Git 相关的细节：worktree 存放在哪里、分支如何选择，以及如何通过 `paseo.json` 配置 setup 钩子、脚本、终端和长时间运行的服务。

## 目录结构与工作流程 {#layout-and-workflow}

worktree 默认存放在 `$PASEO_HOME/worktrees/` 下，按源检出路径的哈希分组。你可以用 `config.json` 中的 `worktrees.root` 修改基础目录。每个 worktree 在其工作区创建时获得一个 slug 和一个分支。

```
~/.paseo/worktrees/
└── 1vnnm9k3/               # hash of source checkout path
    ├── tidy-fox/           # worktree slug
    └── bold-owl/
```

使用自定义根目录时，Paseo 会在该目录下保持相同的哈希结构：

```json
{
  "worktrees": {
    "root": "/mnt/fast/paseo-worktrees"
  }
}
```

插件可以通过 [`worktree.create.before`](/docs/plugins/hooks#worktreecreatebefore) 将 worktree 放到磁盘上的自选位置。[worktree-placement 示例](https://github.com/getpaseo/paseo/tree/main/plugin-examples/worktree-placement) 将其放在源检出目录旁边。Paseo 验证路径并拒绝已存在的目标，同时支持在该位置列出、归档和删除 worktree。恢复时使用记录的原路径，不运行创建钩子。

1. 创建一个使用 worktree 隔离的工作区，Paseo 会创建 worktree 并运行你的 setup 钩子
2. 在该工作区中启动一个或多个 Agent
3. 对照基础分支审查 diff
4. 合并或归档该工作区；使用该 worktree 的最后一个工作区被归档后，Paseo 会运行 teardown 并删除 worktree

定时任务的运行默认会在结束时归档其工作区。在定时任务的应用表单中关闭 **Archive on finish**，即可[保留运行工作区](/docs/schedules#keep-run-workspaces)及其 worktree，直到你手动归档。

## 创建由 worktree 支撑的工作区 {#create-a-worktree-backed-workspace}

下面的示例以当前目录作为源检出。传入 `--path ~/dev/my-app` 可以从另一个检出创建工作区。

从基础分支分出新分支：

```bash
paseo workspace create \
  --isolation worktree \
  --mode branch-off \
  --new-branch feature/auth \
  --worktree-slug feature-auth \
  --base origin/main
```

请使用 `origin/main` 而不是 `main`。Paseo 会在后台获取远程引用，因此远程跟踪分支是最新的，而你本地的 `main` 停留在你上次 pull 时的状态。不带前缀的 `main` 会优先解析到这个本地分支，worktree 就会从过时的历史开始。加上远程前缀可以明确指定已获取的引用。

检出一个已有分支：

```bash
paseo workspace create \
  --isolation worktree \
  --mode checkout-branch \
  --branch feature/existing \
  --worktree-slug existing-copy
```

或者在独立的工作区中打开一个 Pull Request：

```bash
paseo workspace create \
  --isolation worktree \
  --mode checkout-pr \
  --pr-number 2186
```

当 Paseo 无法从源检出推断代码托管平台时，添加 `--forge <name>`。

## 使用 .worktreeinclude 复制本地文件 {#copy-local-files-with-worktreeinclude}

使用 [`.worktreeinclude`](/docs/worktrees/worktreeinclude)，在 setup 运行前将 `.env` 等选定的 Git 忽略文件从源检出复制到新 worktree。

## paseo.json {#paseojson}

在仓库根目录放一个 `paseo.json`。Paseo 从你所选基础分支的已提交版本中读取它，因此其他分支中未提交的改动不会生效。

```json
{
  "worktree": {
    "setup": "npm ci",
    "teardown": "rm -rf .cache"
  },
  "scripts": {
    "test": { "command": "npm test" },
    "web": { "command": "npm run dev", "type": "service", "port": 3000 }
  }
}
```

## Setup 与 teardown {#setup-and-teardown}

插件可以通过 [`worktree.create.after`](/docs/plugins/hooks#worktreecreateafter) 在 setup、终端和第一个 Agent 运行之前写入文件。

`setup` 在 worktree 创建后运行一次。使用 setup 安装依赖并初始化项目。使用 [`.worktreeinclude`](#copy-local-files-with-worktreeinclude) 复制 `.env` 等被忽略的文件。`teardown` 在归档期间、目录被删除之前运行。

```json
{
  "worktree": {
    "setup": "npm ci\nnpm run db:migrate",
    "teardown": "npm run db:drop || true"
  }
}
```

两个字段都接受多行 shell 脚本或命令数组；无论哪种形式，命令都按顺序运行。

命令以 worktree 作为 `cwd` 运行。使用 `$PASEO_SOURCE_CHECKOUT_PATH` 访问原始检出中的文件（未跟踪的配置、本地缓存等）。

## 本地文件 {#local-files}

在目标主机打开 **项目设置 → 本地文件**，选择导入文件。可以从设备选择文件，也可以从另一台已连接主机的已注册项目复制。跨主机复制时，两台主机都必须在线；设备不需要本地 daemon 或项目副本。

导入前检查文件名、大小和目标状态。小型新文件默认选中；已有文件默认不选，选中才授权覆盖。预览不会显示文件内容。检查后源或目标发生变化时，需要重新选择并确认。

目标文件必须被 Git 忽略且未被跟踪；主机上的源文件也必须满足此条件。只支持普通文件，不支持目录、glob 或符号链接。每个文件最多 10 MiB，每次最多 25 MiB 和 100 个文件。设备导入仅读取你选择的文件，不扫描凭据。

启用 **包含在未来的 worktree 中**，把选定路径写入 `paseo.json`：

```json
{
  "worktree": {
    "localFiles": [".env.local", "local/dev.pem"]
  }
}
```

路径相对于选定项目根目录，也适用于仓库子目录中的项目。配置修改保持未提交；提交路径列表可与其他主机共享意图，但每台主机仍需要自己的文件内容。创建 worktree 时先复制文件，再运行 setup。已有 worktree 文件不会被覆盖，也不会在后台同步。

处理外部变更请求时，文件复制与其他工作区自动化一样，必须等待你明确运行 setup。缺少文件时，可以先导入，或明确选择不带这些文件继续；依赖文件的 setup 仍可能失败。导入成功但配置保存失败时，刷新后重新保存包含配置，无需重传文件。

文件内容传输要求加密中继、TLS 或 loopback 连接。文件以明文保存在目标主机，Agent 和脚本可以读取。POSIX 上新文件仅允许所有者访问；Windows 使用目标文件系统的访问控制。

## .worktreeinclude {#worktreeinclude}

项目根目录的 `.worktreeinclude` 在 `worktree.setup` 前准备源副本中的本地文件。路径相对于源副本：

```text
# 默认复制。
.env.local
.cache/**

# 显式选择模式。
symlink node_modules
copy .tool-state/**
```

每行为 `[copy|symlink] <path>`，默认模式是 `copy`。省略模式时沿用只复制被 Git 忽略的文件的规则；显式 `copy` 或 `symlink` 可以选择其他本地路径。不会替换目标分支跟踪的文件或包含被跟踪文件的目录。忽略空行和整行注释。`*` 匹配路径段内的字符，`**` 递归匹配；以 `/**` 结尾的目录作为一个递归条目处理。拒绝绝对路径、父目录路径和 `.git` 路径。

复制生成独立快照，再次执行时会替换已有副本。符号链接直接指向源文件或目录，两端的修改共享数据；Paseo 不用链接覆盖已有文件、目录或其他链接。源必须是普通文件或目录。顶层源链接只允许指向源副本内的真实目标；目录快照拒绝嵌套符号链接。

优先使用目标分支忽略的路径。链接目录的忽略规则不要带尾部斜杠，例如 `node_modules` 而不是 `node_modules/`，因为 Git 把链接本身视为文件。未忽略的内容会出现在 `git status` 中。

Windows 上本地目录使用 junction；文件和网络目录链接需要系统支持符号链接。无法创建显式链接时不会静默改为复制，请启用 Developer Mode 或改用 `copy`。归档只移除 worktree 中的链接，不删除源目标。源移动或删除后链接会失效，Paseo 不自动修复。

## 脚本与服务 {#scripts-and-services}

`scripts` 是可以在 worktree 中按需运行的具名命令。把其中一个标记为 _service_，Paseo 就会把它作为长时间运行的进程进行监管，为它分配端口，并通过 daemon 的反向代理把 HTTP 流量路由给它。

可以在应用中运行它们，也可以在自动化中用 [`paseo script`](/docs/cli#workspace-scripts) 和[工作区脚本 MCP 工具](/docs/mcp#workspace-scripts)管理它们。

### 普通脚本 {#plain-scripts}

```json
{
  "scripts": {
    "test": { "command": "npm test" },
    "lint": { "command": "npm run lint" },
    "generate": { "command": "npm run codegen" }
  }
}
```

### 服务 {#services}

```json
{
  "scripts": {
    "web": {
      "type": "service",
      "command": "npm run dev -- --port $PASEO_PORT",
      "port": 3000
    },
    "api": {
      "type": "service",
      "command": "npm run api -- --port $PASEO_PORT"
    }
  }
}
```

省略 `port` 可以让 Paseo 自动分配端口。让你的进程绑定 `$PASEO_PORT`，而不是写死端口；每个 worktree 获得不同的端口，因此同一服务的多个副本可以共存。

### 动态端口分配 {#dynamic-port-allocation}

默认情况下，Paseo 向操作系统请求一个可用的临时端口。可以在 `~/.paseo/config.json` 中全局配置端口范围，也可以在 `paseo.json` 中按项目配置：

```json
// ~/.paseo/config.json
{
  "worktrees": {
    "servicePorts": { "range": "3000-4000" }
  }
}
```

```json
// paseo.json
{
  "worktree": {
    "servicePorts": { "range": "3000-4000" }
  }
}
```

范围包含两端。项目的 `servicePorts` 块会替换全局块。服务上显式设置的 `port` 总是优先于这两种设置。

如果使用外部分配器，请改为配置 `portScript`：

```json
{
  "worktree": {
    "servicePorts": { "portScript": "/usr/bin/portmake" }
  }
}
```

Paseo 在工作区目录中运行该可执行文件，并传入四个参数：服务名、工作区 ID、分支名和 worktree 路径。由于脚本是直接执行的、不经过 shell，`portScript` 必须指向一个真正的可执行文件（例如编译后的二进制文件，或带有正确 shebang 行如 `#!/bin/bash` 的脚本），而不是内联的 shell 命令或管道。如果需要 shell 求值或管道，请把它们包装在一个小的可执行脚本中。没有分支时会传入空字符串。相同的值也可以通过 `PASEO_SCRIPTNAME`、`PASEO_WORKSPACE_ID`、`PASEO_BRANCH_NAME` 和 `PASEO_WORKTREE_PATH` 获取。它必须向 stdout 输出一个有效的 TCP 端口。同一块中 `portScript` 优先于 `range`。Paseo 信任外部分配器，因此返回的端口可能已经被占用，例如被 Paseo 将要连接的某个服务占用。

### 工作区启动命令 {#workspace-launches}

用 `launches` 声明已有的开发入口，例如同时启动 Docker Compose 和主机进程的脚本。普通脚本用于按需任务，service 用于只有一个 HTTP 端口的长驻服务，launch 用于带终端输出和多个发现端口的现有编排命令。三者都出现在同一个运行菜单中。

```json
{
  "worktree": {
    "servicePorts": { "range": "20000-50000", "blockSize": 100 }
  },
  "launches": {
    "dev": { "command": "./bin/dev" },
    "full": { "command": "./bin/dev --full" }
  }
}
```

命令在选定工作区目录中运行。service 获得单个 `$PASEO_PORT`，launch 获得共享的 `$PASEO_PORT_BASE` 到 `$PASEO_PORT_END` 端口块。项目 launch 优先于同名 worktree 脚本；Paseo 隐藏并停止旧脚本后再启动 launch。

每个工作区同时只运行一个 launch。切换会先停止当前命令，再启动选定命令。输出操作打开终端标签页，可查看 stdout、stderr 和最近退出码；运行中不代表所有子服务都已就绪。Paseo 探测租用端口块内的 TCP 监听器，把 HTTP 服务接入现有反向代理，原始 TCP 端口保持本地直连。

命令自行管理 Docker、依赖和重启策略。Unix 使用 Bash，Windows 使用 PowerShell，与交互 shell 无关。命令退出即视为 launch 结束；请让入口保持前台运行，单独执行 `docker compose up -d` 会立即退出。

```bash
paseo launch ls
paseo launch start dev
paseo launch stop dev
```

### 反向代理 {#reverse-proxy}

每个服务都可以通过 daemon 以一个确定的主机名访问：

```
http://<script>--<branch>--<project>.localhost:<daemon-port>

# on the default branch, the branch label is dropped:
http://<script>--<project>.localhost:<daemon-port>
```

在现代系统上，`*.localhost` 解析为 `127.0.0.1`，因此这些 URL 开箱即用。代理支持 WebSocket 升级。

### 服务之间的访问 {#service-to-service}

从同一工作区启动的服务可以看到彼此的端口和代理 URL。以上面的 `web` 和 `api` 为例，每个进程都会得到：

```
PASEO_PORT=3000                         # this service's port
PASEO_URL=http://web--my-app.localhost:6767  # this service's proxy URL
PASEO_SERVICE_API_PORT=51732
PASEO_SERVICE_API_URL=http://api--my-app.localhost:6767
PASEO_SERVICE_WEB_PORT=3000
PASEO_SERVICE_WEB_URL=http://web--my-app.localhost:6767
```

脚本名会转为大写，非字母数字字符变为 `_`。让你的前端指向 `$PASEO_SERVICE_API_URL`，而不是写死端口。

## 终端 {#terminals}

在 worktree 创建时自动打开终端。适合查看日志，或预先准备好一个 REPL。

```json
{
  "worktree": {
    "terminals": [
      { "name": "logs", "command": "tail -f dev.log" },
      { "name": "shell", "command": "bash" }
    ]
  }
}
```

## 环境变量 {#environment-variables}

Setup、teardown、脚本和服务都能看到：

- `$PASEO_SOURCE_CHECKOUT_PATH`，原始仓库根目录
- `$PASEO_WORKTREE_PATH`，worktree 目录
- `$PASEO_BRANCH_NAME`，worktree 的分支
- `$PASEO_WORKTREE_PORT`，旧版的每个 worktree 一个的端口（在服务中优先使用 `$PASEO_PORT`）

服务还会额外得到：

- `$PASEO_PORT`，该服务分配到的端口
- `$PASEO_URL`，该服务的代理 URL
- `$PASEO_SERVICE_<NAME>_PORT` / `_URL`，其他服务的端口和 URL
- `$HOST`，仅本地访问的 daemon 为 `127.0.0.1`，daemon 绑定所有网络接口时为 `0.0.0.0`

## 管理工作区 {#manage-the-workspace}

```bash
paseo workspace ls
paseo run --workspace <workspace-id> "implement auth"
paseo workspace rename <workspace-id> "Auth rework"
paseo workspace archive <workspace-id>
```

对于常见情况，`paseo run --new-workspace worktree --worktree-mode branch-off --new-branch feature/auth --base origin/main "implement auth"` 会同时创建工作区和它的第一个 Agent。
