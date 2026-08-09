import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useDecision, useDecisionStore } from '@/application/useDecisionStore'
import { StatusBadge } from '@/components/StatusBadge'
import { BranchDiagram } from '@/visualization/BranchDiagram'
import { buildDecisionDossierMarkdown } from '@/domain/dossier'
import { buildEnrichedHistorySequence } from '@/domain/historyExplorer'
import {
  predictionStateLabel,
  predictionTemporalState,
} from '@/domain/predictions'
import { buildReviewSummary } from '@/domain/memoryDrift'
import {
  listHistoricalAssumptionTargets,
  listHistoricalPredictionTargets,
} from '@/domain/historicalIdentity'
import {
  addDecisionRelation,
  addEvidenceRef,
  removeDecisionRelation,
  removeEvidenceRef,
  assignAssumptionFamily,
} from '@/domain/decision'
import { newAssumptionFamilyId } from '@/domain/assumptionFamilies'
import {
  RELATION_KIND_LABELS,
  resolveInboundRelations,
  resolveOutboundRelations,
} from '@/domain/lineage'
import {
  activeEvidence,
  describeEvidenceProvenance,
} from '@/domain/v2History'
import { DomainError } from '@/domain/errors'
import type { Decision, RelationKind } from '@/domain/types'

type SectionId =
  | 'then'
  | 'later'
  | 'reality'
  | 'review'
  | 'predictions'
  | 'assumptions'
  | 'lineage'
  | 'evidence'
  | 'branches'
  | 'history'

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'then', label: 'Known Then' },
  { id: 'later', label: 'What Changed Later' },
  { id: 'reality', label: 'Reality' },
  { id: 'review', label: 'Review' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'lineage', label: 'Lineage' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'branches', label: 'Alternative Branches' },
  { id: 'history', label: 'History' },
]

