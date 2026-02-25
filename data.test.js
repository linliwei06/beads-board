const { strict: assert } = require('node:assert')
const { test } = require('node:test')
const { mapIssue, groupByStatus } = require('./data')

test('mapIssue extracts required display fields', () => {
  const raw = {
    id: 'Appealo-abc',
    title: 'Do something important',
    status: 'open',
    priority: 1,
    issue_type: 'task',
    owner: 'user@example.com',
    dependency_count: 2,
    dependent_count: 0,
  }
  const issue = mapIssue(raw)
  assert.equal(issue.id, 'Appealo-abc')
  assert.equal(issue.title, 'Do something important')
  assert.equal(issue.priority, 1)
  assert.equal(issue.type, 'task')
  assert.equal(issue.blocked, true)   // dependency_count > 0 means has blockers
  assert.equal(issue.owner, 'user@example.com')
})

test('mapIssue blocked=false when no dependencies', () => {
  const raw = {
    id: 'Appealo-xyz', title: 'Free task', status: 'open',
    priority: 2, issue_type: 'feature', owner: 'a@b.com',
    dependency_count: 0, dependent_count: 1,
  }
  const issue = mapIssue(raw)
  assert.equal(issue.blocked, false)
})

test('groupByStatus splits into open, inProgress, closed', () => {
  const issues = [
    { id: 'A', status: 'open' },
    { id: 'B', status: 'blocked' },
    { id: 'C', status: 'in_progress' },
    { id: 'D', status: 'closed' },
    { id: 'E', status: 'closed' },
  ]
  const grouped = groupByStatus(issues)
  assert.equal(grouped.open.length, 2)       // open + blocked both in "open" column
  assert.equal(grouped.inProgress.length, 1)
  assert.equal(grouped.closed.length, 2)
})
