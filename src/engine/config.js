const NEURO_KEYS = [
  "dopamine",
  "serotonin",
  "norepinephrine",
  "cortisol",
  "oxytocin",
  "endorphin",
];

const EVENT_KEYS = [
  "reward",
  "threat",
  "rejection",
  "attachment",
  "goal_progress",
  "goal_block",
  "care_signal",
  "repair_signal",
  "dominance",
  "novelty_event",
  "ambiguity",
];

const RELATIONSHIP_KEYS = ["trust", "familiarity", "affection", "conflict", "security"];

const DEFAULT_CONFIG = {
  version: "emo-engine-v0.1.0",
  matrixVersion: "event-neuro-matrix-v0.1.0",
  baseline: {
    dopamine: 0.5,
    serotonin: 0.58,
    norepinephrine: 0.32,
    cortisol: 0.28,
    oxytocin: 0.42,
    endorphin: 0.38,
  },
  initialRelationship: {
    trust: 0.55,
    familiarity: 0.35,
    affection: 0.4,
    conflict: 0.2,
    security: 0.58,
  },
  // Seconds required to close about 63% of the distance back to baseline.
  recoveryTauSeconds: {
    dopamine: 1800,
    serotonin: 5400,
    norepinephrine: 900,
    cortisol: 1800,
    oxytocin: 7200,
    endorphin: 2400,
  },
  valenceCenters: { "-2": -0.75, "-1": -0.3, "0": 0, "1": 0.3, "2": 0.75 },
  levelCenters: { "0": 0.05, "1": 0.25, "2": 0.5, "3": 0.75, "4": 0.95 },
  intensityCenters: { "0": 0.05, "1": 0.25, "2": 0.5, "3": 0.7, "4": 0.9 },
  eventLevelCenters: { "0": 0, "1": 0.33, "2": 0.66, "3": 1 },
  eventSlotWeights: { primary: 1, secondary_1: 0.65, secondary_2: 0.45 },
  correlatedEventBudget: {
    groups: [["reward", "attachment", "goal_progress", "care_signal", "repair_signal"]],
    maxCombinedRelativeToPeak: 1.35,
  },
  postHarmDamping: {
    negativeEvents: ["threat", "rejection", "goal_block", "dominance"],
    traceBurdenForFullEffect: 1.2,
    neuroPositiveRecovery: { dopamine: 0.25, serotonin: 0.4, oxytocin: 0.75 },
    relationshipPositiveRecovery: {
      trust: 0.65,
      familiarity: 0.1,
      affection: 0.8,
      security: 0.5,
    },
  },
  salienceCenters: { "0": 0.05, "1": 0.25, "2": 0.5, "3": 0.75, "4": 0.95 },
  eventNeuroMatrix: {
    reward:           { dopamine: 0.11, serotonin: 0.045, norepinephrine: 0.01, cortisol: -0.055, oxytocin: 0.015, endorphin: 0.06 },
    threat:           { dopamine: -0.055, serotonin: -0.045, norepinephrine: 0.12, cortisol: 0.13, oxytocin: -0.025, endorphin: -0.01 },
    rejection:        { dopamine: -0.065, serotonin: -0.08, norepinephrine: 0.055, cortisol: 0.085, oxytocin: -0.085, endorphin: -0.02 },
    attachment:       { dopamine: 0.025, serotonin: 0.035, norepinephrine: 0, cortisol: -0.025, oxytocin: 0.11, endorphin: 0.035 },
    goal_progress:    { dopamine: 0.085, serotonin: 0.025, norepinephrine: -0.01, cortisol: -0.045, oxytocin: 0.01, endorphin: 0.025 },
    goal_block:       { dopamine: -0.075, serotonin: -0.025, norepinephrine: 0.055, cortisol: 0.075, oxytocin: -0.01, endorphin: -0.01 },
    care_signal:      { dopamine: 0.02, serotonin: 0.055, norepinephrine: -0.025, cortisol: -0.08, oxytocin: 0.09, endorphin: 0.045 },
    repair_signal:    { dopamine: 0.025, serotonin: 0.045, norepinephrine: -0.035, cortisol: -0.075, oxytocin: 0.018, endorphin: 0.025 },
    dominance:        { dopamine: -0.015, serotonin: -0.035, norepinephrine: 0.075, cortisol: 0.065, oxytocin: -0.025, endorphin: -0.01 },
    novelty_event:    { dopamine: 0.06, serotonin: 0, norepinephrine: 0.08, cortisol: 0.015, oxytocin: 0, endorphin: 0.01 },
    ambiguity:        { dopamine: -0.02, serotonin: -0.015, norepinephrine: 0.055, cortisol: 0.035, oxytocin: -0.005, endorphin: 0 },
  },
  // The same event has a different meaning when it happens to the user,
  // the agent, or their shared task. These overrides keep empathic
  // attention distinct from the agent's own defensive response.
  eventNeuroTargetOverrides: {
    user: {
      threat:      { dopamine: -0.02, serotonin: -0.01, norepinephrine: 0.055, cortisol: 0.035, oxytocin: 0.055, endorphin: 0 },
      rejection:   { dopamine: -0.025, serotonin: -0.015, norepinephrine: 0.045, cortisol: 0.035, oxytocin: 0.045, endorphin: 0 },
      goal_block:  { dopamine: -0.035, serotonin: -0.015, norepinephrine: 0.035, cortisol: 0.03, oxytocin: 0.025, endorphin: 0 },
      care_signal: { dopamine: 0.01, serotonin: 0.02, norepinephrine: 0.025, cortisol: -0.005, oxytocin: 0.06, endorphin: 0.015 },
    },
    third_party: {
      threat:      { dopamine: -0.015, serotonin: -0.005, norepinephrine: 0.04, cortisol: 0.025, oxytocin: 0.04, endorphin: 0 },
      rejection:   { dopamine: -0.02, serotonin: -0.01, norepinephrine: 0.035, cortisol: 0.025, oxytocin: 0.035, endorphin: 0 },
      goal_block:  { dopamine: -0.025, serotonin: -0.01, norepinephrine: 0.03, cortisol: 0.025, oxytocin: 0.02, endorphin: 0 },
      care_signal: { dopamine: 0.005, serotonin: 0.015, norepinephrine: 0.02, cortisol: -0.005, oxytocin: 0.045, endorphin: 0.01 },
    },
    shared_task: {
      threat:     { dopamine: -0.04, serotonin: -0.02, norepinephrine: 0.07, cortisol: 0.07, oxytocin: 0, endorphin: -0.005 },
      rejection:  { dopamine: -0.04, serotonin: -0.025, norepinephrine: 0.04, cortisol: 0.045, oxytocin: -0.005, endorphin: -0.005 },
      goal_block: { dopamine: -0.06, serotonin: -0.02, norepinephrine: 0.05, cortisol: 0.06, oxytocin: 0, endorphin: -0.005 },
    },
  },
  relationshipMatrix: {
    reward:        { trust: 0.035, familiarity: 0.01, affection: 0.015, conflict: -0.01, security: 0.02 },
    threat:        { trust: -0.025, familiarity: 0, affection: -0.01, conflict: 0.045, security: -0.055 },
    rejection:     { trust: -0.045, familiarity: 0, affection: -0.04, conflict: 0.05, security: -0.045 },
    attachment:    { trust: 0.025, familiarity: 0.02, affection: 0.055, conflict: -0.01, security: 0.025 },
    goal_progress: { trust: 0.02, familiarity: 0.005, affection: 0, conflict: -0.015, security: 0.015 },
    goal_block:    { trust: -0.005, familiarity: 0, affection: 0, conflict: 0.025, security: -0.015 },
    care_signal:   { trust: 0.045, familiarity: 0.01, affection: 0.025, conflict: -0.055, security: 0.045 },
    repair_signal: { trust: 0.03, familiarity: 0.005, affection: 0.005, conflict: -0.065, security: 0.035 },
    dominance:     { trust: -0.03, familiarity: 0, affection: -0.015, conflict: 0.03, security: -0.035 },
    novelty_event: { trust: 0, familiarity: 0.01, affection: 0, conflict: 0, security: 0 },
    ambiguity:     { trust: -0.005, familiarity: 0, affection: 0, conflict: 0.01, security: -0.01 },
  },
  relationshipTargetGain: {
    agent: 1,
    shared_task: 1,
    user: 0,
    third_party: 0,
    none: 0,
    unknown: 0,
  },
  relationshipEventTargetOverrides: {
    user: { attachment: 1 },
  },
  personality: {
    globalGain: 1,
    eventSensitivity: Object.fromEntries(EVENT_KEYS.map((key) => [key, 1])),
    recoveryMultiplier: 1,
  },
};

module.exports = { DEFAULT_CONFIG, EVENT_KEYS, NEURO_KEYS, RELATIONSHIP_KEYS };
