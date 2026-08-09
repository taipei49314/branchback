import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addAssumption,
  addOption,
  addPrediction,
  commitDecision,
  createDecision,
  recordReview,
  reviseAfterCommit,
  updateDraftFields,
} from '@/domain/decision'
import {
  bindAssumptionStatus,
  bindPredictionEvaluation,
} from '@/domain/bindEvaluation'
import {
  canonicalJson,
  extractRevisionTrackedState,
  snapshotsEqual,
} from '@/domain'
import { DecisionRepository } from '@/storage/repository'
import { resetStorageForTests } from '@/storage/testing'
import * as storagePublic from '@/storage/index'
import type { Decision } from '@/domain/types'

function draftCommitted(title = 'Integrity fixture'): Decision {
  let d = createDecision({ title })
  d = addOption(d, {
    title: 'Alpha',
    description: 'A',
    perceivedUpside: 'u',
    perceivedDownside: 'd',
    estimatedProbability: 60,
    reasonsForChoosing: ['r'],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Beta',
    description: 'B',
    perceivedUpside: 'u',
    perceivedDownside: 'd',
    estimatedProbability: 40,
    reasonsForChoosing: [],
    reasonsForRejecting: ['x'],
  })
  d = addAssumption(d, {
    statement: 'Demand continues',
    confidence: 70,
    importance: 4,
    falsificationCondition: 'Demand falls',
  })
  d = addPrediction(d, {
    statement: 'Ten users in 14 days',
    expectedResult: '10 users',
    expectedDate: '2099-01-01',
    confidence: 75,
    evaluationCriteria: 'count',
  })
  return commitDecision(d, {
    selectedOptionId: d.options[0]!.id,
    decisionDate: '2026-01-10',
    reviewDate: '2099-06-01',
  })
}

