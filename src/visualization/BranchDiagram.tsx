import type { Decision } from '@/domain/types'

/**
 * Branch replay uses options frozen at commit (Known Then).
 * Working-state option edits appear separately and never rewrite the historical tree.
 */
export function BranchDiagram({ decision }: { decision: Decision }) {
  const snap = decision.commitSnapshot
  const originalOptions = snap?.options ?? decision.options
  const selectedId =
    snap?.selectedOptionId ?? decision.selectedOptionId ?? null
  const originalIds = new Set(originalOptions.map((o) => o.id))
  const laterOnly = decision.options.filter((o) => !originalIds.has(o.id))

  return (
    <figure className="branch-diagram" aria-label="Decision branches">
      <figcaption className="branch-caption">
        Branch replay — original options at commit
      </figcaption>
      <div className="branch-root">
        <div className="branch-node decision-node">
          <span className="branch-label">Decision point</span>
          <strong>{snap?.title ?? decision.title}</strong>
          <span className="branch-meta">
            {snap
              ? `Known Then · ${snap.committedAt.slice(0, 10)}`
              : 'Not yet committed — showing draft options'}
          </span>
        </div>
        <div className="branch-stem" aria-hidden="true" />
        <ul className="branch-options">
          {originalOptions.map((option) => {
            const chosen = option.id === selectedId
            const note = decision.review?.counterfactualNotes.find(
              (n) => n.optionId === option.id,
            )?.note
            return (
              <li
                key={option.id}
                className={chosen ? 'branch-option chosen' : 'branch-option'}
              >
                <div className="branch-node option-node">
                  <span className="branch-label">
                    {chosen ? 'Chosen branch' : 'Available then — not chosen'}
                  </span>
                  <strong>{option.title}</strong>
                  <span className="branch-meta">
                    Est. success {option.estimatedProbability}%
                  </span>
                </div>
                {chosen ? (
                  <div className="branch-reality">
                    <span className="branch-label">Later reality</span>
                    <p>
                      {decision.review?.whatHappened ??
                        'Outcome not yet recorded.'}
                    </p>
                  </div>
                ) : (
                  <div className="branch-counterfactual">
                    <p>
                      <strong>Counterfactual — unknowable</strong>
                    </p>
                    <p>
                      BranchBack does not claim what would have happened on this
                      path.
                      {note ? (
                        <>
                          {' '}
                          <em>Personal speculation:</em> {note}
                        </>
                      ) : null}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {laterOnly.length ? (
        <aside className="branch-later" aria-label="Later working options">
          <h3>Added after commit</h3>
          <p className="muted">
            These options exist only in later working state. They were not part
            of Known Then and are not historical branches.
          </p>
          <ul>
            {laterOnly.map((o) => (
              <li key={o.id}>
                <strong>{o.title}</strong>
                <span className="muted"> — later working change</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      {snap && decision.revisions.length ? (
        <p className="muted branch-revision-note">
          {decision.revisions.length} later revision
          {decision.revisions.length === 1 ? '' : 's'} recorded — they do not
          rewrite this tree.
        </p>
      ) : null}
    </figure>
  )
}
