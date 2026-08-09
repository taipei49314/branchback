import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDecision, useDecisionStore } from '@/application/useDecisionStore'
import { recordReview } from '@/domain/decision'
import {
  buildMemoryDriftComparison,
  memoryDriftSignalLabel,
} from '@/domain/memoryDrift'
import {
  listHistoricalAssumptionTargets,
  listHistoricalPredictionTargets,
} from '@/domain/historicalIdentity'
import type {
  AssumptionStatus,
  PredictionEvaluation,
  Rating,
} from '@/domain/types'
import { DomainError } from '@/domain/errors'

const ASSUMPTION_STATUSES: AssumptionStatus[] = [
  'UNKNOWN',
  'HELD',
  'FAILED',
  'PARTIAL',
  'UNTESTABLE',
]

const PRED_EVALS: PredictionEvaluation[] = [
  'CORRECT',
  'INCORRECT',
  'PARTIAL',
  'UNKNOWN',
]

type Phase =
  | 'hindsight'
  | 'reveal'
  | 'reality'
  | 'evaluate'
  | 'ratings'
  | 'summary'

const STEPS: Array<[Phase, string]> = [
  ['hindsight', 'Remember'],
  ['reveal', 'Drift'],
  ['reality', 'Reality'],
  ['evaluate', 'Evaluate'],
  ['ratings', 'Rate'],
  ['summary', 'Summary'],
]

