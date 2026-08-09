import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDecisionStore } from '@/application/useDecisionStore'
import { decisionMatchesQuery } from '@/domain/attention'
import { StatusBadge } from '@/components/StatusBadge'
import type { DecisionStatus } from '@/domain/types'

const STATUSES: Array<DecisionStatus | ''> = [
  '',
  'OPEN',
  'DECIDED',
  'REVIEW_DUE',
  'REVIEWED',
  'ARCHIVED',
]

/** Initial window size for large libraries — avoid mounting 1000+ DOM rows. */
const LIST_WINDOW = 100
const LIST_WINDOW_STEP = 100

type SortKey = 'updated' | 'title' | 'status' | 'committed'

export function DecisionsPage() {
  const { decisions, loading } = useDecisionStore()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<DecisionStatus | ''>('')
  const [tag, setTag] = useState('')
  const [reviewState, setReviewState] = useState<
    'any' | 'reviewed' | 'unreviewed' | 'due'
  >('any')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [attention, setAttention] = useState<'any' | 'predictions' | 'assumptions'>(
    'any',
  )
  const [sort, setSort] = useState<SortKey>('updated')
  const [visibleCount, setVisibleCount] = useState(LIST_WINDOW)

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const d of decisions) for (const t of d.context.tags) set.add(t)
    return [...set].sort()
  }, [decisions])

  const filtered = useMemo(() => {
    const list = decisions.filter((d) =>
      decisionMatchesQuery(d, {
        text,
        status: status || undefined,
        tag: tag || undefined,
        reviewState,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        attention: attention === 'any' ? undefined : attention,
      }),
    )
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'status') return a.status.localeCompare(b.status)
      if (sort === 'committed') {
        const ac = a.commitSnapshot?.committedAt ?? ''
        const bc = b.commitSnapshot?.committedAt ?? ''
        return bc.localeCompare(ac)
      }
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [
    decisions,
    text,
    status,
    tag,
    reviewState,
    fromDate,
    toDate,
    attention,
    sort,
  ])

  useEffect(() => {
    setVisibleCount(LIST_WINDOW)
  }, [
    text,
    status,
    tag,
    reviewState,
    fromDate,
    toDate,
    attention,
    sort,
    decisions.length,
  ])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <div className="page">
      <header className="page-header row-between wrap">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Decisions</h1>
        </div>
        <Link className="btn primary" to="/decisions/new">
          New decision
        </Link>
      </header>

      <form
        className="panel filter-bar filter-bar-wide"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Find decisions"
      >
        <label>
          Search
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Title, context, tags, assumptions…"
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DecisionStatus | '')}
          >
            <option value="">Any</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tag
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Any</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review
          <select
            value={reviewState}
            onChange={(e) =>
              setReviewState(e.target.value as typeof reviewState)
            }
          >
            <option value="any">Any</option>
            <option value="reviewed">Reviewed</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="due">Due</option>
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <label>
          Attention
          <select
            value={attention}
            onChange={(e) =>
              setAttention(e.target.value as typeof attention)
            }
          >
            <option value="any">Any</option>
            <option value="predictions">Predictions due/overdue</option>
            <option value="assumptions">High-conf failures</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="updated">Updated</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
            <option value="committed">Committed</option>
          </select>
        </label>
      </form>

      {loading ? <p>Loading…</p> : null}
      <p className="muted" aria-live="polite">
        Showing {visible.length} of {filtered.length} match
        {filtered.length !== decisions.length
          ? ` (${decisions.length} in library)`
          : ''}
      </p>

      <ul className="decision-table">
        {visible.map((d) => (
          <li key={d.id}>
            <Link to={`/decisions/${d.id}`} className="decision-table-row">
              <div>
                <strong>{d.title}</strong>
                <p className="muted">
                  {d.context.tags.join(' · ') || 'untagged'}
                </p>
              </div>
              <StatusBadge status={d.status} />
              <span className="muted">{d.updatedAt.slice(0, 10)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() =>
              setVisibleCount((n) =>
                Math.min(n + LIST_WINDOW_STEP, filtered.length),
              )
            }
          >
            Show more ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      ) : null}
      {!filtered.length ? (
        <div className="empty-state panel">
          <p className="muted">No decisions match these filters.</p>
          <Link className="btn" to="/decisions/new">
            Create a decision
          </Link>
        </div>
      ) : null}
    </div>
  )
}
