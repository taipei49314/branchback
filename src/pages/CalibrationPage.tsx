import { useDecisionStore } from '@/application/useDecisionStore'
import {
  computeCalibration,
  formatCalibrationSummary,
} from '@/domain/calibration'

export function CalibrationPage() {
  const { decisions } = useDecisionStore()
  const buckets = computeCalibration(decisions)
  const totalN = buckets.reduce((s, b) => s + b.sampleSize, 0)

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Statistics</p>
        <h1>Calibration</h1>
        <p className="lede">
          Confidence of each historical proposition versus fingerprint-matched
          review evaluations (latest match across review history wins). Evaluating
          a later revised statement scores that statement&apos;s confidence — not
          the original commit claim.
        </p>
      </header>

      <p className="muted">
        Evaluated commit propositions: n={totalN}
        {buckets[0]?.skippedAmbiguous
          ? ` · ${buckets[0].skippedAmbiguous} later-version evaluation(s) excluded as ambiguous`
          : ''}
      </p>

      <div className="cal-grid" role="list">
        {buckets.map((b) => {
          const height =
            b.observedRate === null
              ? 4
              : Math.max(8, Math.round(b.observedRate * 100))
          const cautious =
            b.sampleSize < 5
              ? 'Too little data for a stable conclusion.'
              : b.caveat
          return (
            <article key={b.bucket} className="cal-card" role="listitem">
              <h2>{b.bucket}% stated</h2>
              <div
                className="cal-bar"
                style={{ height: `${height}px` }}
                aria-hidden="true"
              />
              <p>
                Observed:{' '}
                {b.observedRate === null
                  ? '—'
                  : `${Math.round(b.observedRate * 100)}%`}
              </p>
              <p>
                <strong>n={b.sampleSize}</strong>
              </p>
              <p className="cal-text-alt">
                {formatCalibrationSummary(b)} {cautious}
              </p>
            </article>
          )
        })}
      </div>

      <section className="panel" aria-label="Text alternative for calibration">
        <h2>Text summary</h2>
        <ul>
          {buckets.map((b) => (
            <li key={b.bucket}>{formatCalibrationSummary(b)}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
