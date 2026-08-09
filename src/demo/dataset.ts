import {
  addAssumption,
  addOption,
  addPrediction,
  commitDecision,
  createDecision,
  recordReview,
  reviseAfterCommit,
  updateAssumption,
  updateDraftFields,
} from '@/domain/decision'
import {
  bindAssumptionStatus,
  bindPredictionEvaluation,
} from '@/domain/bindEvaluation'
import type { Decision } from '@/domain/types'

/**
 * Six realistic decisions across domains that exercise:
 * - successful decision / good reasoning
 * - bad outcome / good reasoning
 * - good outcome / weak reasoning
 * - failed assumptions
 * - inaccurate prediction
 * - memory drift
 */
export function buildDemoDataset(): Decision[] {
  return [
    careerGoodOutcomeGoodReasoning(),
    financeBadOutcomeGoodReasoning(),
    relationshipGoodOutcomeWeakReasoning(),
    purchaseFailedAssumption(),
    projectInaccuratePrediction(),
    travelMemoryDrift(),
  ]
}

function careerGoodOutcomeGoodReasoning(): Decision {
  let d = createDecision({
    title: 'Accept Staff Engineer offer at Atlas Systems',
    description:
      'Choosing between staying IC at current company vs joining Atlas as Staff.',
    context: {
      situation:
        'Atlas offered Staff Eng with 18% cash bump and clearer tech-lead scope. Current role is Senior with stalled leveling.',
      constraints: 'Must decide before equity refresh window closes in 10 days.',
      stakes: 'Career trajectory and family cash flow for 2–3 years.',
      deadline: '2025-03-01',
      peopleInvolved: ['partner', 'current manager', 'Atlas hiring manager'],
      tags: ['career'],
    },
  })
  d = updateDraftFields(d, {
    decisionDate: '2025-02-20',
    reviewDate: '2025-08-20',
  })

  d = addOption(d, {
    title: 'Accept Atlas Staff offer',
    description: 'Join Atlas; lead a platform squad.',
    perceivedUpside: 'Scope, title, compensation, stronger resume signal.',
    perceivedDownside: 'Onboarding risk; unknown politics.',
    estimatedProbability: 70,
    reasonsForChoosing: [
      'Written scope matches stated career goal',
      'Comp closes rent pressure',
    ],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Stay and push for promotion',
    description: 'Remain Senior; negotiate promotion timeline.',
    perceivedUpside: 'Continuity; known team.',
    perceivedDownside: 'Promotion may slip another cycle.',
    estimatedProbability: 45,
    reasonsForChoosing: [],
    reasonsForRejecting: [
      'Manager would not commit to a written timeline',
      'Leveling committee historically slow',
    ],
  })
  d = addOption(d, {
    title: 'Keep interviewing 60 days',
    description: 'Decline Atlas; continue market search.',
    perceivedUpside: 'More options.',
    perceivedDownside: 'Burnout; Atlas offer expires.',
    estimatedProbability: 55,
    reasonsForChoosing: [],
    reasonsForRejecting: ['Family wants decision certainty this quarter'],
  })

  const accept = d.options[0]!
  d = addAssumption(d, {
    statement: 'Atlas platform squad will ship user-facing work within 6 months',
    confidence: 65,
    importance: 4,
    falsificationCondition: 'No production change owned by the squad in 6 months',
  })
  d = addPrediction(d, {
    statement: 'I will still rate the role as “worth it” at 6-month review',
    expectedResult: 'Yes — subjective but recorded',
    expectedDate: '2025-08-20',
    confidence: 70,
    evaluationCriteria: 'Self-rating ≥ 4/5 on role fit at review',
  })

  d = commitDecision(d, {
    selectedOptionId: accept.id,
    decisionDate: '2025-02-20',
    reviewDate: '2025-08-20',
  })

  d = recordReview(d, {
    whatHappened:
      'Joined Atlas. Shipped two platform features; compensation helped. Role fit felt strong.',
    unexpected: 'Manager changed at month 3; still supportive.',
    missingInformation: 'Exact on-call load was understated in recruiting.',
    outcomeRating: 4,
    decisionQualityRating: 4,
    rememberedBelief: null,
    memoryDriftNotes: null,
    assumptionStatuses: [
      bindAssumptionStatus(d.assumptions[0]!, 'HELD'),
    ],
    predictionEvaluations: [
      bindPredictionEvaluation(d.predictions[0]!, 'CORRECT'),
    ],
    counterfactualNotes: [
      {
        optionId: d.options[1]!.id,
        note: 'Counterfactual — unknowable. Partner suspects promotion would still be pending.',
      },
    ],
  })

  return d
}

