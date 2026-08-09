import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  addDecisionRelation,
  addEvidenceRef,
  addOption,
  commitDecision,
  createDecision,
  removeDecisionRelation,
  removeEvidenceRef,
} from '@/domain/decision'
import {
  assertEvidenceHistoryIntegrity,
  assertHistoricalWriteIntegrity,
  assertRelationHistoryIntegrity,
  describeEvidenceProvenance,
} from '@/domain/integrity'
import { DomainError } from '@/domain/errors'
import { DecisionRepository } from '@/storage/repository'
import { resetStorageForTests } from '@/storage/testing'
import { buildDecisionDossierMarkdown } from '@/domain/dossier'
import { buildHistoryExplorer } from '@/domain/historyExplorer'
import { assessBackupHealth } from '@/domain/backupHealth'

function withTwoOptions(title: string) {
  let d = createDecision({ title })
  d = addOption(d, {
    title: 'A',
    description: '',
    perceivedUpside: '',
    perceivedDownside: '',
    estimatedProbability: 50,
    reasonsForChoosing: [],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'B',
    description: '',
    perceivedUpside: '',
    perceivedDownside: '',
    estimatedProbability: 50,
    reasonsForChoosing: [],
    reasonsForRejecting: [],
  })
  return d
}

describe('v2 relation/evidence historical integrity', () => {
  it('tombstones relations instead of erasing them', async () => {
    await resetStorageForTests()
    const repo = new DecisionRepository()
    let a = withTwoOptions('Source')
    let b = withTwoOptions('Target')
    await repo.save(a)
    await repo.save(b)
    a = addDecisionRelation(a, {
      targetDecisionId: b.id,
      kind: 'follows-from',
      note: 'linked',
    })
    await repo.save(a)
    const relId = a.relations[0]!.id
    a = removeDecisionRelation(a, relId)
    await repo.save(a)
    const reloaded = await repo.get(a.id)
    expect(reloaded!.relations).toHaveLength(1)
    expect(reloaded!.relations[0]!.removedAt).toBeTruthy()
    expect(reloaded!.relations[0]!.createdAt).toBeTruthy()
  })

  it('tombstones evidence and keeps provenance', async () => {
    await resetStorageForTests()
    const repo = new DecisionRepository()
    let d = withTwoOptions('Evidence host')
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2024-01-01',
      reviewDate: '2024-06-01',
    })
    await repo.save(d)
    d = addEvidenceRef(d, {
      kind: 'note',
      label: 'Prior memo',
      body: 'Existed at decision time',
      availableAt: 'then',
    })
    await repo.save(d)
    const evId = d.evidence[0]!.id
    const prov = describeEvidenceProvenance(d, d.evidence[0]!)
    expect(prov.summary).toMatch(/Claimed available then|Recorded later/i)
    d = removeEvidenceRef(d, evId)
    await repo.save(d)
    const reloaded = await repo.get(d.id)
    expect(reloaded!.evidence).toHaveLength(1)
    expect(reloaded!.evidence[0]!.removedAt).toBeTruthy()
    expect(reloaded!.evidence[0]!.availableAt).toBe('then')
  })

  it('rejects silent erase of relations', () => {
    let d = withTwoOptions('Host')
    const other = withTwoOptions('Other')
    d = addDecisionRelation(d, {
      targetDecisionId: other.id,
      kind: 'related-to',
    })
    const erased = { ...d, relations: [] }
    expect(() => assertRelationHistoryIntegrity(d, erased)).toThrow(DomainError)
    expect(() => assertHistoricalWriteIntegrity(d, erased)).toThrow(
      /silently erased/,
    )
  })

  it('rejects in-place rewrite of evidence provenance', () => {
    let d = withTwoOptions('Host')
    d = addEvidenceRef(d, {
      kind: 'url',
      label: 'Doc',
      body: '',
      url: 'https://example.com',
      availableAt: 'later',
    })
    const rewritten = {
      ...d,
      evidence: [
        {
          ...d.evidence[0]!,
          availableAt: 'then' as const,
          recordedAt: '2000-01-01T00:00:00.000Z',
        },
      ],
    }
    expect(() => assertEvidenceHistoryIntegrity(d, rewritten)).toThrow(
      DomainError,
    )
  })

  it('stale writer cannot drop a newly added relation', async () => {
    await resetStorageForTests()
    const repo = new DecisionRepository()
    let d = withTwoOptions('Stale')
    const other = withTwoOptions('Peer')
    await repo.save(other)
    await repo.save(d)
    const stale = structuredClone(d)
    d = addDecisionRelation(d, {
      targetDecisionId: other.id,
      kind: 'depends-on',
    })
    await repo.save(d)
    await expect(repo.save(stale)).rejects.toThrow(/silently erased/)
  })

  it('dossier and explorer retain tombstoned history', () => {
    let d = withTwoOptions('Dossier')
    const other = withTwoOptions('Peer')
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2024-01-01',
      reviewDate: '2024-06-01',
    })
    d = addDecisionRelation(d, {
      targetDecisionId: other.id,
      kind: 'revisits',
      note: 'loop',
    })
    d = addEvidenceRef(d, {
      kind: 'quote',
      label: 'Quote',
      body: 'said then',
      availableAt: 'then',
    })
    d = removeDecisionRelation(d, d.relations[0]!.id)
    d = removeEvidenceRef(d, d.evidence[0]!.id)
    const md = buildDecisionDossierMarkdown(d)
    expect(md).toMatch(/tombstone|removed/i)
    expect(md).toMatch(/Claimed available then|recorded/i)
    const explorer = buildHistoryExplorer(d)
    expect(explorer.some((e) => e.kind === 'relation')).toBe(true)
    expect(explorer.some((e) => e.kind === 'evidence')).toBe(true)
    expect(explorer.some((e) => /removed/i.test(e.label))).toBe(true)
  })

  it('backup health marks invalid backups as not importable', () => {
    const bad = assessBackupHealth({
      schemaVersion: 5,
      exportedAt: '2026-01-01T00:00:00.000Z',
      decisions: [{ id: 'x', title: '' }],
    })
    expect(bad.importable).toBe(false)
    expect(bad.status === 'invalid' || bad.status === 'unsupported').toBe(true)

    const unsupported = assessBackupHealth({
      schemaVersion: 99,
      exportedAt: '2026-01-01T00:00:00.000Z',
      decisions: [],
    })
    expect(unsupported.status).toBe('unsupported')
    expect(unsupported.importable).toBe(false)
  })
})
