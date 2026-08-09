import type { Decision, ReviewRecord } from './types'
import {
  listHistoricalAssumptionTargets,
  listHistoricalPredictionTargets,
} from './historicalIdentity'
import { buildHistorySequence } from './revisionDiff'
import { RELATION_KIND_LABELS } from './lineage'
import { describeEvidenceProvenance } from './v2History'

function reviewBlock(title: string, r: ReviewRecord): string[] {
  const lines: string[] = []
  lines.push(`### ${title}`)
  lines.push(`- Reviewed at: ${r.reviewedAt}`)
  lines.push(`- Outcome quality: ${r.outcomeRating}/5`)
  lines.push(
    `- Decision quality (reasonableness given Known Then): ${r.decisionQualityRating}/5`,
  )
  lines.push(`- What happened: ${r.whatHappened || '—'}`)
  lines.push(`- Unexpected: ${r.unexpected || '—'}`)
  lines.push(`- Missing information: ${r.missingInformation || '—'}`)
  if (r.rememberedBelief) {
    lines.push(`- Remembered belief (hindsight probe): ${r.rememberedBelief}`)
  }
  if (r.memoryDriftNotes) {
    lines.push(`- Memory drift notes: ${r.memoryDriftNotes}`)
  }
  if (r.assumptionStatuses.length) {
    lines.push('- Assumption evaluations (fingerprint-bound):')
    for (const a of r.assumptionStatuses) {
      lines.push(
        `  - ${a.assumptionId} · ${a.status}${a.fingerprint ? ` · fp ${a.fingerprint.slice(0, 12)}…` : ''}${a.provenance ? ` · ${a.provenance}` : ''}`,
      )
    }
  }
  if (r.predictionEvaluations.length) {
    lines.push('- Prediction evaluations (fingerprint-bound):')
    for (const p of r.predictionEvaluations) {
      lines.push(
        `  - ${p.predictionId} · ${p.evaluation}${p.fingerprint ? ` · fp ${p.fingerprint.slice(0, 12)}…` : ''}${p.provenance ? ` · ${p.provenance}` : ''}`,
      )
    }
  }
  lines.push('')
  return lines
}

/**
 * Decision Dossier — deterministic, privacy-preserving export.
 * Preserves temporal layers; does not present later text as Known Then.
 */