function financeBadOutcomeGoodReasoning(): Decision {
  let d = createDecision({
    title: 'Refinance mortgage now vs wait 6 months',
    description: 'Rates dipped; closing costs vs expected further drop.',
    context: {
      situation:
        '30-year rate available at 5.9% vs current 6.7%. Break-even on fees ~28 months.',
      constraints: 'Need appraisal; credit score recently recovered.',
      stakes: '≈$180/month difference; fee risk if rates fall further.',
      deadline: '2024-11-15',
      peopleInvolved: ['partner', 'loan officer'],
      tags: ['finance'],
    },
  })

  d = addOption(d, {
    title: 'Refinance immediately',
    description: 'Lock 5.9% now.',
    perceivedUpside: 'Lock savings; reduce payment stress.',
    perceivedDownside: 'If rates fall to mid-5s, regret fees.',
    estimatedProbability: 60,
    reasonsForChoosing: [
      'Cannot reliably time the market',
      'Household cashflow benefit starts immediately',
    ],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Wait six months',
    description: 'Bet on further rate decline.',
    perceivedUpside: 'Possibly better rate.',
    perceivedDownside: 'Rates could rise; delay savings.',
    estimatedProbability: 40,
    reasonsForChoosing: [],
    reasonsForRejecting: ['No edge on macro timing'],
  })

  d = addAssumption(d, {
    statement: 'Federal policy path makes a further 50bp drop unlikely in 6 months',
    confidence: 55,
    importance: 5,
    falsificationCondition: 'Available refinance rate ≤ 5.4% within 6 months',
  })
  d = addPrediction(d, {
    statement: 'In 6 months, available rates will not be more than 40bp better',
    expectedResult: 'Best available ≤40bp below locked rate',
    expectedDate: '2025-05-15',
    confidence: 55,
    evaluationCriteria: 'Compare quoted 30y rate to locked 5.9%',
  })

  d = commitDecision(d, {
    selectedOptionId: d.options[0]!.id,
    decisionDate: '2024-11-10',
    reviewDate: '2025-05-15',
  })

  // Bad outcome, but reasoning was sound given info then
  d = updateAssumption(d, d.assumptions[0]!.id, { status: 'FAILED' })
  d = recordReview(d, {
    whatHappened:
      'Rates fell to 5.35% by April. Refinancing again would cost more fees; payment higher than peers who waited.',
    unexpected: 'Faster disinflation than consensus at decision time.',
    missingInformation: 'No private forecast edge — known unknown.',
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
    counterfactualNotes: [
      {
        optionId: d.options[1]!.id,
        note: 'Counterfactual — unknowable in the product sense; market path happened to favor waiting.',
      },
    ],
  })

  return d
}

function relationshipGoodOutcomeWeakReasoning(): Decision {
  let d = createDecision({
    title: 'Move in together this spring',
    description: 'Lease decision for shared apartment.',
    context: {
      situation: 'Dating 9 months. Lease on both places ends within 6 weeks.',
      constraints: 'Pet deposit; commute limits.',
      stakes: 'Relationship pace and financial entanglement.',
      deadline: '2025-04-01',
      peopleInvolved: ['partner'],
      tags: ['relationships'],
    },
  })

  d = addOption(d, {
    title: 'Sign joint lease',
    description: 'Move in May.',
    perceivedUpside: 'Save rent; more time together.',
    perceivedDownside: 'Harder exit if conflict.',
    estimatedProbability: 80,
    reasonsForChoosing: ['Feels right', 'Friends did it around this timeline'],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Wait one more lease cycle',
    description: 'Keep separate places 12 months.',
    perceivedUpside: 'More evidence of conflict patterns.',
    perceivedDownside: 'Higher combined rent.',
    estimatedProbability: 50,
    reasonsForChoosing: [],
    reasonsForRejecting: ['Lease timing is inconvenient'],
  })

  d = addAssumption(d, {
    statement: 'We resolve money disagreements within one calm conversation',
    confidence: 75,
    importance: 5,
    falsificationCondition: 'A money conflict lasts >2 weeks unresolved',
  })
  d = addPrediction(d, {
    statement: 'We will not have a serious conflict about chores in first 90 days',
    expectedResult: 'No multi-day unresolved chore conflict',
    expectedDate: '2025-08-01',
    confidence: 80,
    evaluationCriteria: 'Self-report at review',
  })

  d = commitDecision(d, {
    selectedOptionId: d.options[0]!.id,
    decisionDate: '2025-03-20',
    reviewDate: '2025-09-20',
  })

  // Good outcome overall, but reasoning was thin / overconfident
  d = recordReview(d, {
    whatHappened:
      'Still together and happier overall. But chore conflicts appeared by week 3; money talk was harder than assumed.',
    unexpected: 'Good outcome despite weak process — luck and goodwill.',
    missingInformation: 'Had not stress-tested conflict repair with real stakes.',
    outcomeRating: 4,
    decisionQualityRating: 2,
    rememberedBelief: null,
    memoryDriftNotes: null,
    assumptionStatuses: [
      bindAssumptionStatus(d.assumptions[0]!, 'PARTIAL'),
    ],
    predictionEvaluations: [
      bindPredictionEvaluation(d.predictions[0]!, 'INCORRECT'),
    ],
    counterfactualNotes: [],
  })

  return d
}

