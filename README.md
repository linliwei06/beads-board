# beads-board

A terminal Kanban board for the [beads (`bd`)](https://github.com/PG-Forest-Park/beads) issue tracker.

```
┌─ Open / Blocked ────────────────────┐ ┌─ Detail ──────────────────────────┐
│ ◆  [P1][feature] FEAT-001 Auth flow │ │  FEAT-001  P1  feature  ready     │
│    ├─ [P2][task] TASK-002 JWT setup │ │  Auth flow                        │
│    └─ [P2][task] TASK-003 Refresh   │ │  ─────────────────────            │
├─ In Progress ───────────────────────┤ │  Implement Cognito login with     │
│ [P1][task] TASK-004 DB schema       │ │  token refresh and logout.        │
├─ Done (last 10) ────────────────────┤ │                                   │
│ [P2][task] TASK-001 Project setup   │ │                                   │
└─────────────────────────────────────┘ └───────────────────────────────────┘
```

## Requirements

- Node.js 18+
- [`bd`](https://github.com/PG-Forest-Park/beads) CLI installed and on your `$PATH`
- A directory initialized with `bd init` (contains a `.beads/` folder)

## Install

```bash
npm install -g beads-board
beads-board
```

## Usage

```bash
# Run from the repo root (auto-detects .beads/ in current directory)
beads-board

# Or point to any repo from anywhere
beads-board --path /path/to/your/repo
beads-board -p ~/projects/myproject
```

The board auto-refreshes every 5 seconds.

## Keybindings

| Key | Action |
|-----|--------|
| `←` / `→` | Switch focus between list column and detail pane |
| `tab` | Move to next row (Open → In Progress → Done → Open) |
| `S-tab` | Move to previous row |
| `↑` / `↓` | Navigate issues within focused row; scroll detail pane |
| `r` | Force refresh |
| `q` / `Ctrl-C` | Quit |

## Layout

- **Left column (60%)** — three stacked rows:
  - `Open / Blocked` — open and blocked issues
  - `In Progress` — active work
  - `Done (last 10)` — recently closed
- **Right column (40%)** — detail pane for the selected issue, always visible

Issues are displayed as a dependency tree. Features (`◆`) are always roots; tasks blocked by other in-column issues are shown as children with tree connectors.

## License

MIT