describe('persistence integrity boundary', () => {
  let repo: DecisionRepository

  beforeEach(async () => {
    await resetStorageForTests()
    repo = new DecisionRepository()
  })

  afterEach(async () => {
    await resetStorageForTests()
  })

  it('public storage API exposes repository authority only', () => {
    expect(Object.keys(storagePublic).sort()).toEqual(
      ['DecisionRepository', 'DomainError', 'repository'].sort(),
    )
  })

  it('commit → persist → reload preserves snapshot', async () => {
    const committed = draftCommitted()
    await repo.save(committed)
    const reloaded = await repo.get(committed.id)
    expect(snapshotsEqual(reloaded!.commitSnapshot, committed.commitSnapshot)).toBe(
      true,
    )
  })

  it('REJECT: post-commit title change without revision', async () => {
    const d = draftCommitted()
    await repo.save(d)
    const mutated = { ...d, title: 'Silent rewrite', updatedAt: new Date().toISOString() }
    await expect(repo.save(mutated)).rejects.toMatchObject({
      code: 'REVISION_REQUIRED',
    })
  })

  it('REJECT: post-commit context/options/assumptions/predictions without revision', async () => {
    const d = draftCommitted()
    await repo.save(d)

    await expect(
      repo.save({
        ...d,
        context: { ...d.context, situation: 'changed' },
      }),
    ).rejects.toMatchObject({ code: 'REVISION_REQUIRED' })

    await expect(
      repo.save({
        ...d,
        options: d.options.map((o, i) =>
          i === 0 ? { ...o, title: 'Renamed' } : o,
        ),
      }),
    ).rejects.toMatchObject({ code: 'REVISION_REQUIRED' })

    await expect(
      repo.save({
        ...d,
        assumptions: d.assumptions.map((a, i) =>
          i === 0 ? { ...a, statement: 'Changed assumption' } : a,
        ),
      }),
    ).rejects.toMatchObject({ code: 'REVISION_REQUIRED' })

    await expect(
      repo.save({
        ...d,
        predictions: d.predictions.map((p, i) =>
          i === 0 ? { ...p, confidence: 10 } : p,
        ),
      }),
    ).rejects.toMatchObject({ code: 'REVISION_REQUIRED' })
  })

  it('REJECT: fabricated revision that does not match prior state', async () => {
    const d = draftCommitted()
    await repo.save(d)
    const fabricated = {
      ...d,
      title: 'New title',
      revisions: [
        {
          revisionId: 'rev_fake',
          revisionNumber: 1,
          createdAt: new Date().toISOString(),
          note: 'lies',
          title: 'Wrong prior title',
          description: d.description,
          context: d.context,
          options: d.options,
          assumptions: d.assumptions,
          predictions: d.predictions,
          selectedOptionId: d.selectedOptionId,
          decisionDate: d.decisionDate,
          reviewDate: d.reviewDate,
        },
      ],
      updatedAt: new Date().toISOString(),
    }
    await expect(repo.save(fabricated)).rejects.toMatchObject({
      code: 'REVISION_INAUTHENTIC',
    })
  })

  it('REJECT: multiple newly appended revisions in one write', async () => {
    const d = draftCommitted()
    await repo.save(d)
    const r1 = {
      revisionId: 'rev_1',
      revisionNumber: 1,
      createdAt: new Date().toISOString(),
      note: 'one',
      ...extractRevisionTrackedState(d),
    }
    const r2 = {
      revisionId: 'rev_2',
      revisionNumber: 2,
      createdAt: new Date().toISOString(),
      note: 'two',
      ...extractRevisionTrackedState({ ...d, title: 'mid' }),
    }
    await expect(
      repo.save({
        ...d,
        title: 'final',
        revisions: [r1, r2],
      }),
    ).rejects.toMatchObject({ code: 'REVISION_CHAIN_AMBIGUOUS' })
  })

  it('ACCEPT: legitimate revision-producing mutation; prior state recoverable', async () => {
    let d = draftCommitted()
    await repo.save(d)
    const prior = extractRevisionTrackedState(d)
    d = reviseAfterCommit(d, {
      title: 'After clarification',
      note: 'clarified',
    })
    await repo.save(d)
    const reloaded = await repo.get(d.id)
    expect(reloaded!.title).toBe('After clarification')
    expect(reloaded!.revisions).toHaveLength(1)
    expect(canonicalJson(extractRevisionTrackedState(reloaded!.revisions[0]!))).toBe(
      canonicalJson(prior),
    )
    expect(snapshotsEqual(reloaded!.commitSnapshot, d.commitSnapshot)).toBe(true)
  })

  it('rejects adversarial mutation of persisted revision history', async () => {
    let d = draftCommitted()
    d = reviseAfterCommit(d, { description: 'first note', note: 'r1' })
    await repo.save(d)
    d = reviseAfterCommit(d, { description: 'second note', note: 'r2' })
    await repo.save(d)
    const persisted = (await repo.get(d.id))!

    await expect(
      repo.save({
        ...persisted,
        revisions: [
          { ...persisted.revisions[0]!, note: 'SILENTLY CHANGED' },
          persisted.revisions[1]!,
        ],
      }),
    ).rejects.toMatchObject({ code: 'REVISION_HISTORY_TAMPER' })
  })

  it('stale concurrent writer cannot clobber append-only authentic history', async () => {
    let d = draftCommitted()
    await repo.save(d)
    const base = (await repo.get(d.id))!
    const writerA = reviseAfterCommit(base, { title: 'Writer A', note: 'from A' })
    const writerB = reviseAfterCommit(base, { title: 'Writer B', note: 'from B' })
    await repo.save(writerA)
    await expect(repo.save(writerB)).rejects.toMatchObject({
      code: 'REVISION_HISTORY_TAMPER',
    })
  })

  it('replace import refuses omission of committed decision', async () => {
    const a = draftCommitted('Keep me')
    const b = draftCommitted('Do not omit me')
    await repo.save(a)
    await repo.save(b)
    await expect(
      repo.importAll(
        {
          schemaVersion: 2,
          exportedAt: new Date().toISOString(),
          decisions: [a],
        },
        'replace',
      ),
    ).rejects.toMatchObject({ code: 'REPLACE_OMITS_HISTORY' })
  })

  it('review mutation leaves authentic prior working state in revisions', async () => {
    let d = draftCommitted()
    await repo.save(d)
    const prior = extractRevisionTrackedState(d)
    d = recordReview(d, {
      whatHappened: 'Outcome landed',
      unexpected: '',
      missingInformation: '',
      outcomeRating: 2,
      decisionQualityRating: 4,
      rememberedBelief: null,
      memoryDriftNotes: null,
      assumptionStatuses: [
        bindAssumptionStatus(d.assumptions[0]!, 'FAILED'),
      ],
      predictionEvaluations: [
        bindPredictionEvaluation(d.predictions[0]!, 'INCORRECT'),
      ],
      counterfactualNotes: [],
    })
    await repo.save(d)
    const reloaded = await repo.get(d.id)
    expect(reloaded!.assumptions[0]!.status).toBe('FAILED')
    expect(reloaded!.revisions).toHaveLength(1)
    expect(
      canonicalJson(extractRevisionTrackedState(reloaded!.revisions[0]!)),
    ).toBe(canonicalJson(prior))
  })

  it('export/import preserves snapshot and revision authenticity chain', async () => {
    let d = draftCommitted()
    d = updateDraftFields(d, {
      description: 'Added after commit',
      note: 'post-commit note',
    })
    await repo.save(d)
    const snapBefore = canonicalJson(d.commitSnapshot)
    const revsBefore = canonicalJson(d.revisions)
    const exported = await repo.exportAll()
    await repo.clearAll({ confirmEraseExistingHistory: true })
    await repo.importAll(exported, 'merge')
    const roundTrip = await repo.get(d.id)
    expect(canonicalJson(roundTrip!.commitSnapshot)).toBe(snapBefore)
    expect(canonicalJson(roundTrip!.revisions)).toBe(revsBefore)
  })

  it('rejects unknown future schema versions on import', async () => {
    await expect(
      repo.importAll(
        {
          schemaVersion: 99,
          exportedAt: '2026-01-01T00:00:00.000Z',
          decisions: [],
        },
        'merge',
      ),
    ).rejects.toThrow(/UNSUPPORTED_SCHEMA/)
  })
})
