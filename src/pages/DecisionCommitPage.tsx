import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDecision, useDecisionStore } from '@/application/useDecisionStore'
import { commitDecision } from '@/domain/decision'
import { DomainError } from '@/domain/errors'

export function DecisionCommitPage() {
  const { id } = useParams()
  const decision = useDecision(id)
  const { save } = useDecisionStore()
  const navigate = useNavigate()
  const [selectedOptionId, setSelectedOptionId] = useState(
    decision?.selectedOptionId ?? '',
  )
  const [decisionDate, setDecisionDate] = useState(
    decision?.decisionDate ?? new Date().toISOString().slice(0, 10),
  )
  const [reviewDate, setReviewDate] = useState(
    decision?.reviewDate ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!decision) {
    return (
      <div className="page">
        <p>Decision not found.</p>
      </div>
    )
  }

  if (decision.commitSnapshot) {
    return (
      <div className="page narrow">
        <h1>Already committed</h1>
        <p>
          Snapshot <code>{decision.commitSnapshot.snapshotId}</code> is
          immutable and cannot be overwritten.
        </p>
        <Link className="btn" to={`/decisions/${decision.id}`}>
          Back to detail
        </Link>
      </div>
    )
  }

  async function onCommit() {
    setBusy(true)
    setError(null)
    try {
      const next = commitDecision(decision!, {
        selectedOptionId,
        decisionDate,
        reviewDate,
      })
      await save(next)
      navigate(`/decisions/${decision!.id}`)
    } catch (e) {
      setError(e instanceof DomainError ? e.message : 'Commit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <header className="page-header">
        <p className="eyebrow">Commit</p>
        <h1>Freeze what you believe now</h1>
        <p className="lede">
          Committing creates an immutable snapshot. Later edits become
          revisions — they do not rewrite “then”.
        </p>
      </header>

      <section className="panel form-grid">
        <fieldset>
          <legend>Select exactly one option</legend>
          {decision.options.map((o) => (
            <label key={o.id} className="radio-row">
              <input
                type="radio"
                name="selected"
                value={o.id}
                checked={selectedOptionId === o.id}
                onChange={() => setSelectedOptionId(o.id)}
              />
              <span>
                <strong>{o.title}</strong>
                <span className="muted"> · {o.estimatedProbability}%</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label>
          Decision date
          <input
            type="date"
            value={decisionDate}
            onChange={(e) => setDecisionDate(e.target.value)}
            required
          />
        </label>
        <label>
          Review date
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            required
          />
        </label>

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
            disabled={
              busy ||
              !selectedOptionId ||
              !decisionDate ||
              !reviewDate ||
              decision.options.length < 2
            }
            onClick={() => void onCommit()}
          >
            Create immutable snapshot
          </button>
        </div>
      </section>
    </div>
  )
}
