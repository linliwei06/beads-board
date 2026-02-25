#!/usr/bin/env node
const blessed = require('blessed')
const { fetchIssues } = require('./data')

// ── Priority helpers ──────────────────────────────────────────────────────────
const PRIORITY_COLOR = ['red', 'yellow', 'white', 'gray', 'gray']
const PRIORITY_LABEL = ['P0', 'P1', 'P2', 'P3', 'P4']

function priorityTag(p) {
  const color = PRIORITY_COLOR[p] ?? 'white'
  const label = PRIORITY_LABEL[p] ?? `P${p}`
  return `{${color}-fg}[${label}]{/}`
}

// ── Tree builder ──────────────────────────────────────────────────────────────
// Returns [{issue, prefix}] ordered by dependency chain within the row.
// prefix is the full tree-drawing string for each row, e.g. '│  ├─ '.
// Features always appear as roots; issues with in-row blockers are children.
function buildTree(issues) {
  const idSet     = new Set(issues.map(i => i.id))
  const children  = new Map()   // parentId → [child issues]
  const hasParent = new Set()   // issue ids that have an in-row parent

  for (const issue of issues) {
    for (const blockerId of issue.blockedBy) {
      if (!idSet.has(blockerId)) continue
      if (!children.has(blockerId)) children.set(blockerId, [])
      children.get(blockerId).push(issue)
      hasParent.add(issue.id)
    }
  }

  // Features always appear as roots regardless of deps
  const roots = issues.filter(i => i.type === 'feature' || !hasParent.has(i.id))

  const result  = []
  const visited = new Set()

  // contPrefix: the vertical-bar continuation string inherited from ancestors.
  // null means root node — typeIcon (3 chars) baked into prefix instead of connector.
  // Each level adds exactly 3 chars so connectors align under the parent's [priority].
  function visit(issue, contPrefix, isLast) {
    if (visited.has(issue.id)) return
    visited.add(issue.id)
    const prefix = contPrefix === null
      ? (issue.type === 'feature' ? '◆  ' : '   ')  // root: 3-char typeIcon
      : contPrefix + (isLast ? '└─ ' : '├─ ')        // child: continuation + 3-char connector
    result.push({ issue, prefix })
    const kids = children.get(issue.id) ?? []
    const nextCont = contPrefix === null ? '   ' : contPrefix + (isLast ? '   ' : '│  ')
    kids.forEach((child, idx) => visit(child, nextCont, idx === kids.length - 1))
  }

  for (const root of roots) visit(root, null, true)
  // Catch any cycles or orphans
  for (const issue of issues) {
    if (!visited.has(issue.id)) result.push({ issue, prefix: '' })
  }

  return result
}

// ── Item formatter ────────────────────────────────────────────────────────────
// Format: {tree prefix}[priority][type][''/[BLK]] {id} {title}
const FIXED_PREFIX = 4 + 8 + 5 + 12 + 1  // pri + type + blk(max) + id + sp = ~30

function formatItem(node, maxTitleLen) {
  const { issue, prefix } = node

  const pri       = priorityTag(issue.priority)
  const type      = `{cyan-fg}[${issue.type}]{/}`
  const blk       = issue.blocked ? '{red-fg}[BLK]{/}' : ''
  const id        = `{gray-fg}${issue.id}{/}`
  const available = Math.max(8, maxTitleLen - prefix.length)
  const title     = issue.title.length > available
    ? issue.title.slice(0, available - 3) + '...'
    : issue.title

  return `${prefix}${pri}${type}${blk} ${id} ${title}`
}

// ── Detail pane formatter ─────────────────────────────────────────────────────
function formatDetail(issue) {
  if (!issue) return '{gray-fg}  Navigate to an issue to see its details.{/}'

  const priColor   = PRIORITY_COLOR[issue.priority] ?? 'white'
  const blockedStr = issue.blocked ? '{red-fg}blocked{/}' : '{green-fg}ready{/}'
  const meta = [
    `{bold}${issue.id}{/}`,
    `{${priColor}-fg}P${issue.priority}{/}`,
    `{cyan-fg}${issue.type}{/}`,
    `owner: ${issue.owner || '—'}`,
    blockedStr,
  ].join('  ')

  const desc = issue.description || '{gray-fg}(no description){/}'
  return `  ${meta}\n  {bold}${issue.title}{/}\n  {gray-fg}─────────────────────{/}\n  ${desc}`
}

// ── Layout helpers ────────────────────────────────────────────────────────────
const LEFT_PCT  = 60   // left column width as % of screen

function rowHeight(i) {
  const total = screen.height - 1  // subtract header row
  const h     = Math.floor(total / 3)
  return i < 2 ? h : total - 2 * h  // last row gets the remainder
}

function rowTop(i) {
  let top = 1  // below header
  for (let j = 0; j < i; j++) top += rowHeight(j)
  return top
}

