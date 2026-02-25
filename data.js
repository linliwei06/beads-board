const { execFileSync } = require('node:child_process')

/**
 * Maps a raw bd JSON issue to a display object.
 */
function mapIssue(raw) {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    priority: raw.priority,       // 0–4
    type: raw.issue_type,
    owner: raw.owner ?? '',
    blocked: raw.dependency_count > 0,
    description: raw.description ?? '',
    // IDs of issues that must complete before this one (its blockers)
    blockedBy: (raw.dependencies ?? []).map(d => d.depends_on_id),
  }
}

/**
 * Groups issues into open (open+blocked), inProgress, closed columns.
 */
function groupByStatus(issues) {
  return {
    open: issues.filter(i => i.status === 'open' || i.status === 'blocked'),
    inProgress: issues.filter(i => i.status === 'in_progress'),
    closed: issues.filter(i => i.status === 'closed'),
  }
}

/**
 * Fetches issues for one status via bd CLI.
 * Uses execFileSync with a fixed args array — no shell, no injection risk.
 */
function runBd(status) {
  try {
    const out = execFileSync('bd', ['list', '--json', `--status=${status}`], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return JSON.parse(out).map(mapIssue)
  } catch {
    return []
  }
}

/**
 * Fetches all issues from bd CLI and returns grouped display objects.
 * Closed issues capped at 10 (most recently updated first).
 */
function fetchIssues() {
  return {
    open: [...runBd('open'), ...runBd('blocked')],
    inProgress: runBd('in_progress'),
    closed: runBd('closed').slice(0, 10),
  }
}

module.exports = { mapIssue, groupByStatus, fetchIssues }