function purchaseFailedAssumption(): Decision {
  let d = createDecision({
    title: 'Buy used cargo bike instead of second car',
    description: 'School run + groceries without second vehicle.',
    context: {
      situation: 'One car household. Second-hand cargo bike ~$2.4k vs used car ~$9k.',
      constraints: 'Hills; rain; child seat needs.',
      stakes: 'Transport reliability vs cost.',
      deadline: '2025-01-10',
      peopleInvolved: ['partner', 'kids'],
      tags: ['purchasing'],
    },
  })

  d = addOption(d, {
    title: 'Buy cargo bike',
    description: 'Used Bullitt-style bike with rain cover.',
    perceivedUpside: 'Cost, health, parking.',
    perceivedDownside: 'Weather; range.',
    estimatedProbability: 65,
    reasonsForChoosing: ['Neighborhood is bike-friendly on paper'],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Buy used compact car',
    description: '2016 hatchback.',
    perceivedUpside: 'Weather-proof reliability.',
    perceivedDownside: 'Cost, insurance, parking.',
    estimatedProbability: 75,
    reasonsForChoosing: [],
    reasonsForRejecting: ['Budget prefers bike experiment first'],
  })

  d = addAssumption(d, {
    statement: 'Other people will respond quickly when we need backup rides',
    confidence: 70,
    importance: 4,
    falsificationCondition: 'Two missed school runs due to lack of backup within a month',
  })
  d = addAssumption(d, {
    statement: 'Schedule estimates for morning prep will stay under 25 minutes',
    confidence: 60,
    importance: 3,
    falsificationCondition: 'Median morning prep exceeds 35 minutes for 2 weeks',
  })
  d = addPrediction(d, {
    statement: 'Cargo bike covers ≥80% of school-week trips for 3 months',
    expectedResult: '≥80% trips by bike',
    expectedDate: '2025-04-10',
    confidence: 65,
    evaluationCriteria: 'Trip log',
  })

  d = commitDecision(d, {
    selectedOptionId: d.options[0]!.id,
    decisionDate: '2025-01-05',
    reviewDate: '2025-04-10',
  })

  d = recordReview(d, {
    whatHappened:
      'Bike worked on dry weeks. Rain + illness weeks needed car shares that often fell through.',
    unexpected: 'Friends slower to respond than expected.',
    missingInformation: 'True backup availability.',
    outcomeRating: 2,
    decisionQualityRating: 3,
    rememberedBelief: null,
    memoryDriftNotes: null,
    assumptionStatuses: [
      bindAssumptionStatus(d.assumptions[0]!, 'FAILED'),
      bindAssumptionStatus(d.assumptions[1]!, 'FAILED'),
    ],
    predictionEvaluations: [
      bindPredictionEvaluation(d.predictions[0]!, 'PARTIAL'),
    ],
    counterfactualNotes: [],
  })

  return d
}