function maxTitleLen() {
  return Math.max(10, Math.floor(screen.width * LEFT_PCT / 100) - 4 - FIXED_PREFIX)
}

function applyLayout() {
  rows.forEach((row, i) => {
    row.top    = rowTop(i)
    row.height = rowHeight(i)
  })
  detail.height = screen.height - 1
}

// ── Screen ────────────────────────────────────────────────────────────────────
const screen = blessed.screen({ smartCSR: true, title: 'Beads Board' })

const header = blessed.box({
  parent: screen,
  top: 0, left: 0, right: 0,
  height: 1,
  tags: true,
  style: { bg: 'blue', fg: 'white', bold: true },
})

// ── Left column: 3 stacked rows ───────────────────────────────────────────────
const ROW_DEFS = [
  { label: 'Open / Blocked', key: 'open'       },
  { label: 'In Progress',    key: 'inProgress'  },
  { label: 'Done (last 10)', key: 'closed'      },
]

const rows = ROW_DEFS.map((def, i) =>
  blessed.list({
    parent: screen,
    label:  ` ${def.label} `,
    top:    rowTop(i),
    left:   0,
    width:  `${LEFT_PCT}%`,
    height: rowHeight(i),
    border: 'line',
    keys:   true,
    vi:     true,
    tags:   true,
    mouse:  true,
    scrollable:   true,
    alwaysScroll: true,
    style: {
      border:   { fg: 'blue' },
      label:    { fg: 'white', bold: true },
      selected: { bg: 'blue', fg: 'white', bold: true },
      item:     { fg: 'white' },
    },
  })
)

// ── Right column: detail pane ─────────────────────────────────────────────────
const detail = blessed.box({
  parent: screen,
  top:    1,
  left:   `${LEFT_PCT}%`,
  right:  0,
  height: screen.height - 1,
  border: 'line',
  tags:   true,
  keys:   true,
  scrollable:   true,
  alwaysScroll: true,
  label: ' Detail ',
  style: {
    border: { fg: 'green' },
    label:  { fg: 'white', bold: true },
  },
})

// ── Issue data store ──────────────────────────────────────────────────────────
let treeData   = { open: [], inProgress: [], closed: [] }
let focusedRow = 0
let focusedCol = 0  // 0 = left, 1 = right

function getSelectedIssue() {
  const keys = ['open', 'inProgress', 'closed']
  const node = treeData[keys[focusedRow]][rows[focusedRow].selected ?? 0]
  return node?.issue ?? null
}

function updateDetail() {
  detail.setContent(formatDetail(getSelectedIssue()))
  screen.render()
}

function focusRow(idx) {
  focusedCol = 0
  focusedRow = idx
  detail.style.border.fg = 'green'
  detail.style.label.fg  = 'white'
  rows.forEach((row, i) => {
    row.style.border.fg = i === idx ? 'yellow' : 'blue'
    row.style.label.fg  = i === idx ? 'yellow' : 'white'
  })
  rows[idx].focus()
  process.nextTick(updateDetail)
}

function focusDetail() {
  focusedCol = 1
  rows.forEach(row => {
    row.style.border.fg = 'blue'
    row.style.label.fg  = 'white'
  })
  detail.style.border.fg = 'yellow'
  detail.style.label.fg  = 'yellow'
  detail.focus()
  screen.render()
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  applyLayout()

  const data = fetchIssues()
  treeData = {
    open:       buildTree(data.open),
    inProgress: buildTree(data.inProgress),
    closed:     buildTree(data.closed),
  }

  const now = new Date().toLocaleTimeString()
  header.setContent(
    `  {bold}Beads Board{/bold}  —  ${now}  —  {gray-fg}q:quit  r:refresh  ←→:switch col  tab:switch row  ↑↓:navigate  {yellow-fg}◆{/}{gray-fg}=feature{/}`
  )

  const titleLen = maxTitleLen()
  const trees = [treeData.open, treeData.inProgress, treeData.closed]
  rows.forEach((row, i) => {
    const prevSel = row.selected ?? 0
    const items = trees[i].length > 0
      ? trees[i].map(node => formatItem(node, titleLen))
      : ['{gray-fg}  (empty){/}']
    row.setItems(items)
    row.select(Math.min(prevSel, Math.max(0, items.length - 1)))
  })

  updateDetail()
}

// ── Keys ──────────────────────────────────────────────────────────────────────
rows.forEach(row => {
  row.key(['up', 'down'], () => process.nextTick(updateDetail))
})

screen.key('left',       () => focusRow(focusedRow))
screen.key('right',      () => focusDetail())
screen.key('tab',        () => focusRow((focusedRow + 1) % 3))
screen.key('S-tab',      () => focusRow((focusedRow + 2) % 3))
screen.key(['q', 'C-c'], () => process.exit(0))
screen.key('r', render)
screen.on('resize', render)

// ── Start ─────────────────────────────────────────────────────────────────────
focusRow(0)
render()
setInterval(render, 5000)
