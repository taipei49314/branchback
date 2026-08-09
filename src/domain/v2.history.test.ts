import { describe, expect, it } from 'vitest'
import {
  addAssumption,
  addDecisionRelation,
  addEvidenceRef,
  addOption,
  assignAssumptionFamily,
  commitDecision,
  createDecision,
  reviseAfterCommit,
} from '@/domain/decision'
import { summarizeAssumptionFamilies } from '@/domain/assumptionFamilies'
import { buildDecisionDossierMarkdown } from '@/domain/dossier'
import { buildHistoryExplorer } from '@/domain/historyExplorer'
import { searchDecisionHistory } from '@/domain/historySearch'
import { buildLearningSurfaces } from '@/domain/learningSurfaces'
import { migrateDecision } from '@/domain/migrate'
import { assessBackupHealth } from '@/domain/backupHealth'
import { generateSyntheticLibrary } from '@/domain/syntheticScale'
import { SCHEMA_VERSION } from '@/domain/types'
import { assertSupportedExportSchema } from '@/domain/schema'

describe('v2 accumulated-history contracts', () => {
  it('migrates schema-3 shaped decisions into schema-4 defaults', () => {
    const legacy = {
      id: 'dec_legacy',
      title: 'Legacy',
      description: '',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      decisionDate: null,
      reviewDate: null,
      status: 'OPEN',
      context: {
        situation: 's',
        constraints: '',
        stakes: '',
        deadline: null,
        peopleInvolved: [],
        tags: [],
      },
      options: [],
      assumptions: [
        {
          id: 'asm1',
          statement: 'Old assumption',
          confidence: 60,
          importance: 3,
          falsificationCondition: '',
          status: 'UNKNOWN',
        },
      ],
      predictions: [],
      selectedOptionId: null,
      commitSnapshot: null,
      revisions: [],
      review: null,
      priorReviews: [],
    }
    const migrated = migrateDecision(legacy)
    expect(migrated.protocolId).toBe('general')
    expect(migrated.relations).toEqual([])
    expect(migrated.evidence).toEqual([])
    expect(migrated.assumptions[0]!.familyId).toBeNull()
    expect(migrated.assumptions[0]!.familyLabel).toBeNull()
  })

  it('rejects unknown future schema versions (fail closed)', () => {
    expect(() => assertSupportedExportSchema(99)).toThrow(/UNSUPPORTED_SCHEMA/)
    const health = assessBackupHealth({
      schemaVersion: 99,
      exportedAt: '2026-01-01T00:00:00.000Z',
      decisions: [],
    })
    expect(health.ok).toBe(false)
    expect(health.issues[0]).toMatch(/UNSUPPORTED_SCHEMA/)
  })

  it('records lineage with temporal createdAt without mutating target', () => {
    let a = createDecision({ title: 'Career move' })
    let b = createDecision({ title: 'Relocation' })
    a = addOption(a, {
      title: 'Stay',
      description: '',
      perceivedUpside: '',
      perceivedDownside: '',
      estimatedProbability: 50,
      reasonsForChoosing: [],
      reasonsForRejecting: [],
    })
    a = addOption(a, {
      title: 'Leave',
      description: '',
      perceivedUpside: '',
      perceivedDownside: '',
      estimatedProbability: 50,
      reasonsForChoosing: [],
      reasonsForRejecting: [],
    })
    b = addDecisionRelation(b, {
      targetDecisionId: a.id,
      kind: 'follows-from',
      note: 'Relocation follows career choice',
    })
    expect(b.relations).toHaveLength(1)
    expect(b.relations[0]!.createdAt).toBeTruthy()
    expect(a.relations).toHaveLength(0)
  })

  it('never silently merges assumption families; only user-confirmed links', () => {
    let d1 = createDecision({ title: 'D1' })
    let d2 = createDecision({ title: 'D2' })
    d1 = addAssumption(d1, {
      statement: 'We can hire in 30 days',
      confidence: 80,
      importance: 4,
      falsificationCondition: 'No hire by day 30',
    })
    d2 = addAssumption(d2, {
      statement: 'We can hire in thirty days',
      confidence: 70,
      importance: 4,
      falsificationCondition: 'No hire by day 30',
    })
    expect(summarizeAssumptionFamilies([d1, d2])).toHaveLength(0)
    d1 = assignAssumptionFamily(d1, d1.assumptions[0]!.id, {
      familyId: 'fam_hiring',
      familyLabel: 'Hiring timeline optimism',
    })
    d2 = assignAssumptionFamily(d2, d2.assumptions[0]!.id, {
      familyId: 'fam_hiring',
      familyLabel: 'Hiring timeline optimism',
    })
    const families = summarizeAssumptionFamilies([d1, d2])
    expect(families).toHaveLength(1)
    expect(families[0]!.memberCount).toBe(2)
    expect(families[0]!.distinctFingerprints).toBe(2)
  })

  it('dossier and history search preserve temporal provenance labels', () => {
    let d = createDecision({ title: 'Alpha' })
    d = addOption(d, {
      title: 'Yes',
      description: 'go',
      perceivedUpside: '',
      perceivedDownside: '',
      estimatedProbability: 55,
      reasonsForChoosing: [],
      reasonsForRejecting: [],
    })
    d = addOption(d, {
      title: 'No',
      description: 'stop',
      perceivedUpside: '',
      perceivedDownside: '',
      estimatedProbability: 45,
      reasonsForChoosing: [],
      reasonsForRejecting: [],
    })
    d = addAssumption(d, {
      statement: 'Market stays calm',
      confidence: 60,
      importance: 3,
      falsificationCondition: 'Volatility spike',
    })
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2024-06-01',
      reviewDate: '2024-09-01',
    })
    d = reviseAfterCommit(d, {
      note: 'Added aftershock concern',
      description: 'Updated after commit',
    })
    d = addEvidenceRef(d, {
      kind: 'note',
      label: 'Memo',
      body: 'Available then memo',
      availableAt: 'then',
    })

    const md = buildDecisionDossierMarkdown(d)
    expect(md).toContain('Known Then')
    expect(md).toContain('Working copy')
    expect(md).toMatch(/Later knowledge is never rewritten/i)

    const hits = searchDecisionHistory([d], 'aftershock')
    expect(hits.some((h) => /Revision/i.test(h.provenanceLabel))).toBe(true)
    expect(
      hits.every((h) => !/Known Then — assumption at commit/.test(h.provenanceLabel) || !h.excerpt.includes('aftershock')),
    ).toBe(true)

    const explorer = buildHistoryExplorer(d)
    expect(explorer.some((e) => e.kind === 'commit')).toBe(true)
    expect(explorer.some((e) => e.kind === 'revision')).toBe(true)
  })

  it('synthetic scale library generates and supports learning surfaces', () => {
    const lib = generateSyntheticLibrary(100)
    expect(lib).toHaveLength(100)
    const learning = buildLearningSurfaces(lib)
    expect(learning.sampleSizes.decisions).toBe(100)
    expect(learning.sampleSizes.committed).toBeGreaterThan(50)
    expect(learning.revisionIntensity.maxRevisions).toBeGreaterThanOrEqual(0)
  })

  it('declares SCHEMA_VERSION 5', () => {
    expect(SCHEMA_VERSION).toBe(5)
  })
})
