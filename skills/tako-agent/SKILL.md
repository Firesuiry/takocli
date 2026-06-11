---
name: tako-agent
description: "通过 tako CLI 启动、续接、监控、关闭 Claude Code 与 Codex 的长时 agent session。触发词: agent session, 派一个 agent, 开一个子会话, 管理 agent, 看 agent 跑到哪了, 取消那个 agent, 并行跑 agent"
allowed-tools: Bash(tako:*)
---

# tako-agent — 长时 agent session 管理

```bash
tako agent <subcmd> [...]
```

## 快速速查

```bash
tako agent start <claude|codex> [--model X] [--name N] [--cwd .] [--approval yolo|external]
tako agent list                         # 列出所有 session
tako agent send <sid> "prompt..."       # 阻塞发送一轮
tako agent show  <sid> [--lines N]      # 查看 meta + 最近日志
tako agent attach <sid>                 # 实时 tail 日志流
tako agent cancel <sid>                 # 中止当前 turn
tako agent close  <sid> [--purge]       # 关闭 session
tako agent purge                        # 清理 closed/dead

# 外置审批（codex）
tako agent pending <sid>                # 列待审批
tako agent approve <sid> <id> <allow|deny> [--reason "..."] [--rule "<regex>"]
tako agent wait <sid> [--json]          # 阻塞到下一决策点（LLM 友好）

# 策略
tako agent policy <sid> show
tako agent policy <sid> allow-exec <regex>
tako agent policy <sid> deny-exec <regex>

tako agent default <claude|codex> <providerId>
```

## 典型工作流

### 派 agent 去做任务

```bash
SID=$(tako agent start codex --model gpt-5.5 --name research | grep sid: | awk '{print $2}')
tako agent send "$SID" "扫描 src/ 所有 TODO，按文件分组列出"
tako agent show "$SID"
```

### 多 turn 续接

```bash
SID=$(tako agent start claude --model claude-opus-4-7 --name review | grep sid: | awk '{print $2}')
tako agent send "$SID" "review src/agent/manager.ts 的并发安全"
tako agent send "$SID" "给一个最小补丁"   # 历史自动保留
```

### 并发多 session

```bash
A=$(tako agent start codex  --name alpha | grep sid: | awk '{print $2}')
B=$(tako agent start claude --name beta  | grep sid: | awk '{print $2}')
tako agent send "$A" "..." &
tako agent send "$B" "..." &
wait
tako agent list
```

### 外部 LLM 当门卫（wait 模式）

```bash
SID=$(tako agent start codex --approval external --model gpt-5.5)
tako agent send --bg "$SID" "把 README 翻成中文"
# 循环 wait → approve → wait
EVENT=$(tako agent wait --json "$SID")
# exit 0=approval_required, 2=turn_completed, 3=closed, 1=error
```

## 注意事项

- `<sid>` 支持前缀匹配
- send 是阻塞的，用 `&` 或另开 shell 配合 attach
- claude 用 `--resume` 持久化历史，codex 用 `thread/resume`
- `--approval yolo`（默认）不审批；`--approval external` 启用外置审批
- 默认策略已覆盖常见安全场景（auto_allow 只读命令，auto_deny 危险操作）
