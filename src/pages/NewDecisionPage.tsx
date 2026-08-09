import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  addAssumption,
  addOption,
  addPrediction,
  createDecision,
  setDecisionProtocol,
  updateDraftFields,
} from '@/domain/decision'
import type { Decision, DecisionProtocolId, Rating } from '@/domain/types'
import { DECISION_PROTOCOLS, getProtocol } from '@/domain/protocols'
import { useDecisionStore } from '@/application/useDecisionStore'
import { DomainError } from '@/domain/errors'

type Step = 'basics' | 'options' | 'assumptions' | 'predictions' | 'review'

const STEPS: Step[] = [
  'basics',
  'options',
  'assumptions',
  'predictions',
  'review',
]

export function NewDecisionPage() {
  const { save } = useDecisionStore()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('basics')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Decision>(() =>
    createDecision({ title: 'Untitled decision' }),
  )

  const stepIndex = STEPS.indexOf(step)

  const canContinue = useMemo(() => {
    if (step === 'basics') return draft.title.trim().length > 0
    if (step === 'options') return draft.options.length >= 2
    return true
  }, [step, draft])

  function patchBasics(form: FormData) {
    const protocolId = String(
      form.get('protocolId') ?? 'general',
    ) as DecisionProtocolId
    const protocol = getProtocol(protocolId)
    setDraft((d) => {
      let next = updateDraftFields(d, {
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        decisionDate: String(form.get('decisionDate') || '') || null,
        reviewDate: String(form.get('reviewDate') || '') || null,
        context: {
          situation: String(form.get('situation') ?? ''),
          constraints: String(form.get('constraints') ?? ''),
          stakes: String(form.get('stakes') ?? ''),
          deadline: String(form.get('deadline') || '') || null,
          peopleInvolved: String(form.get('people') ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          tags: [
            ...new Set([
              ...String(form.get('tags') ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              ...protocol.suggestedTags,
            ]),
          ],
        },
      })
      next = setDecisionProtocol(next, protocolId)
      return next
    })
  }

  function addOptionFromForm(form: FormData) {
    try {
      setDraft((d) =>
        addOption(d, {
          title: String(form.get('title') ?? ''),
          description: String(form.get('description') ?? ''),
          perceivedUpside: String(form.get('upside') ?? ''),
          perceivedDownside: String(form.get('downside') ?? ''),
          estimatedProbability: Number(form.get('probability') ?? 50),
          reasonsForChoosing: String(form.get('reasonsFor') ?? '')
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean),
          reasonsForRejecting: String(form.get('reasonsAgainst') ?? '')
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      )
      setError(null)
    } catch (e) {
      setError(e instanceof DomainError ? e.message : 'Could not add option')
    }
  }

  function addAssumptionFromForm(form: FormData) {
    try {
      setDraft((d) =>
        addAssumption(d, {
          statement: String(form.get('statement') ?? ''),
          confidence: Number(form.get('confidence') ?? 50),
          importance: Number(form.get('importance') ?? 3) as Rating,
          falsificationCondition: String(form.get('falsification') ?? ''),
        }),
      )
      setError(null)
    } catch (e) {
      setError(
        e instanceof DomainError ? e.message : 'Could not add assumption',
      )
    }
  }

  function addPredictionFromForm(form: FormData) {
    try {
      setDraft((d) =>
        addPrediction(d, {
          statement: String(form.get('statement') ?? ''),
          expectedResult: String(form.get('expectedResult') ?? ''),
          expectedDate: String(form.get('expectedDate') ?? ''),
          confidence: Number(form.get('confidence') ?? 50),
          evaluationCriteria: String(form.get('criteria') ?? ''),
        }),
      )
      setError(null)
    } catch (e) {
      setError(
        e instanceof DomainError ? e.message : 'Could not add prediction',
      )
    }
  }

  async function persist() {
    try {
      const saved = await save(draft)
      navigate(`/decisions/${saved.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <div className="page narrow">
      <header className="page-header">
        <p className="eyebrow">New decision</p>
        <h1>Capture what you believe now</h1>
        <p className="lede">
          Record options, assumptions, and predictions before reality rewrites
          the story.
        </p>
      </header>

      <ol className="stepper" aria-label="Creation steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === stepIndex ? 'current' : i < stepIndex ? 'done' : ''}>
            <button type="button" onClick={() => setStep(s)}>
              {s}
            </button>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'basics' ? (
        <form
          className="panel form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            patchBasics(new FormData(e.currentTarget))
            setStep('options')
          }}
        >
          <label>
            Title
            <input name="title" required defaultValue={draft.title} />
          </label>
          <label>
            Capture protocol
            <select name="protocolId" defaultValue={draft.protocolId}>
              {DECISION_PROTOCOLS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Protocols only prompt useful fields — they never advise which option
            to choose. Current prompts:{' '}
            {getProtocol(draft.protocolId).prompts.situation}
          </p>
          <label>
            Description
            <textarea name="description" rows={3} defaultValue={draft.description} />
          </label>
          <label>
            Situation / context
            <textarea
              name="situation"
              rows={4}
              defaultValue={draft.context.situation}
            />
          </label>
          <label>
            Constraints
            <textarea
              name="constraints"
              rows={2}
              defaultValue={draft.context.constraints}
            />
          </label>
          <label>
            Stakes
            <textarea name="stakes" rows={2} defaultValue={draft.context.stakes} />
          </label>
          <div className="form-row">
            <label>
              Deadline
              <input
                name="deadline"
                type="date"
                defaultValue={draft.context.deadline ?? ''}
              />
            </label>
            <label>
              Decision date
              <input
                name="decisionDate"
                type="date"
                defaultValue={draft.decisionDate ?? ''}
              />
            </label>
            <label>
              Review date
              <input
                name="reviewDate"
                type="date"
                defaultValue={draft.reviewDate ?? ''}
              />
            </label>
          </div>
          <label>
            People involved (comma-separated)
            <input
              name="people"
              defaultValue={draft.context.peopleInvolved.join(', ')}
            />
          </label>
          <label>
            Tags (comma-separated)
            <input name="tags" defaultValue={draft.context.tags.join(', ')} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Continue to options
            </button>
          </div>
        </form>
      ) : null}

      {step === 'options' ? (
        <div className="stack">
          <section className="panel">
            <h2>Options ({draft.options.length}) — need at least 2</h2>
            <ul className="entity-list">
              {draft.options.map((o) => (
                <li key={o.id}>
                  <strong>{o.title}</strong>
                  <span>{o.estimatedProbability}% est. success</span>
                </li>
              ))}
            </ul>
          </section>
          <form
            className="panel form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              addOptionFromForm(new FormData(e.currentTarget))
              e.currentTarget.reset()
            }}
          >
            <h3>Add option</h3>
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Description
              <textarea name="description" rows={2} />
            </label>
            <label>
              Perceived upside
              <input name="upside" />
            </label>
            <label>
              Perceived downside
              <input name="downside" />
            </label>
            <label>
              Estimated probability of success (0–100)
              <input name="probability" type="number" min={0} max={100} defaultValue={50} />
            </label>
            <label>
              Reasons for choosing (separate with ;)
              <input name="reasonsFor" />
            </label>
            <label>
              Reasons for rejecting (separate with ;)
              <input name="reasonsAgainst" />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn">
                Add option
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!canContinue}
                onClick={() => setStep('assumptions')}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {step === 'assumptions' ? (
        <div className="stack">
          <section className="panel">
            <h2>Assumptions (separate from reasons)</h2>
            <ul className="entity-list">
              {draft.assumptions.map((a) => (
                <li key={a.id}>
                  <strong>{a.statement}</strong>
                  <span>
                    {a.confidence}% · importance {a.importance}
                  </span>
                </li>
              ))}
              {!draft.assumptions.length ? <li>None yet</li> : null}
            </ul>
          </section>
          <form
            className="panel form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              addAssumptionFromForm(new FormData(e.currentTarget))
              e.currentTarget.reset()
            }}
          >
            <label>
              Statement
              <input name="statement" required placeholder='e.g. "Demand will keep rising"' />
            </label>
            <label>
              Confidence (0–100)
              <input name="confidence" type="number" min={0} max={100} defaultValue={60} />
            </label>
            <label>
              Importance (1–5)
              <input name="importance" type="number" min={1} max={5} defaultValue={3} />
            </label>
            <label>
              Falsification condition
              <input name="falsification" placeholder="What would prove this wrong?" />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn">
                Add assumption
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => setStep('predictions')}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {step === 'predictions' ? (
        <div className="stack">
          <section className="panel">
            <h2>Predictions</h2>
            <ul className="entity-list">
              {draft.predictions.map((p) => (
                <li key={p.id}>
                  <strong>{p.statement}</strong>
                  <span>
                    by {p.expectedDate} · {p.confidence}%
                  </span>
                </li>
              ))}
              {!draft.predictions.length ? <li>None yet</li> : null}
            </ul>
          </section>
          <form
            className="panel form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              addPredictionFromForm(new FormData(e.currentTarget))
              e.currentTarget.reset()
            }}
          >
            <label>
              Statement
              <input name="statement" required />
            </label>
            <label>
              Expected result
              <input name="expectedResult" />
            </label>
            <label>
              Expected date
              <input name="expectedDate" type="date" required />
            </label>
            <label>
              Confidence (0–100)
              <input name="confidence" type="number" min={0} max={100} defaultValue={60} />
            </label>
            <label>
              Evaluation criteria
              <input name="criteria" />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn">
                Add prediction
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => setStep('review')}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {step === 'review' ? (
        <section className="panel stack">
          <h2>Ready to save draft</h2>
          <p>
            This saves an <strong>OPEN</strong> decision. Commit (immutable
            snapshot) happens on the commit screen after you choose an option.
          </p>
          <dl className="kv">
            <div>
              <dt>Title</dt>
              <dd>{draft.title}</dd>
            </div>
            <div>
              <dt>Options</dt>
              <dd>{draft.options.length}</dd>
            </div>
            <div>
              <dt>Assumptions</dt>
              <dd>{draft.assumptions.length}</dd>
            </div>
            <div>
              <dt>Predictions</dt>
              <dd>{draft.predictions.length}</dd>
            </div>
          </dl>
          <div className="form-actions">
            <Link className="btn" to="/decisions">
              Cancel
            </Link>
            <button
              type="button"
              className="btn primary"
              disabled={draft.options.length < 2}
              onClick={() => void persist()}
            >
              Save decision
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