export function ReviewPage() {
  const { id } = useParams()
  const decision = useDecision(id)
  const { save } = useDecisionStore()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('hindsight')
  const [rememberedBelief, setRememberedBelief] = useState('')
  const [rememberedChoice, setRememberedChoice] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [unexpected, setUnexpected] = useState('')
  const [missingInformation, setMissingInformation] = useState('')
  const [outcomeRating, setOutcomeRating] = useState<Rating>(3)
  const [decisionQualityRating, setDecisionQualityRating] = useState<Rating>(3)
  /** keyed by historical target key (id:fingerprint) */
  const [assumptionStatuses, setAssumptionStatuses] = useState<
    Record<string, AssumptionStatus>
  >({})
  const [predictionEvaluations, setPredictionEvaluations] = useState<
    Record<string, PredictionEvaluation>
  >({})
  const [error, setError] = useState<string | null>(null)

  const snap = decision?.commitSnapshot
  const predictionTargets = useMemo(
    () => (decision ? listHistoricalPredictionTargets(decision) : []),
    [decision],
  )
  const assumptionTargets = useMemo(
    () => (decision ? listHistoricalAssumptionTargets(decision) : []),
    [decision],
  )

  const chosenTitle = useMemo(() => {
    if (!snap) return '—'
    return snap.options.find((o) => o.id === snap.selectedOptionId)?.title ?? '—'
  }, [snap])

  const rememberedCombined = useMemo(() => {
    const parts = [rememberedBelief.trim()]
    if (rememberedChoice.trim()) {
      parts.push(`I remember choosing: ${rememberedChoice.trim()}`)
    }
    return parts.filter(Boolean).join('\n')
  }, [rememberedBelief, rememberedChoice])

  const driftRows = useMemo(() => {
    if (!snap) return []
    return buildMemoryDriftComparison(snap, rememberedCombined)
  }, [snap, rememberedCombined])

  if (!decision) {
    return (
      <div className="page">
        <p>Decision not found.</p>
      </div>
    )
  }

  if (!snap) {
    return (
      <div className="page narrow">
        <h1>Commit first</h1>
        <p>Reviews require an immutable commit snapshot.</p>
        <Link className="btn primary" to={`/decisions/${decision.id}/commit`}>
          Commit
        </Link>
      </div>
    )
  }

  const failedPreview = assumptionTargets
    .filter((t) => assumptionStatuses[t.key] === 'FAILED')
    .map((t) => `${t.proposition.statement} (${t.label})`)
  const missedPreview = predictionTargets
    .filter((t) => {
      const ev = predictionEvaluations[t.key]
      return ev === 'INCORRECT' || ev === 'PARTIAL'
    })
    .map((t) => `${t.proposition.statement} (${t.label})`)

  async function submit() {
    setError(null)
    try {
      const remembered = rememberedCombined
      const memoryDriftNotes = remembered
        ? 'Memory Drift compares remembered reconstruction with Known Then using deterministic overlap signals only — not a psychological diagnosis.'
        : null
      const next = recordReview(decision!, {
        whatHappened,
        unexpected,
        missingInformation,
        outcomeRating,
        decisionQualityRating,
        rememberedBelief: remembered || null,
        memoryDriftNotes,
        assumptionStatuses: assumptionTargets
          .filter((t) => assumptionStatuses[t.key])
          .map((t) => ({
            assumptionId: t.assumptionId,
            status: assumptionStatuses[t.key]!,
            fingerprint: t.fingerprint,
            provenance: t.provenance,
          })),
        predictionEvaluations: predictionTargets
          .filter((t) => predictionEvaluations[t.key])
          .map((t) => ({
            predictionId: t.predictionId,
            evaluation: predictionEvaluations[t.key]!,
            fingerprint: t.fingerprint,
            provenance: t.provenance,
          })),
        counterfactualNotes: [],
      })
      await save(next)
      navigate(`/decisions/${decision!.id}#review`)
    } catch (e) {
      setError(e instanceof DomainError ? e.message : 'Review failed')
    }
  }

  return (
    <div className="page narrow">
      <header className="page-header">
        <p className="eyebrow">Review</p>
        <h1>{decision.title}</h1>
        <p className="lede">
          Separate what happened from whether the original decision was
          reasonable given what you knew then. Evaluations bind to exact
          historical propositions — not just ids.
        </p>
        <ol className="stepper" aria-label="Review steps">
          {STEPS.map(([stepId, label]) => (
            <li key={stepId} className={phase === stepId ? 'current' : ''}>
              <button type="button" onClick={() => setPhase(stepId)}>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {phase === 'hindsight' ? (
        <section className="panel stack">
          <h2>Hindsight test</h2>
          <p>
            Before seeing the historical record: what do you remember believing
            at the time?
          </p>
          <label>
            Remembered belief
            <textarea
              rows={4}
              value={rememberedBelief}
              onChange={(e) => setRememberedBelief(e.target.value)}
              placeholder="I remember thinking…"
              aria-describedby="hindsight-help"
            />
            <span id="hindsight-help" className="muted">
              Free recall first — Known Then stays hidden until you continue.
            </span>
          </label>
          <label>
            Remembered choice (optional)
            <input
              value={rememberedChoice}
              onChange={(e) => setRememberedChoice(e.target.value)}
              placeholder="Which option do you remember selecting?"
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setPhase('reveal')}
            >
              Skip
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => setPhase('reveal')}
            >
              Reveal Known Then
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'reveal' ? (
        <section className="panel stack">
          <h2>Memory Drift</h2>
          <p className="muted">
            Side-by-side comparison uses mechanical text overlap only. Labels
            are descriptive, not diagnostic.
          </p>
          <div className="drift-table" role="table" aria-label="Memory Drift">
            <div className="drift-table-head" role="row">
              <span role="columnheader">Aspect</span>
              <span role="columnheader">Recorded then</span>
              <span role="columnheader">Remembered now</span>
              <span role="columnheader">Signal</span>
            </div>
            {driftRows.map((row) => (
              <div key={row.label} className="drift-table-row" role="row">
                <span role="cell">
                  <strong>{row.label}</strong>
                  <span className="muted">{row.note}</span>
                </span>
                <span role="cell">{row.recordedThen}</span>
                <span role="cell">{row.rememberedNow}</span>
                <span role="cell">
                  <span className={`pill signal-${row.signal}`}>
                    {memoryDriftSignalLabel(row.signal)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => setPhase('reality')}
            >
              Continue to reality
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'reality' ? (
        <section className="panel form-grid">
          <h2>Reality</h2>
          <label>
            What actually happened?
            <textarea
              rows={4}
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              required
            />
          </label>
          <label>
            What surprised you?
            <textarea
              rows={3}
              value={unexpected}
              onChange={(e) => setUnexpected(e.target.value)}
            />
          </label>
          <label>
            What information did you not have?
            <textarea
              rows={3}
              value={missingInformation}
              onChange={(e) => setMissingInformation(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              disabled={!whatHappened.trim()}
              onClick={() => setPhase('evaluate')}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'evaluate' ? (
        <section className="panel form-grid">
          <h2>Assumptions & predictions</h2>
          <p className="muted">
            Each row is an exact historical proposition. Commit-time claims stay
            visible even if later removed. Revised content appears as a separate
            later row — evaluating it does not rewrite the original claim.
          </p>
          <h3>Assumptions</h3>
          {assumptionTargets.map((t) => (
            <label key={t.key} className={`hist-target provenance-${t.provenance}`}>
              <span className={`pill provenance-${t.provenance}`}>{t.label}</span>
              <strong>{t.proposition.statement}</strong>
              <span className="muted">
                confidence {t.proposition.confidence}% · falsified if:{' '}
                {t.proposition.falsificationCondition || '—'}
              </span>
              <select
                value={assumptionStatuses[t.key] ?? 'UNKNOWN'}
                onChange={(e) =>
                  setAssumptionStatuses((prev) => ({
                    ...prev,
                    [t.key]: e.target.value as AssumptionStatus,
                  }))
                }
              >
                {ASSUMPTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {!assumptionTargets.length ? (
            <p className="muted">No assumptions.</p>
          ) : null}

          <h3>Predictions</h3>
          {predictionTargets.map((t) => (
            <label
              key={t.key}
              className={`hist-target provenance-${t.provenance}`}
              data-testid={`hist-pred-${t.provenance}`}
            >
              <span className={`pill provenance-${t.provenance}`}>{t.label}</span>
              <strong>{t.proposition.statement}</strong>
              <span className="muted">
                {t.proposition.confidence}% · by {t.proposition.expectedDate} ·
                criteria: {t.proposition.evaluationCriteria || '—'}
              </span>
              <select
                value={predictionEvaluations[t.key] ?? 'UNKNOWN'}
                onChange={(e) =>
                  setPredictionEvaluations((prev) => ({
                    ...prev,
                    [t.key]: e.target.value as PredictionEvaluation,
                  }))
                }
              >
                {PRED_EVALS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {!predictionTargets.length ? (
            <p className="muted">No predictions.</p>
          ) : null}
          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => setPhase('ratings')}
            >
              Continue to ratings
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'ratings' ? (
        <section className="panel form-grid">
          <h2>Two separate ratings</h2>
          <div className="rating-pair">
            <label className="rating-card outcome">
              Outcome quality (1–5)
              <input
                type="number"
                min={1}
                max={5}
                value={outcomeRating}
                onChange={(e) =>
                  setOutcomeRating(Number(e.target.value) as Rating)
                }
              />
              <span className="muted">What happened in the world</span>
            </label>
            <label className="rating-card decision-q">
              Decision quality (1–5)
              <input
                type="number"
                min={1}
                max={5}
                value={decisionQualityRating}
                onChange={(e) =>
                  setDecisionQualityRating(Number(e.target.value) as Rating)
                }
              />
              <span className="muted">
                Reasonable given information available then
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              disabled={!whatHappened.trim()}
              onClick={() => setPhase('summary')}
            >
              Preview summary
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'summary' ? (
        <section className="panel stack review-summary">
          <h2>Review summary</h2>
          <dl className="kv">
            <div>
              <dt>What happened</dt>
              <dd>{whatHappened || '—'}</dd>
            </div>
            <div>
              <dt>Decision quality</dt>
              <dd>{decisionQualityRating}/5</dd>
            </div>
            <div>
              <dt>Outcome quality</dt>
              <dd>{outcomeRating}/5</dd>
            </div>
            <div>
              <dt>Assumptions that failed</dt>
              <dd>
                {failedPreview.length ? failedPreview.join(' · ') : 'None marked'}
              </dd>
            </div>
            <div>
              <dt>Predictions that missed</dt>
              <dd>
                {missedPreview.length ? missedPreview.join(' · ') : 'None marked'}
              </dd>
            </div>
            <div>
              <dt>Memory Drift</dt>
              <dd>
                {rememberedCombined
                  ? `${driftRows.filter((r) => r.signal === 'omitted-in-memory').length} omitted-in-memory signals (mechanical).`
                  : 'No remembered belief recorded.'}
              </dd>
            </div>
            <div>
              <dt>What remains unknowable</dt>
              <dd>
                Unchosen branches remain counterfactual — BranchBack does not
                invent alternate outcomes. Chose “{chosenTitle}” at commit.
              </dd>
            </div>
          </dl>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-actions">
            <Link className="btn" to={`/decisions/${decision.id}`}>
              Cancel
            </Link>
            <button
              type="button"
              className="btn primary"
              disabled={!whatHappened.trim()}
              onClick={() => void submit()}
            >
              Save review
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