export function buildDecisionDossierMarkdown(decision: Decision): string {
  const lines: string[] = []
  lines.push(`# Decision Dossier: ${decision.title}`)
  lines.push('')
  lines.push(
    '_BranchBack export. Layers below are historically ordered. Later knowledge is never rewritten into Known Then._',
  )
  lines.push('')
  lines.push('## Summary')
  lines.push(`- Status: **${decision.status}**`)
  lines.push(`- Protocol: ${decision.protocolId}`)
  lines.push(`- Created: ${decision.createdAt}`)
  lines.push(`- Updated: ${decision.updatedAt}`)
  if (decision.decisionDate) lines.push(`- Decision day: ${decision.decisionDate}`)
  if (decision.reviewDate) lines.push(`- Planned review day: ${decision.reviewDate}`)
  lines.push(`- Revisions: ${decision.revisions.length}`)
  lines.push(
    `- Reviews: ${decision.priorReviews.length + (decision.review ? 1 : 0)}`,
  )
  lines.push('')

  if (decision.description) {
    lines.push('## Working description')
    lines.push(decision.description)
    lines.push('')
    lines.push(
      '_Working description may include later edits. Prefer Known Then for commit-time belief._',
    )
    lines.push('')
  }

  const snap = decision.commitSnapshot
  if (!snap) {
    lines.push('## Known Then (immutable commit)')
    lines.push('_Not yet committed — no immutable Known Then layer._')
    lines.push('')
  } else {
    lines.push('## Immutable commit snapshot (what was believed then)')
    lines.push(`- Snapshot: \`${snap.snapshotId}\``)
    lines.push(`- Committed at: ${snap.committedAt}`)
    lines.push(`- Decision day: ${snap.decisionDate}`)
    lines.push(`- Planned review day: ${snap.reviewDate}`)
    lines.push(`- Title then: ${snap.title}`)
    lines.push('')
    lines.push('### Situation then')
    lines.push(snap.context.situation || '_Empty_')
    lines.push('')
    lines.push(`- Constraints: ${snap.context.constraints || '—'}`)
    lines.push(`- Stakes: ${snap.context.stakes || '—'}`)
    lines.push(`- Deadline: ${snap.context.deadline || '—'}`)
    lines.push(
      `- People: ${snap.context.peopleInvolved.join(', ') || '—'}`,
    )
    lines.push(`- Tags: ${snap.context.tags.join(', ') || '—'}`)
    lines.push('')
    lines.push('### Options then')
    for (const o of snap.options) {
      const chosen = o.id === snap.selectedOptionId ? ' **(chosen)**' : ''
      lines.push(`#### ${o.title}${chosen}`)
      lines.push(o.description || '')
      lines.push(`- Upside: ${o.perceivedUpside || '—'}`)
      lines.push(`- Downside: ${o.perceivedDownside || '—'}`)
      lines.push(`- Estimated success then: ${o.estimatedProbability}%`)
      lines.push('')
    }
    lines.push('### Assumptions then')
    for (const a of snap.assumptions) {
      lines.push(
        `- **${a.statement}** — confidence ${a.confidence}%, importance ${a.importance}`,
      )
      if (a.familyLabel) lines.push(`  - Family (user-confirmed): ${a.familyLabel}`)
      if (a.falsificationCondition) {
        lines.push(`  - Falsified if: ${a.falsificationCondition}`)
      }
    }
    if (!snap.assumptions.length) lines.push('_None_')
    lines.push('')
    lines.push('### Predictions then')
    for (const p of snap.predictions) {
      lines.push(
        `- **${p.statement}** — expect “${p.expectedResult}” by ${p.expectedDate} (${p.confidence}%)`,
      )
    }
    if (!snap.predictions.length) lines.push('_None_')
    lines.push('')
  }

  lines.push('## Working copy (may include later edits)')
  lines.push(`- Title: ${decision.title}`)
  lines.push(decision.context.situation || '_Empty situation_')
  lines.push('')
  lines.push('### Options (working)')
  for (const o of decision.options) {
    const chosen =
      decision.selectedOptionId === o.id ? ' **(selected)**' : ''
    lines.push(`- ${o.title}${chosen} — ${o.estimatedProbability}%`)
  }
  lines.push('')
  lines.push('### Assumptions (working)')
  for (const a of decision.assumptions) {
    lines.push(
      `- **${a.statement}** — ${a.status}, confidence ${a.confidence}%${a.familyLabel ? ` · family “${a.familyLabel}”` : ''}`,
    )
  }
  if (!decision.assumptions.length) lines.push('_None_')
  lines.push('')
  lines.push('### Predictions (working)')
  for (const p of decision.predictions) {
    lines.push(
      `- **${p.statement}** — ${p.evaluation ?? 'unevaluated'} (${p.confidence}%)`,
    )
  }
  if (!decision.predictions.length) lines.push('_None_')
  lines.push('')

  if (decision.evidence.length) {
    lines.push('## Evidence / references')
    lines.push(
      '_References are not proofs. Claimed availability is a user assertion; recorded-at is when BranchBack accepted the record._',
    )
    for (const e of decision.evidence) {
      const prov = describeEvidenceProvenance(decision, e)
      const tomb = e.removedAt ? ` · removed ${e.removedAt.slice(0, 10)}` : ''
      lines.push(
        `- **${e.kind}: ${e.label}**${e.url ? ` — ${e.url}` : ''}${tomb}`,
      )
      if (e.body) lines.push(`  - ${e.body}`)
      lines.push(`  - ${prov.summary}`)
    }
    lines.push('')
  }

  if (decision.relations.length) {
    lines.push('## Lineage (outbound)')
    for (const r of decision.relations) {
      const tomb = r.removedAt
        ? ` · removed ${r.removedAt.slice(0, 10)} (tombstone retained)`
        : ''
      lines.push(
        `- ${RELATION_KIND_LABELS[r.kind]} → \`${r.targetDecisionId}\`${r.note ? ` — ${r.note}` : ''} (recorded ${r.createdAt})${tomb}`,
      )
    }
    lines.push('')
  }

  lines.push('## Historical proposition registry')
  const assumptions = listHistoricalAssumptionTargets(decision)
  const predictions = listHistoricalPredictionTargets(decision)
  lines.push('### Assumptions across history')
  for (const t of assumptions) {
    lines.push(
      `- ${t.proposition.statement} · ${t.provenance} · fp \`${t.fingerprint.slice(0, 12)}…\``,
    )
  }
  if (!assumptions.length) lines.push('_None_')
  lines.push('')
  lines.push('### Predictions across history')
  for (const t of predictions) {
    lines.push(
      `- ${t.proposition.statement} · ${t.provenance} · fp \`${t.fingerprint.slice(0, 12)}…\``,
    )
  }
  if (!predictions.length) lines.push('_None_')
  lines.push('')

  lines.push('## Timeline')
  for (const step of buildHistorySequence(decision)) {
    lines.push(`- **${step.label}** @ ${step.at} — ${step.detail}`)
    if (step.changes?.length) {
      for (const c of step.changes.slice(0, 12)) {
        lines.push(`  - ${c.label}: ${c.before} → ${c.after}`)
      }
    }
  }
  lines.push('')

  if (decision.priorReviews.length) {
    lines.push('## Prior reviews (retained history)')
    for (let i = 0; i < decision.priorReviews.length; i++) {
      lines.push(
        ...reviewBlock(`Prior review ${i + 1}`, decision.priorReviews[i]!),
      )
    }
  }

  if (decision.review) {
    lines.push('## Latest review')
    lines.push(...reviewBlock('Current review', decision.review))
  }

  lines.push('---')
  lines.push('_End of dossier. Generated deterministically by BranchBack._')
  lines.push('')
  return lines.join('\n')
}

/** Alias used by existing export button. */
export function decisionToMarkdown(decision: Decision): string {
  return buildDecisionDossierMarkdown(decision)
}
