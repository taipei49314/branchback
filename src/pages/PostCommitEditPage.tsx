import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDecision, useDecisionStore } from '@/application/useDecisionStore'
import { reviseAfterCommit } from '@/domain/decision'
import { createId } from '@/domain/ids'
import { DomainError } from '@/domain/errors'
import type {
  Assumption,
  DecisionContext,
  Option,
  Prediction,
  Rating,
} from '@/domain/types'

type Tab = 'basics' | 'context' | 'options' | 'assumptions' | 'predictions' | 'dates'

export function PostCommitEditPage() {
  const { id } = useParams()
  const decision = useDecision(id)
  const { save } = useDecisionStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('basics')
  const [title, setTitle] = useState(decision?.title ?? '')
  const [description, setDescription] = useState(decision?.description ?? '')
  const [context, setContext] = useState<DecisionContext>(
    decision?.context ?? {
      situation: '',
      constraints: '',
      stakes: '',
      deadline: null,
      peopleInvolved: [],
      tags: [],
    },
  )
  const [options, setOptions] = useState<Option[]>(decision?.options ?? [])
  const [assumptions, setAssumptions] = useState<Assumption[]>(
    decision?.assumptions ?? [],
  )
  const [predictions, setPredictions] = useState<Prediction[]>(
    decision?.predictions ?? [],
  )
  const [decisionDate, setDecisionDate] = useState(
    decision?.decisionDate ?? '',
  )
  const [reviewDate, setReviewDate] = useState(decision?.reviewDate ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!decision) {
    return (
      <div className="page">
        <p>Decision not found.</p>
      </div>
    )
  }

  if (!decision.commitSnapshot) {
    return (
      <div className="page narrow">
        <h1>Commit first</h1>
        <p>Later changes only apply after an immutable commit.</p>
        <Link className="btn primary" to={`/decisions/${decision.id}/commit`}>
          Commit
        </Link>
      </div>
    )
  }

  async function onSave() {
    setBusy(true)
    setError(null)
    try {
      const next = reviseAfterCommit(decision!, {
        title,
        description,
        context: {
          ...context,
          tags: context.tags.map((t) => t.trim()).filter(Boolean),
          peopleInvolved: context.peopleInvolved
            .map((p) => p.trim())
            .filter(Boolean),
        },
        options,
        assumptions,
        predictions,
        decisionDate: decisionDate || null,
        reviewDate: reviewDate || null,
        note: note.trim() || 'Later clarification',
      })
      await save(next)
      navigate(`/decisions/${decision!.id}#history`)
    } catch (e) {
      setError(e instanceof DomainError ? e.message : 'Could not save revision')
    } finally {
      setBusy(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'basics', label: 'Basics' },
    { id: 'context', label: 'Context' },
    { id: 'options', label: 'Options' },
    { id: 'assumptions', label: 'Assumptions' },
    { id: 'predictions', label: 'Predictions' },
    { id: 'dates', label: 'Dates' },
  ]

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Later change</p>
        <h1>Update what you believe now</h1>
        <p className="lede notice-box">
          You are updating the working state — not rewriting Known Then. The
          original committed snapshot stays unchanged; this save appends an
          authentic revision.
        </p>
      </header>

      <label className="panel">
        Reason for this later change
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Clarified stakes after new information"
          required
          aria-describedby="revise-reason-help"
        />
        <span id="revise-reason-help" className="muted">
          Stored with the revision so later you can see why the working copy
          moved.
        </span>
      </label>

      <nav className="workspace-nav" aria-label="Revision sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'nav-link active' : 'nav-link'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'basics' ? (
        <section className="panel form-grid">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </section>
      ) : null}

      {tab === 'context' ? (
        <section className="panel form-grid">
          <label>
            Situation
            <textarea
              rows={3}
              value={context.situation}
              onChange={(e) =>
                setContext({ ...context, situation: e.target.value })
              }
            />
          </label>
          <label>
            Constraints
            <textarea
              rows={2}
              value={context.constraints}
              onChange={(e) =>
                setContext({ ...context, constraints: e.target.value })
              }
            />
          </label>
          <label>
            Stakes
            <textarea
              rows={2}
              value={context.stakes}
              onChange={(e) =>
                setContext({ ...context, stakes: e.target.value })
              }
            />
          </label>
          <label>
            Tags (comma-separated)
            <input
              value={context.tags.join(', ')}
              onChange={(e) =>
                setContext({
                  ...context,
                  tags: e.target.value.split(',').map((t) => t.trim()),
                })
              }
            />
          </label>
          <label>
            People involved (comma-separated)
            <input
              value={context.peopleInvolved.join(', ')}
              onChange={(e) =>
                setContext({
                  ...context,
                  peopleInvolved: e.target.value.split(',').map((t) => t.trim()),
                })
              }
            />
          </label>
          <label>
            Deadline (optional calendar day)
            <input
              type="date"
              value={context.deadline ?? ''}
              onChange={(e) =>
                setContext({
                  ...context,
                  deadline: e.target.value || null,
                })
              }
            />
          </label>
        </section>
      ) : null}

      {tab === 'options' ? (
        <section className="panel stack">
          <p className="muted">
            Adding or editing options here does not change the historical branch
            tree at commit — only working state.
          </p>
          {options.map((o, index) => (
            <fieldset key={o.id} className="nested-form">
              <legend>Option {index + 1}</legend>
              <label>
                Title
                <input
                  value={o.title}
                  onChange={(e) => {
                    const next = [...options]
                    next[index] = { ...o, title: e.target.value }
                    setOptions(next)
                  }}
                />
              </label>
              <label>
                Estimated success %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={o.estimatedProbability}
                  onChange={(e) => {
                    const next = [...options]
                    next[index] = {
                      ...o,
                      estimatedProbability: Number(e.target.value),
                    }
                    setOptions(next)
                  }}
                />
              </label>
              <label>
                Description
                <textarea
                  rows={2}
                  value={o.description}
                  onChange={(e) => {
                    const next = [...options]
                    next[index] = { ...o, description: e.target.value }
                    setOptions(next)
                  }}
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setOptions(options.filter((x) => x.id !== o.id))
                }
              >
                Remove option
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              setOptions([
                ...options,
                {
                  id: createId('opt'),
                  title: 'New option',
                  description: '',
                  perceivedUpside: '',
                  perceivedDownside: '',
                  estimatedProbability: 50,
                  reasonsForChoosing: [],
                  reasonsForRejecting: [],
                },
              ])
            }
          >
            Add option
          </button>
        </section>
      ) : null}

      {tab === 'assumptions' ? (
        <section className="panel stack">
          <p className="muted">
            Changing confidence here updates working belief. Calibration still
            uses commit-time confidence for historical scoring.
          </p>
          {assumptions.map((a, index) => (
            <fieldset key={a.id} className="nested-form">
              <legend>Assumption {index + 1}</legend>
              <label>
                Statement
                <textarea
                  rows={2}
                  value={a.statement}
                  onChange={(e) => {
                    const next = [...assumptions]
                    next[index] = { ...a, statement: e.target.value }
                    setAssumptions(next)
                  }}
                />
              </label>
              <label>
                Confidence %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={a.confidence}
                  onChange={(e) => {
                    const next = [...assumptions]
                    next[index] = { ...a, confidence: Number(e.target.value) }
                    setAssumptions(next)
                  }}
                />
              </label>
              <label>
                Importance (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={a.importance}
                  onChange={(e) => {
                    const next = [...assumptions]
                    next[index] = {
                      ...a,
                      importance: Number(e.target.value) as Rating,
                    }
                    setAssumptions(next)
                  }}
                />
              </label>
              <label>
                Falsification condition
                <input
                  value={a.falsificationCondition}
                  onChange={(e) => {
                    const next = [...assumptions]
                    next[index] = {
                      ...a,
                      falsificationCondition: e.target.value,
                    }
                    setAssumptions(next)
                  }}
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setAssumptions(assumptions.filter((x) => x.id !== a.id))
                }
              >
                Remove
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              setAssumptions([
                ...assumptions,
                {
                  id: createId('asm'),
                  statement: '',
                  confidence: 50,
                  importance: 3,
                  falsificationCondition: '',
                  status: 'UNKNOWN',
                  familyId: null,
                  familyLabel: null,
                },
              ])
            }
          >
            Add assumption
          </button>
        </section>
      ) : null}

      {tab === 'predictions' ? (
        <section className="panel stack">
          <p className="muted">
            Later confidence edits do not rewrite the confidence used for
            calibration (that stays at commit).
          </p>
          {predictions.map((p, index) => (
            <fieldset key={p.id} className="nested-form">
              <legend>Prediction {index + 1}</legend>
              <label>
                Statement
                <textarea
                  rows={2}
                  value={p.statement}
                  onChange={(e) => {
                    const next = [...predictions]
                    next[index] = { ...p, statement: e.target.value }
                    setPredictions(next)
                  }}
                />
              </label>
              <label>
                Expected result
                <input
                  value={p.expectedResult}
                  onChange={(e) => {
                    const next = [...predictions]
                    next[index] = { ...p, expectedResult: e.target.value }
                    setPredictions(next)
                  }}
                />
              </label>
              <label>
                Expected date
                <input
                  type="date"
                  value={p.expectedDate}
                  onChange={(e) => {
                    const next = [...predictions]
                    next[index] = { ...p, expectedDate: e.target.value }
                    setPredictions(next)
                  }}
                />
              </label>
              <label>
                Confidence %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={p.confidence}
                  onChange={(e) => {
                    const next = [...predictions]
                    next[index] = { ...p, confidence: Number(e.target.value) }
                    setPredictions(next)
                  }}
                />
              </label>
              <label>
                Evaluation criteria
                <input
                  value={p.evaluationCriteria}
                  onChange={(e) => {
                    const next = [...predictions]
                    next[index] = {
                      ...p,
                      evaluationCriteria: e.target.value,
                    }
                    setPredictions(next)
                  }}
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setPredictions(predictions.filter((x) => x.id !== p.id))
                }
              >
                Remove
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              setPredictions([
                ...predictions,
                {
                  id: createId('prd'),
                  statement: '',
                  expectedResult: '',
                  expectedDate: decisionDate || new Date().toISOString().slice(0, 10),
                  confidence: 50,
                  evaluationCriteria: '',
                  evaluation: null,
                },
              ])
            }
          >
            Add prediction
          </button>
        </section>
      ) : null}

      {tab === 'dates' ? (
        <section className="panel form-grid">
          <label>
            Decision date (calendar day)
            <input
              type="date"
              value={decisionDate}
              onChange={(e) => setDecisionDate(e.target.value)}
            />
          </label>
          <label>
            Review date (calendar day)
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
            />
          </label>
        </section>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions sticky-actions">
        <Link className="btn" to={`/decisions/${decision.id}`}>
          Cancel
        </Link>
        <button
          type="button"
          className="btn primary"
          disabled={busy || !title.trim()}
          onClick={() => void onSave()}
        >
          Save revision
        </button>
      </div>
    </div>
  )
}
