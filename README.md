# Tako CLI

AI coding tools launcher — unified interface for managing and running AI development tools (Claude Code, Codex, Gemini, OpenCode).

## Quick Install

```bash
curl -fsSL https://cdn.jsdelivr.net/npm/tako-cli/install.sh | bash
```

Or via npm:

```bash
npm install -g tako-cli
```

## Setup

```bash
tako                          # First run: interactive setup
tako install claude-code      # Install Claude Code
tako install codex            # Install Codex
```

## Usage

```bash
tako                          # Interactive TUI launcher
tako --claude                 # Quick-launch Claude Code
tako --codex                  # Quick-launch Codex
tako --gemini                 # Quick-launch Gemini CLI
tako agent --model <model>    # Start agent mode with specific model
```

## Skills

Tako bundles reusable skills for AI agents that enhance Claude Code's capabilities.

### Available Skills

| Skill | Description |
|-------|-------------|
| model-benchmark | Model capability scores and recommendations from E2E testing across 16 models |
| tako-agent | Long-running agent session management — start/resume/monitor/close Claude/Codex agents |

### Installing Skills

```bash
tako skill list               # Show available skills
tako skill install --all      # Install all skills to .claude/skills/
tako skill install tako-agent # Install specific skill
```

Skills are installed to `.claude/skills/<name>/SKILL.md` and automatically picked up by Claude Code.

Once installed, Claude Code can use the skill to manage agent sessions for you — just say things like "dispatch an agent to research X" or "start a codex session to refactor Y".

## Agent Session Management

Tako includes a built-in agent session manager accessible from both CLI and TUI:

```bash
tako agent start claude --model claude-sonnet-4-6   # Create a session
tako agent list                                      # List all sessions
tako agent send <sid> "your prompt"                  # Send a message
tako agent attach <sid>                              # Live-tail the log
tako agent close <sid>                               # Close session
```

In the TUI (`tako`), press `a` to open the Agent management page where you can create, monitor, and interact with sessions visually.

## Features

- Unified launcher for multiple AI coding tools
- Agent session management (multi-session, persistent, approval workflow)
- Model switching via environment variable (doesn't pollute global settings)
- Provider management (Tako API, local models)
- Bundled skills for AI agent enhancement
- China-optimized: automatic mirror detection for fast installs

## Development

```bash
bun install
bun run build
bun test
```

## License

MIT
