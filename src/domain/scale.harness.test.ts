import { describe, expect, it } from 'vitest'
import { generateSyntheticLibrary } from '@/domain/syntheticScale'
import { buildLearningSurfaces } from '@/domain/learningSurfaces'
import { searchDecisionHistory } from '@/domain/historySearch'
import { analyzeAssumptions } from '@/domain/assumptionAnalytics'

/**
 * Scale harness — methodology:
 * generateSyntheticLibrary(N) is deterministic (no RNG).
 * Release gate: N=100 always; N=500 always (GitHub release closure).
 * N=1000: SCALE_HEAVY=1 npm test
 */
describe('scale harness', () => {
  it('handles 100 decisions within a modest budget', () => {
    const t0 = performance.now()
    const lib = generateSyntheticLibrary(100)
    const t1 = performance.now()
    const learning = buildLearningSurfaces(lib)
    const t2 = performance.now()
    const hits = searchDecisionHistory(lib, 'assumption')
    analyzeAssumptions(lib)
    const t3 = performance.now()

    expect(lib).toHaveLength(100)
    expect(learning.sampleSizes.decisions).toBe(100)
    expect(hits.length).toBeGreaterThan(0)
    expect(t3 - t0).toBeLessThan(15_000)
    // Evidence for VERIFICATION.md — durations vary by machine.
    expect({
      generateMs: Math.round(t1 - t0),
      learningMs: Math.round(t2 - t1),
      searchAndAnalyticsMs: Math.round(t3 - t2),
      totalMs: Math.round(t3 - t0),
    }).toBeTruthy()
  })

  it('handles 500 decisions (release gate)', () => {
    const t0 = performance.now()
    const lib = generateSyntheticLibrary(500)
    const learning = buildLearningSurfaces(lib)
    searchDecisionHistory(lib, 'Synthetic')
    const elapsed = performance.now() - t0
    expect(lib).toHaveLength(500)
    expect(learning.sampleSizes.decisions).toBe(500)
    expect(elapsed).toBeLessThan(90_000)
  }, 120_000)

  it.runIf(process.env.SCALE_HEAVY === '1')(
    'generates 1000 decisions when SCALE_HEAVY=1',
    () => {
      const t0 = performance.now()
      const lib = generateSyntheticLibrary(1000)
      const elapsed = performance.now() - t0
      expect(lib).toHaveLength(1000)
      expect(elapsed).toBeLessThan(120_000)
    },
    180_000,
  )
})