function projectInaccuratePrediction(): Decision {
  let d = createDecision({
    title: 'Build internal prototype in-house vs buy SaaS',
    description: 'Ops tooling for intake triage.',
    context: {
      situation: 'Team of 3 engineers; SaaS quotes $18k/yr; in-house estimate 3 weeks.',
      constraints: 'Security review for SaaS vendors is slow.',
      stakes: 'Ops time and eng opportunity cost.',
      deadline: '2025-06-01',
      peopleInvolved: ['eng lead', 'ops manager'],
      tags: ['projects'],
    },
  })

  d = addOption(d, {
    title: 'Build in-house prototype',
    description: 'Minimal triage board + CSV import.',
    perceivedUpside: 'Fit; no vendor lock.',
    perceivedDownside: 'Maintenance.',
    estimatedProbability: 70,
    reasonsForChoosing: ['Security review queue is 8+ weeks'],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Buy SaaS',
    description: 'Vendor X.',
    perceivedUpside: 'Support; faster features.',
    perceivedDownside: 'Procurement delay.',
    estimatedProbability: 50,
    reasonsForChoosing: [],
    reasonsForRejecting: ['Cannot wait on security review'],
  })

  d = addAssumption(d, {
    statement: 'Schedule estimates for greenfield tools are usually accurate within 25%',
    confidence: 60,
    importance: 4,
    falsificationCondition: 'Actual calendar time >1.25× estimate',
  })
  d = addPrediction(d, {
    statement: 'The prototype will be usable by ten people within 14 days',
    expectedResult: '10 ops users complete a real triage in the tool',
    expectedDate: '2025-06-20',
    confidence: 75,
    evaluationCriteria: 'Usage count from ops lead',
  })

  d = commitDecision(d, {
    selectedOptionId: d.options[0]!.id,
    decisionDate: '2025-06-05',
    reviewDate: '2025-07-05',
  })

  d = recordReview(d, {
    whatHappened:
      'Prototype reached 10 users on day 31, not day 14. Auth and CSV edge cases dominated.',
    unexpected: 'Data cleaning took longer than UI.',
    missingInformation: 'Quality of existing CSVs.',
    outcomeRating: 3,
    decisionQualityRating: 3,
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

  return d
}

function travelMemoryDrift(): Decision {
  let d = createDecision({
    title: 'Book non-refundable shoulder-season Japan trip',
    description: 'Flights + hotels for 11 days in late October.',
    context: {
      situation:
        'Prices good; work project may slip. Travel insurance excludes “work busy”.',
      constraints: 'PTO approval pending final sign-off.',
      stakes: '~$4.2k non-refundable exposure.',
      deadline: '2024-08-01',
      peopleInvolved: ['partner', 'manager'],
      tags: ['travel'],
    },
  })

  d = addOption(d, {
    title: 'Book non-refundable package now',
    description: 'Lock itinerary.',
    perceivedUpside: 'Save ~$900 vs flexible fares.',
    perceivedDownside: 'Cancellation risk.',
    estimatedProbability: 70,
    reasonsForChoosing: [
      'Manager verbally supportive',
      'Project milestone looks green',
    ],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Buy flexible fares',
    description: 'Pay premium for changeability.',
    perceivedUpside: 'Lower regret if work slips.',
    perceivedDownside: 'Higher cost.',
    estimatedProbability: 80,
    reasonsForChoosing: [],
    reasonsForRejecting: ['Budget prefers savings'],
  })
  d = addOption(d, {
    title: 'Delay booking 3 weeks',
    description: 'Wait for written PTO.',
    perceivedUpside: 'More information.',
    perceivedDownside: 'Prices may rise.',
    estimatedProbability: 55,
    reasonsForChoosing: [],
    reasonsForRejecting: ['Historical price charts trending up'],
  })

  d = addAssumption(d, {
    statement: 'Other people will respond quickly with written PTO approval',
    confidence: 65,
    importance: 5,
    falsificationCondition: 'No written approval within 10 business days',
  })
  d = addPrediction(d, {
    statement: 'We take the trip as booked without date changes',
    expectedResult: 'Travel on booked dates',
    expectedDate: '2024-10-28',
    confidence: 70,
    evaluationCriteria: 'Boarding passes match booking',
  })

  d = commitDecision(d, {
    selectedOptionId: d.options[0]!.id,
    decisionDate: '2024-07-28',
    reviewDate: '2024-11-05',
  })

  // Later narrative drift vs snapshot
  d = reviseAfterCommit(d, {
    note: 'Added post-hoc clarification about risk tolerance (after trip)',
    description:
      d.description +
      ' Later note: we tell ourselves we “always knew” flexible fares were safer.',
  })

  d = recordReview(d, {
    whatHappened: 'Trip happened. PTO arrived late but in time. Exhausting but memorable.',
    unexpected: 'Project crunch the week before departure.',
    missingInformation: 'True probability of crunch was higher than admitted.',
    outcomeRating: 4,
    decisionQualityRating: 3,
    rememberedBelief:
      'I remember thinking flexible fares were obviously better and that we almost chose them.',
    memoryDriftNotes:
      'Snapshot shows the chosen option was non-refundable, with flexible fares explicitly rejected for budget. Memory inflated how seriously flexible fares were considered.',
    assumptionStatuses: [
      bindAssumptionStatus(d.assumptions[0]!, 'PARTIAL'),
    ],
    predictionEvaluations: [
      bindPredictionEvaluation(d.predictions[0]!, 'CORRECT'),
    ],
    counterfactualNotes: [
      {
        optionId: d.options[1]!.id,
        note: 'Counterfactual — unknowable. Would have cost more; stress may have been lower.',
      },
    ],
  })

  return d
}