export function DecisionDetailPage() {
  const { id } = useParams()
  const decision = useDecision(id)
  const { decisions, save } = useDecisionStore()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!decision) {
    return (
      <div className="page">
        <p>Decision not found.</p>
        <Link to="/decisions">Back</Link>
      </div>
    )
  }

  const current = decision
  const snap = current.commitSnapshot
  const outbound = resolveOutboundRelations(current, decisions)
  const inbound = resolveInboundRelations(current.id, decisions)
  const evidenceActive = activeEvidence(current)
  const evidenceRemoved = current.evidence.filter((e) => e.removedAt)
  const relationsRemoved = current.relations.filter((r) => r.removedAt)

  function downloadDossier() {
    const md = buildDecisionDossierMarkdown(current)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${current.title.replace(/\s+/g, '-').toLowerCase()}-dossier.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printDossier() {
    const md = buildDecisionDossierMarkdown(current)
    const w = window.open('', '_blank', 'noopener,noreferrer')
    if (!w) return
    w.document.write(
      `<!doctype html><html><head><title>${current.title} — Dossier</title>
      <style>
        body{font-family:Georgia,serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#1a1a1a}
        pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:0.9rem}
        @media print{body{margin:0}}
      </style></head><body>
      <pre>${md.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
      <script>window.onload=()=>window.print()</script>
      </body></html>`,
    )
    w.document.close()
  }

  async function persist(next: Decision) {
    try {
      await save(next)
      setMsg('Saved.')
      setErr(null)
    } catch (e) {
      setErr(e instanceof DomainError ? e.message : 'Save failed')
    }
  }

  return (
    <div className="page workspace">
      <header className="page-header">
        <p className="eyebrow">Decision workspace</p>
        <div className="row-between wrap">
          <h1>{current.title}</h1>
          <StatusBadge status={current.status} />
        </div>
        <p className="lede">{current.description || 'No description.'}</p>
        <p className="muted">Protocol: {current.protocolId}</p>
        <div className="hero-actions">
          {!snap ? (
            <Link className="btn primary" to={`/decisions/${current.id}/commit`}>
              Commit decision
            </Link>
          ) : (
            <>
              <Link
                className="btn primary"
                to={`/decisions/${current.id}/review`}
              >
                {current.review ? 'Review again' : 'Review'}
              </Link>
              <Link className="btn" to={`/decisions/${current.id}/revise`}>
                Record later change
              </Link>
              <Link className="btn" to={`/decisions/${current.id}/history`}>
                History explorer
              </Link>
            </>
          )}
          <button type="button" className="btn" onClick={downloadDossier}>
            Download dossier
          </button>
          <button type="button" className="btn" onClick={printDossier}>
            Print dossier
          </button>
        </div>
        {msg ? (
          <p className="status-ok" role="status">
            {msg}
          </p>
        ) : null}
        {err ? (
          <p className="error" role="alert">
            {err}
          </p>
        ) : null}
      </header>

      <nav className="workspace-nav" aria-label="Decision sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <section id="then" className="panel then-panel">
        <h2>Known Then</h2>
        <p className="section-hint">
          What was recorded at commit — frozen history, not reconstructed later.
        </p>
        {snap ? (
          <>
            <p className="muted">
              Snapshot {snap.committedAt.slice(0, 19)} ·{' '}
              <code>{snap.snapshotId}</code>
            </p>
            <p>{snap.context.situation || 'No situation recorded.'}</p>
            <dl className="kv">
              <div>
                <dt>Constraints</dt>
                <dd>{snap.context.constraints || '—'}</dd>
              </div>
              <div>
                <dt>Stakes</dt>
                <dd>{snap.context.stakes || '—'}</dd>
              </div>
              <div>
                <dt>Decision day</dt>
                <dd>{snap.decisionDate}</dd>
              </div>
              <div>
                <dt>Chosen option</dt>
                <dd>
                  {snap.options.find((o) => o.id === snap.selectedOptionId)
                    ?.title ?? snap.selectedOptionId}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="muted">Not committed yet — no immutable Known Then.</p>
        )}
      </section>

      <section id="later" className="panel">
        <h2>What Changed Later</h2>
        {current.revisions.length ? (
          <ul className="entity-list">
            {current.revisions.map((r) => (
              <li key={r.revisionId}>
                <strong>Revision {r.revisionNumber}</strong>
                <span className="muted">{r.createdAt.slice(0, 19)}</span>
                <p>{r.note}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No post-commit revisions.</p>
        )}
      </section>

      <section id="reality" className="panel">
        <h2>Reality</h2>
        {current.review ? (
          <p>
            {current.review.whatHappened ||
              'Review recorded; narrative empty.'}
          </p>
        ) : (
          <p className="muted">Reality is recorded at review time.</p>
        )}
      </section>

      <section id="review" className="panel">
        <h2>Review</h2>
        {current.review ? (
          <>
            <ReviewSummaryBlock decision={current} />
            {current.priorReviews.length ? (
              <details>
                <summary>
                  Prior reviews ({current.priorReviews.length})
                </summary>
                <ol>
                  {current.priorReviews.map((r, i) => (
                    <li key={`${r.reviewedAt}-${i}`}>
                      {r.reviewedAt.slice(0, 10)} — outcome {r.outcomeRating}/5,
                      decision quality {r.decisionQualityRating}/5
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </>
        ) : (
          <p className="muted">No review yet.</p>
        )}
      </section>

      <section id="predictions" className="panel">
        <h2>Predictions</h2>
        <PredictionList decision={current} />
      </section>

      <section id="assumptions" className="panel">
        <h2>Assumptions</h2>
        <AssumptionList
          decision={current}
          onAssignFamily={(assumptionId, label) => {
            const family =
              label.trim().length === 0
                ? null
                : {
                    familyId:
                      current.assumptions.find((a) => a.id === assumptionId)
                        ?.familyId ?? newAssumptionFamilyId(),
                    familyLabel: label.trim(),
                  }
            void persist(assignAssumptionFamily(current, assumptionId, family))
          }}
        />
      </section>

      <section id="lineage" className="panel stack">
        <h2>Lineage</h2>
        <p className="section-hint">
          Lightweight links recorded by you. Timestamps mark when BranchBack
          recorded the link — not when the target decision happened. Removal
          keeps a tombstone so history remains reconstructable.
        </p>
        <h3>Outbound</h3>
        <ul className="entity-list">
          {outbound.map(({ relation, target }) => (
            <li key={relation.id}>
              <strong>{RELATION_KIND_LABELS[relation.kind]}</strong>
              {target ? (
                <Link to={`/decisions/${target.id}`}>{target.title}</Link>
              ) : (
                <span className="muted">
                  missing target {relation.targetDecisionId}
                </span>
              )}
              <span className="muted">
                recorded {relation.createdAt.slice(0, 19)}
              </span>
              {relation.note ? <p>{relation.note}</p> : null}
              <button
                type="button"
                className="btn"
                onClick={() =>
                  void persist(removeDecisionRelation(current, relation.id))
                }
              >
                Remove link
              </button>
            </li>
          ))}
          {!outbound.length ? (
            <li className="muted">No outbound links.</li>
          ) : null}
        </ul>
        {relationsRemoved.length ? (
          <details>
            <summary>
              Removed lineage history ({relationsRemoved.length})
            </summary>
            <ul className="entity-list">
              {relationsRemoved.map((relation) => (
                <li key={relation.id} className="muted">
                  {RELATION_KIND_LABELS[relation.kind]} →{' '}
                  {relation.targetDecisionId} · recorded{' '}
                  {relation.createdAt.slice(0, 10)} · removed{' '}
                  {relation.removedAt?.slice(0, 10)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <h3>Inbound</h3>
        <ul className="entity-list">
          {inbound.map(({ source, relation }) => (
            <li key={`${source.id}-${relation.id}`}>
              <Link to={`/decisions/${source.id}`}>{source.title}</Link>
              <span>{RELATION_KIND_LABELS[relation.kind]} this decision</span>
              <span className="muted">
                recorded {relation.createdAt.slice(0, 19)}
              </span>
            </li>
          ))}
          {!inbound.length ? <li className="muted">No inbound links.</li> : null}
        </ul>
        <LineageForm
          library={decisions.filter((d) => d.id !== current.id)}
          onAdd={(targetDecisionId, kind, note) =>
            void persist(
              addDecisionRelation(current, { targetDecisionId, kind, note }),
            )
          }
        />
      </section>

      <section id="evidence" className="panel stack">
        <h2>Evidence / references</h2>
        <p className="section-hint">
          Notes, URLs, and quotes. Claimed availability is your assertion;
          recorded-at is when BranchBack accepted the record. Removal keeps a
          tombstone.
        </p>
        <ul className="entity-list">
          {evidenceActive.map((e) => {
            const prov = describeEvidenceProvenance(current, e)
            return (
              <li key={e.id}>
                <span className="pill">{prov.summary}</span>
                <strong>
                  {e.kind}: {e.label}
                </strong>
                {e.url ? (
                  <a href={e.url} rel="noreferrer" target="_blank">
                    {e.url}
                  </a>
                ) : null}
                <p>{e.body}</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void persist(removeEvidenceRef(current, e.id))}
                >
                  Remove
                </button>
              </li>
            )
          })}
          {!evidenceActive.length ? (
            <li className="muted">No references yet.</li>
          ) : null}
        </ul>
        {evidenceRemoved.length ? (
          <details>
            <summary>
              Removed evidence history ({evidenceRemoved.length})
            </summary>
            <ul className="entity-list">
              {evidenceRemoved.map((e) => (
                <li key={e.id} className="muted">
                  {e.label} · {describeEvidenceProvenance(current, e).summary} ·
                  removed {e.removedAt?.slice(0, 10)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <EvidenceForm
          onAdd={(input) => void persist(addEvidenceRef(current, input))}
        />
      </section>

      <section id="branches" className="panel">
        <h2>Alternative Branches</h2>
        <BranchDiagram decision={current} />
      </section>

      <section id="history" className="panel">
        <h2>History</h2>
        <p>
          <Link to={`/decisions/${current.id}/history`}>
            Open full history explorer
          </Link>
        </p>
        <RevisionTimeline decision={current} />
      </section>
    </div>
  )
}

function LineageForm({
  library,
  onAdd,
}: {
  library: Decision[]
  onAdd: (targetDecisionId: string, kind: RelationKind, note: string) => void
}) {
  const [targetDecisionId, setTarget] = useState('')
  const [kind, setKind] = useState<RelationKind>('related-to')
  const [note, setNote] = useState('')
  return (
    <form
      className="nested-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!targetDecisionId) return
        onAdd(targetDecisionId, kind, note)
        setNote('')
      }}
    >
      <h3>Add link</h3>
      <label>
        Target decision
        <select
          value={targetDecisionId}
          onChange={(e) => setTarget(e.target.value)}
          required
        >
          <option value="">Select…</option>
          {library.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kind
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as RelationKind)}
        >
          {(Object.keys(RELATION_KIND_LABELS) as RelationKind[]).map((k) => (
            <option key={k} value={k}>
              {RELATION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" className="btn">
        Add lineage link
      </button>
    </form>
  )
}

function EvidenceForm({
  onAdd,
}: {
  onAdd: (input: {
    kind: 'note' | 'url' | 'quote'
    label: string
    body: string
    url?: string | null
    availableAt: 'then' | 'later'
  }) => void
}) {
  return (
    <form
      className="nested-form"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        onAdd({
          kind: String(form.get('kind') ?? 'note') as 'note' | 'url' | 'quote',
          label: String(form.get('label') ?? ''),
          body: String(form.get('body') ?? ''),
          url: String(form.get('url') || '') || null,
          availableAt: String(form.get('availableAt') ?? 'then') as
            | 'then'
            | 'later',
        })
        e.currentTarget.reset()
      }}
    >
      <h3>Add reference</h3>
      <label>
        Kind
        <select name="kind" defaultValue="note">
          <option value="note">Note</option>
          <option value="url">URL</option>
          <option value="quote">Quote</option>
        </select>
      </label>
      <label>
        Available
        <select name="availableAt" defaultValue="then">
          <option value="then">Available then</option>
          <option value="later">Discovered later</option>
        </select>
      </label>
      <label>
        Label
        <input name="label" required />
      </label>
      <label>
        URL (optional)
        <input name="url" type="url" />
      </label>
      <label>
        Body
        <textarea name="body" rows={2} />
      </label>
      <button type="submit" className="btn">
        Add evidence
      </button>
    </form>
  )
}

function ReviewSummaryBlock({ decision }: { decision: Decision }) {
  const summary = buildReviewSummary(decision)
  if (!summary) return null
  return (
    <div className="review-summary nested">
      <h3>Review summary</h3>
      <dl className="kv">
        <div>
          <dt>What happened</dt>
          <dd>{summary.whatHappened}</dd>
        </div>
        <div>
          <dt>Decision quality</dt>
          <dd>{summary.decisionQuality}/5</dd>
        </div>
        <div>
          <dt>Outcome quality</dt>
          <dd>{summary.outcomeQuality}/5</dd>
        </div>
        <div>
          <dt>Failed assumptions</dt>
          <dd>
            {summary.failedAssumptions.length
              ? summary.failedAssumptions.join(' · ')
              : 'None'}
          </dd>
        </div>
        <div>
          <dt>Missed predictions</dt>
          <dd>
            {summary.missedPredictions.length
              ? summary.missedPredictions.join(' · ')
              : 'None'}
          </dd>
        </div>
        <div>
          <dt>Unknowable</dt>
          <dd>{summary.unknowable}</dd>
        </div>
      </dl>
    </div>
  )
}

function PredictionList({ decision }: { decision: Decision }) {
  const targets = listHistoricalPredictionTargets(decision)
  if (!targets.length) {
    return <p className="muted">No predictions.</p>
  }
  return (
    <ul className="entity-list">
      {targets.map((t) => {
        const state = predictionTemporalState(t.proposition)
        return (
          <li key={t.key} id={`pred-${t.predictionId}`}>
            <span className={`pill provenance-${t.provenance}`}>{t.label}</span>
            <strong>{t.proposition.statement}</strong>
            <span>
              <span className={`pill state-${state}`}>
                {predictionStateLabel(state)}
              </span>{' '}
              · {t.proposition.confidence}% · expect by{' '}
              {t.proposition.expectedDate}
              {t.proposition.evaluation ? ` · ${t.proposition.evaluation}` : ''}
            </span>
            <span className="muted">
              Criteria: {t.proposition.evaluationCriteria || '—'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function AssumptionList({
  decision,
  onAssignFamily,
}: {
  decision: Decision
  onAssignFamily: (assumptionId: string, label: string) => void
}) {
  const targets = listHistoricalAssumptionTargets(decision)
  if (!targets.length) {
    return <p className="muted">No assumptions.</p>
  }
  return (
    <ul className="entity-list">
      {targets.map((t) => {
        const highFail =
          t.proposition.status === 'FAILED' && t.proposition.confidence >= 70
        const working = decision.assumptions.find(
          (a) => a.id === t.assumptionId,
        )
        return (
          <li key={t.key} className={highFail ? 'emphasis-fail' : ''}>
            <span className={`pill provenance-${t.provenance}`}>{t.label}</span>
            <strong>{t.proposition.statement}</strong>
            <span>
              {t.proposition.status} · {t.proposition.confidence}% · importance{' '}
              {t.proposition.importance}
            </span>
            {t.proposition.familyLabel ? (
              <span className="pill">Family: {t.proposition.familyLabel}</span>
            ) : null}
            <span className="muted">
              Falsified if: {t.proposition.falsificationCondition || '—'}
            </span>
            {working && t.inWorkingState ? (
              <label>
                Belief family (user-confirmed)
                <input
                  defaultValue={working.familyLabel ?? ''}
                  placeholder="e.g. Hiring timeline optimism"
                  onBlur={(e) => {
                    if ((working.familyLabel ?? '') !== e.target.value) {
                      onAssignFamily(working.id, e.target.value)
                    }
                  }}
                />
              </label>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function RevisionTimeline({ decision }: { decision: Decision }) {
  const sequence = buildEnrichedHistorySequence(decision)
  if (!sequence.length) {
    return <p className="muted">No history yet.</p>
  }
  return (
    <ol className="revision-timeline history-sequence">
      {sequence.map((step) => (
        <li key={step.id}>
          <p className="timeline-kind">{step.label}</p>
          <p className="timeline-date">{step.at.slice(0, 19)}</p>
          <p>{step.detail}</p>
          {step.changes?.length ? (
            <ul className="change-list">
              {step.changes.map((c, i) => (
                <li key={`${c.field}-${c.label}-${i}`}>
                  <strong>{c.label}:</strong> {c.before} → {c.after}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
