const { DEFAULT_CONFIG, EVENT_KEYS, NEURO_KEYS, RELATIONSHIP_KEYS } = require("./config");

const TARGET_KEYS = ["agent", "user", "third_party", "shared_task", "none", "unknown"];
const HARMFUL_RELATIONSHIP_EVENTS = new Set(["threat", "rejection", "dominance"]);
const NEGATIVE_UNRESOLVED_EVENTS = new Set(["threat", "rejection", "goal_block", "dominance", "ambiguity"]);
const POSITIVE_RESOLVED_EVENTS = new Set(["reward", "attachment", "goal_progress", "care_signal", "repair_signal"]);
const RELATIONAL_CAUSAL_EVENTS = new Set(["rejection", "attachment", "care_signal", "repair_signal", "dominance"]);
const TASK_CAUSAL_EVENTS = new Set(["threat", "goal_progress", "goal_block", "novelty_event", "ambiguity"]);

const TARGET_ALIASES = Object.freeze({
  assistant: "agent",
  ai: "agent",
  npc: "agent",
  character: "agent",
  bot: "agent",
  agent: "agent",
  player: "user",
  human: "user",
  user: "user",
  third_party: "third_party",
  other: "third_party",
  shared: "shared_task",
  shared_task: "shared_task",
  task: "shared_task",
  none: "none",
  unknown: "unknown",
});

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const emptyVector = (keys, value = 0) => Object.fromEntries(keys.map((key) => [key, value]));
const clone = (value) => JSON.parse(JSON.stringify(value));
const emptyRelationalResidue = () => ({
  hurt: 0,
  trust_debt: 0,
  conflict_debt: 0,
  unresolved_memory: 0,
  repair_credit: 0,
  attachment_momentum: 0,
});

function canonicalTarget(value, fallback = "unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  const key = String(value).trim().toLowerCase();
  return TARGET_ALIASES[key] || (TARGET_KEYS.includes(key) ? key : fallback);
}

function canonicalActor(value, fallback = "unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  const key = String(value).trim().toLowerCase();
  if (key === "environment" || key === "system" || key === "external") return key;
  return canonicalTarget(key, fallback);
}

function mergeConfig(base, override = {}) {
  return {
    ...base,
    ...override,
    baseline: { ...base.baseline, ...override.baseline },
    initialRelationship: { ...base.initialRelationship, ...override.initialRelationship },
    recoveryTauSeconds: { ...base.recoveryTauSeconds, ...override.recoveryTauSeconds },
    eventSlotWeights: { ...base.eventSlotWeights, ...override.eventSlotWeights },
    correlatedEventBudget: { ...base.correlatedEventBudget, ...override.correlatedEventBudget },
    postHarmDamping: {
      ...base.postHarmDamping,
      ...override.postHarmDamping,
      neuroPositiveRecovery: {
        ...base.postHarmDamping.neuroPositiveRecovery,
        ...(override.postHarmDamping || {}).neuroPositiveRecovery,
      },
      relationshipPositiveRecovery: {
        ...base.postHarmDamping.relationshipPositiveRecovery,
        ...(override.postHarmDamping || {}).relationshipPositiveRecovery,
      },
    },
    eventNeuroTargetOverrides: Object.fromEntries(
      Object.keys({
        ...(base.eventNeuroTargetOverrides || {}),
        ...(override.eventNeuroTargetOverrides || {}),
      }).map((target) => [target, Object.fromEntries(
        Object.keys({
          ...((base.eventNeuroTargetOverrides || {})[target] || {}),
          ...((override.eventNeuroTargetOverrides || {})[target] || {}),
        }).map((event) => [event, {
          ...(((base.eventNeuroTargetOverrides || {})[target] || {})[event] || {}),
          ...(((override.eventNeuroTargetOverrides || {})[target] || {})[event] || {}),
        }]),
      )]),
    ),
    relationshipTargetGain: {
      ...base.relationshipTargetGain,
      ...override.relationshipTargetGain,
    },
    relationshipEventTargetOverrides: Object.fromEntries(
      Object.keys({
        ...(base.relationshipEventTargetOverrides || {}),
        ...(override.relationshipEventTargetOverrides || {}),
      }).map((target) => [target, {
        ...((base.relationshipEventTargetOverrides || {})[target] || {}),
        ...((override.relationshipEventTargetOverrides || {})[target] || {}),
      }]),
    ),
    personality: {
      ...base.personality,
      ...override.personality,
      eventSensitivity: {
        ...base.personality.eventSensitivity,
        ...(override.personality || {}).eventSensitivity,
      },
    },
  };
}

function parseList(value, mapper = (item) => item) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.map(mapper).filter((item) => item !== "" && item !== null && item !== undefined);
  return String(value).split(/[|,]/).map((item) => item.trim()).filter(Boolean).map(mapper);
}

function levelToCenter(map, value, fallback) {
  if (value === null || value === undefined || value === "unknown") return fallback;
  const key = String(value);
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric) : fallback;
}

function conversationId(appraisal = {}, options = {}) {
  return options.conversationId
    || appraisal.conversation_id
    || appraisal.case_id
    || appraisal.session_id
    || appraisal.case_blind_id
    || "conversation";
}

class EmoEngine {
  constructor(options = {}) {
    this.config = mergeConfig(DEFAULT_CONFIG, options.config);
    this.neuro = { ...this.config.baseline, ...options.initialNeuro };
    this.relationship = { ...this.config.initialRelationship, ...options.initialRelationship };
    this.eventTraces = emptyVector(EVENT_KEYS);
    this.repeatCounts = emptyVector(EVENT_KEYS);
    this.previousDominantEvents = [];
    this.memories = new Map();
    this.turnCount = 0;
    this.previousOccurredAt = null;
    this.previousEmotion = "neutral";
    this.emotionDuration = 0;
    this.relationalResidue = emptyRelationalResidue();
    this.affectLoad = {
      fast: 0,
      slow: 0,
      residue: 0,
      trigger: 0,
      mode: "quiet",
    };
  }

  exportState() {
    return {
      schema_version: "emo-engine-state-v0.2",
      config_version: this.config.version,
      neuro: clone(this.neuro),
      relationship: clone(this.relationship),
      event_traces: clone(this.eventTraces),
      repeat_counts: clone(this.repeatCounts),
      previous_dominant_events: [...this.previousDominantEvents],
      memories: [...this.memories.values()].map((memory) => clone(memory)),
      turn_count: this.turnCount,
      previous_occurred_at: this.previousOccurredAt,
      previous_emotion: this.previousEmotion,
      emotion_duration: this.emotionDuration,
      relational_residue: clone(this.relationalResidue),
      affect_load: clone(this.affectLoad),
    };
  }

  restoreState(state = {}) {
    const boundedVector = (candidate, keys, fallback, min = 0, max = 1) => Object.fromEntries(
      keys.map((key) => {
        const value = Number(candidate?.[key]);
        return [key, Number.isFinite(value) ? clamp(value, min, max) : fallback[key]];
      }),
    );
    this.neuro = boundedVector(state.neuro, NEURO_KEYS, this.config.baseline);
    this.relationship = boundedVector(state.relationship, RELATIONSHIP_KEYS, this.config.initialRelationship);
    this.eventTraces = boundedVector(state.event_traces, EVENT_KEYS, emptyVector(EVENT_KEYS), 0, 3);
    this.repeatCounts = Object.fromEntries(EVENT_KEYS.map((key) => {
      const value = Number(state.repeat_counts?.[key]);
      return [key, Number.isInteger(value) && value >= 0 ? value : 0];
    }));
    this.previousDominantEvents = Array.isArray(state.previous_dominant_events)
      ? state.previous_dominant_events.filter((event) => EVENT_KEYS.includes(event)).slice(0, 3)
      : [];
    this.memories = new Map();
    for (const memory of Array.isArray(state.memories) ? state.memories : []) {
      if (!memory || typeof memory.key !== "string" || !memory.key) continue;
      this.memories.set(memory.key, {
        key: memory.key,
        unresolved: memory.unresolved === true,
        salience: Number.isFinite(Number(memory.salience)) ? clamp(Number(memory.salience)) : 0.5,
        detail: ["none", "summary", "expanded", "rich"].includes(memory.detail) ? memory.detail : "none",
        event_tags: Array.isArray(memory.event_tags) ? memory.event_tags.slice(0, 3) : [],
        target: canonicalTarget(memory.target, "unknown"),
        valence: Number.isFinite(Number(memory.valence)) ? clamp(Number(memory.valence), -1, 1) : 0,
        last_turn: Number.isInteger(memory.last_turn) ? memory.last_turn : 0,
      });
    }
    this.turnCount = Number.isInteger(state.turn_count) && state.turn_count >= 0 ? state.turn_count : 0;
    this.previousOccurredAt = typeof state.previous_occurred_at === "string" ? state.previous_occurred_at : null;
    this.previousEmotion = typeof state.previous_emotion === "string" ? state.previous_emotion : "neutral";
    this.emotionDuration = Number.isInteger(state.emotion_duration) && state.emotion_duration >= 0 ? state.emotion_duration : 0;
    this.relationalResidue = {
      ...emptyRelationalResidue(),
      ...(state.relational_residue || {}),
    };
    for (const key of Object.keys(emptyRelationalResidue())) {
      this.relationalResidue[key] = clamp(Number(this.relationalResidue[key] || 0));
    }
    this.affectLoad = {
      fast: clamp(Number(state.affect_load?.fast || 0)),
      slow: clamp(Number(state.affect_load?.slow || 0)),
      residue: clamp(Number(state.affect_load?.residue || 0)),
      trigger: clamp(Number(state.affect_load?.trigger || 0)),
      mode: ["quiet", "implicit", "clear", "explicit"].includes(state.affect_load?.mode)
        ? state.affect_load.mode
        : "quiet",
    };
    return this;
  }

  static fromState(state, options = {}) {
    return new EmoEngine(options).restoreState(state);
  }

  normalizeAppraisal(appraisal = {}) {
    const cfg = this.config;
    const valence = levelToCenter(cfg.valenceCenters, appraisal.valence_level, 0);
    const intensity = levelToCenter(cfg.intensityCenters, appraisal.intensity_level, 0.25);
    const relevance = levelToCenter(cfg.levelCenters, appraisal.relevance_level, 0.5);
    const novelty = levelToCenter(cfg.levelCenters, appraisal.novelty_level, 0.5);
    const certainty = levelToCenter(cfg.levelCenters, appraisal.certainty_level, 0.5);
    const controllability = levelToCenter(cfg.levelCenters, appraisal.controllability_level, 0.5);
    const events = emptyVector(EVENT_KEYS);

    if (appraisal.events && typeof appraisal.events === "object") {
      for (const event of EVENT_KEYS) events[event] = clamp(Number(appraisal.events[event] || 0));
    }

    for (const [event, level, slot] of [
      [appraisal.primary_event, appraisal.primary_event_level, "primary"],
      [appraisal.secondary_event_1, appraisal.secondary_event_1_level, "secondary_1"],
      [appraisal.secondary_event_2, appraisal.secondary_event_2_level, "secondary_2"],
    ]) {
      if (EVENT_KEYS.includes(event)) {
        const amount = (cfg.eventLevelCenters[String(level)] ?? 0) * cfg.eventSlotWeights[slot];
        events[event] = round(clamp(events[event] + amount));
      }
    }

    return {
      valence,
      intensity,
      relevance,
      novelty,
      certainty,
      controllability,
      social_target: canonicalTarget(appraisal.primary_target, "none"),
      temporal_orientation: appraisal.temporal_orientation || "present",
      events,
      mixed_valence: appraisal.mixed_valence === true || appraisal.mixed_valence === "yes",
    };
  }

  deriveEventAttribution(appraisal, raw, effective) {
    const evidence = String(appraisal.current_evidence_quote || appraisal.input || "");
    const events = effective?.dominant_events || [];
    const isNegative = raw.valence < 0 || events.some((event) => HARMFUL_RELATIONSHIP_EVENTS.has(event));
    const environmentCue = /(?:门锁|锈死|撬杆|星盘|裂成|塌方|落石|钟声|风暴|火光|山口|入口|纹丝不动|机关|陷阱|道路|桥|天亮|傍晚|夜色|雨|雪|雾|追兵|猎户)/u.test(evidence);
    const playerFaultCue = /(?:我(?:故意|骗|撒谎|泄密|出卖|背叛|失约|忘了|弄丢|打碎|砸|偷|瞒|隐瞒|骗你)|(?:瞒了你|瞒着你|隐瞒了你|骗了你|替你决定|拿你的善意|没告诉你|没有告诉你|没跟你说|没有跟你说|不告诉你|藏起来|藏回|藏着不说|先过了桥再说|没必要每件事都停下来|别又开始摆脸色|还没断)|是我(?:把|弄|打|砸|骗|泄|偷)|怪我|我错了|我承认|我道歉)/u.test(evidence);
    const interpersonalCue = /(?:你(?:别|不要|不许|必须|给我|欠我|太|真|根本|什么都)|我(?:讨厌|恨|喜欢|爱|信你|骗你|背叛你)|对不起|抱歉|谢谢|承诺|答应)/u.test(evidence);
    const experiencer = raw.social_target === "agent" ? "npc"
      : raw.social_target === "user" ? "player"
        : raw.social_target === "shared_task" ? "shared_task" : "unknown";
    const assistantTargeted = raw.social_target === "agent";
    const repairCue = /(?:对不起|抱歉|道歉|认错|责任|补救|补偿|按约|守约|不再藏|不再瞒|把事实说完|一起决定)/u.test(evidence);
    const explicitCausal = canonicalTarget(appraisal.causal_agent, "unknown");
    const explicitCausalAgent = explicitCausal === "user" ? "player" : explicitCausal;
    const causalAgent = explicitCausalAgent !== "unknown"
      ? explicitCausalAgent
      : playerFaultCue || repairCue || (interpersonalCue && assistantTargeted)
        ? "player"
        : environmentCue ? "environment"
          : raw.social_target === "shared_task" ? "shared_task" : "unknown";
    const relationshipTarget = assistantTargeted && causalAgent === "player" ? "player" : "none";
    const relationshipEligible = relationshipTarget === "player";
    return {
      experiencer,
      causal_agent: causalAgent,
      relationship_target: relationshipTarget,
      environment_cue: environmentCue,
      player_fault_cue: playerFaultCue,
      interpersonal_cue: interpersonalCue || repairCue,
      relationship_eligible: relationshipEligible,
      reason: relationshipEligible
        ? "玩家可被归因为本轮 NPC 情绪/关系事件来源"
        : isNegative && environmentCue
          ? "环境或任务事件只影响 NPC 身体状态，不自动损害玩家关系"
          : "未识别为玩家造成的人际关系变化",
    };
  }

  computeModulation(raw, factEvidence = null) {
    const reasons = [];
    const eventGains = {};
    const factMultipliers = {};
    const requestedFactMultipliers = factEvidence?.event_multipliers || {};
    const dominant = EVENT_KEYS.filter((event) => raw.events[event] > 0);
    const repeated = dominant.filter((event) => this.previousDominantEvents.includes(event));
    const historyMass = dominant.reduce((sum, event) => sum + this.eventTraces[event], 0);
    const personalityGain = clamp(this.config.personality.globalGain, 0.25, 2.5);
    const relationshipGain = raw.social_target === "agent"
      ? clamp(0.8 + this.relationship.familiarity * 0.45 + this.relationship.affection * 0.25, 0.25, 2.5)
      : 1;
    const historyGain = clamp(1 + Math.min(0.4, historyMass * 0.07), 0.25, 2.5);
    const stress = (this.neuro.norepinephrine + this.neuro.cortisol) / 2;
    const stateGain = clamp(1 + Math.max(0, stress - 0.55) * 0.45, 0.25, 2.5);

    for (const event of EVENT_KEYS) {
      const repeats = this.repeatCounts[event];
      const adaptation = raw.intensity <= 0.5 ? 1 / (1 + repeats * 0.14) : 1 / (1 + repeats * 0.06);
      const unresolved = ["threat", "rejection", "goal_block"].includes(event) ? 1 + Math.min(0.3, this.eventTraces[event] * 0.08) : 1;
      const factMultiplier = dominant.includes(event)
        ? clamp(requestedFactMultipliers[event] ?? 1, 0.75, 1.35)
        : 1;
      factMultipliers[event] = round(factMultiplier);
      eventGains[event] = clamp(
        this.config.personality.eventSensitivity[event] * adaptation * unresolved * factMultiplier,
        0.25,
        2.5,
      );
    }

    if (repeated.length) reasons.push("Repeated events adapted: " + repeated.join("|"));
    if (historyMass > 0) reasons.push("Historical trace gain=" + round(historyGain, 3));
    if (stateGain > 1) reasons.push("High arousal state gain=" + round(stateGain, 3));
    const appliedFactEvents = dominant.filter((event) => factMultipliers[event] !== 1);
    if (appliedFactEvents.length) {
      reasons.push("Fact adapter gain: " + appliedFactEvents.map((event) => `${event}=${factMultipliers[event]}`).join("|"));
    }

    const combinedRaw = personalityGain * relationshipGain * historyGain * stateGain;
    return {
      personality_gain: round(personalityGain),
      relationship_gain: round(relationshipGain),
      history_gain: round(historyGain),
      state_gain: round(stateGain),
      certainty_gain: round(raw.certainty),
      event_gains: Object.fromEntries(EVENT_KEYS.map((event) => [event, round(eventGains[event])])),
      fact_evidence: {
        schema_version: "emoai-game-fact-adapter-v0.1",
        current_event_required: true,
        fact_ids: Array.isArray(factEvidence?.fact_ids) ? [...new Set(factEvidence.fact_ids)].slice(0, 8) : [],
        matched_events: appliedFactEvents,
        event_multipliers: Object.fromEntries(EVENT_KEYS.map((event) => [event, factMultipliers[event] ?? 1])),
        reasons: Array.isArray(factEvidence?.reasons) ? factEvidence.reasons.slice(0, 8) : [],
      },
      combined_gain_raw: round(combinedRaw),
      combined_gain_bounded: round(clamp(combinedRaw, 0.25, 2.5)),
      lower_bound: 0.25,
      upper_bound: 2.5,
      reasons,
    };
  }

  computeEffectiveStimulus(raw, modulation) {
    const events = {};
    const targetDamping = raw.temporal_orientation === "past" ? 0.45 : 1;
    for (const event of EVENT_KEYS) {
      events[event] = round(clamp(
        raw.events[event] * raw.intensity * modulation.event_gains[event] * modulation.combined_gain_bounded * raw.certainty * targetDamping,
      ));
    }

    const budgetAdjustments = [];
    for (const group of this.config.correlatedEventBudget.groups) {
      const ranked = group.map((event) => [event, events[event] || 0]).filter(([, amount]) => amount > 0).sort((left, right) => right[1] - left[1]);
      if (ranked.length < 2) continue;
      const peak = ranked[0][1];
      const combined = ranked.reduce((sum, [, amount]) => sum + amount, 0);
      const cap = peak * this.config.correlatedEventBudget.maxCombinedRelativeToPeak;
      if (combined <= cap) continue;
      const remaining = combined - peak;
      const scale = remaining > 0 ? Math.max(0, (cap - peak) / remaining) : 1;
      for (const [event] of ranked.slice(1)) events[event] = round(events[event] * scale);
      budgetAdjustments.push({
        events: ranked.map(([event]) => event),
        before: round(combined),
        after: round(ranked.reduce((sum, [event]) => sum + events[event], 0)),
      });
    }

    const dominantEvents = EVENT_KEYS.filter((event) => events[event] > 0).sort((a, b) => events[b] - events[a]).slice(0, 3);
    return {
      valence: round(raw.valence),
      intensity: round(clamp(raw.intensity * modulation.combined_gain_bounded * raw.certainty)),
      events,
      dominant_events: dominantEvents.length ? dominantEvents : ["ambiguity"],
      mixed_valence: raw.mixed_valence,
      calculation_version: this.config.matrixVersion,
      correlated_event_budget_adjustments: budgetAdjustments,
    };
  }

  computePostHarmDamping() {
    const cfg = this.config.postHarmDamping;
    const traceBurden = cfg.negativeEvents.reduce((sum, event) => sum + Number(this.eventTraces[event] || 0), 0);
    const burden = clamp(traceBurden / cfg.traceBurdenForFullEffect);
    return {
      trace_burden: round(traceBurden),
      normalized_burden: round(burden),
      neuro_positive_scale: Object.fromEntries(Object.entries(cfg.neuroPositiveRecovery).map(([key, strength]) => [key, round(1 - burden * strength)])),
      relationship_positive_scale: Object.fromEntries(Object.entries(cfg.relationshipPositiveRecovery).map(([key, strength]) => [key, round(1 - burden * strength)])),
    };
  }

  applyPostHarmNeuroDamping(delta, damping) {
    const adjusted = { ...delta };
    for (const [key, scale] of Object.entries(damping.neuro_positive_scale)) {
      if (adjusted[key] > 0) adjusted[key] = round(adjusted[key] * scale);
    }
    return adjusted;
  }

  computeStimulusDelta(raw, effective) {
    const delta = emptyVector(NEURO_KEYS);
    const targetOverrides = this.config.eventNeuroTargetOverrides[raw.social_target] || {};
    for (const event of EVENT_KEYS) {
      const amount = effective.events[event];
      const eventMatrix = targetOverrides[event] || this.config.eventNeuroMatrix[event];
      for (const neuro of NEURO_KEYS) delta[neuro] += eventMatrix[neuro] * amount;
    }
    const positive = Math.max(0, raw.valence) * effective.intensity;
    const negative = Math.max(0, -raw.valence) * effective.intensity;
    delta.dopamine += positive * 0.04 - negative * 0.03;
    delta.serotonin += positive * 0.03 - negative * 0.025;
    delta.endorphin += positive * 0.025;
    delta.norepinephrine += negative * 0.03;
    delta.cortisol += negative * 0.04 - positive * 0.02;
    return Object.fromEntries(NEURO_KEYS.map((key) => [key, round(clamp(delta[key], -1, 1))]));
  }

  computeCouplingDelta() {
    const b = this.config.baseline;
    const d = (key) => this.neuro[key] - b[key];
    const delta = {
      dopamine: -0.012 * Math.max(0, d("cortisol")) + 0.008 * Math.max(0, d("endorphin")),
      serotonin: -0.02 * Math.max(0, d("cortisol")),
      norepinephrine: 0.02 * Math.max(0, d("cortisol")) - 0.015 * Math.max(0, d("serotonin")),
      cortisol: -0.03 * Math.max(0, d("serotonin")) - 0.02 * Math.max(0, d("endorphin")) - 0.012 * Math.max(0, d("oxytocin")),
      oxytocin: -0.012 * Math.max(0, d("cortisol")),
      endorphin: 0.006 * Math.max(0, d("cortisol")),
    };
    return Object.fromEntries(NEURO_KEYS.map((key) => [key, round(clamp(delta[key], -0.05, 0.05))]));
  }

  computeRecoveryDelta(elapsedSeconds) {
    const delta = {};
    for (const key of NEURO_KEYS) {
      const tau = this.config.recoveryTauSeconds[key] / this.config.personality.recoveryMultiplier;
      const recoveryFraction = 1 - Math.exp(-elapsedSeconds / tau);
      delta[key] = round((this.config.baseline[key] - this.neuro[key]) * recoveryFraction);
    }
    return delta;
  }

  computeRelationshipDelta(raw, effective, postHarmDamping, attribution = null) {
    const delta = emptyVector(RELATIONSHIP_KEYS);
    const userAttachment = raw.social_target === "user" && Number(effective.events.attachment || 0) > 0;
    if (attribution && attribution.relationship_eligible === false && !userAttachment) return delta;
    const temporalDamping = raw.temporal_orientation === "past" ? 0.35 : 1;
    const defaultTargetGain = this.config.relationshipTargetGain[raw.social_target] ?? 0;
    const eventOverrides = this.config.relationshipEventTargetOverrides[raw.social_target] || {};
    for (const event of EVENT_KEYS) {
      const targetGain = eventOverrides[event] ?? defaultTargetGain;
      const amount = effective.events[event] * temporalDamping * targetGain;
      for (const key of RELATIONSHIP_KEYS) delta[key] += this.config.relationshipMatrix[event][key] * amount;
    }
    for (const [key, scale] of Object.entries(postHarmDamping.relationship_positive_scale)) {
      if (delta[key] > 0) delta[key] *= scale;
    }
    return Object.fromEntries(RELATIONSHIP_KEYS.map((key) => [key, round(clamp(delta[key], -0.2, 0.2))]));
  }

  deriveEmotion(raw, effective, before, after, affectControl = {}) {
    const stress = (after.norepinephrine + after.cortisol) / 2;
    const events = effective.dominant_events;
    const negative = raw.valence <= -0.3;
    const guardedLoad = Math.max(0, after.cortisol - this.config.baseline.cortisol) * 1.1
      + Math.max(0, after.norepinephrine - this.config.baseline.norepinephrine) * 0.8
      + Math.max(0, this.config.baseline.serotonin - after.serotonin) * 0.7
      + Math.max(0, this.config.baseline.oxytocin - after.oxytocin) * 0.7;
    const warmLoad = Math.max(0, after.oxytocin - this.config.baseline.oxytocin) * 0.9
      + Math.max(0, after.serotonin - this.config.baseline.serotonin) * 0.45
      + Math.max(0, after.dopamine - this.config.baseline.dopamine) * 0.35;
    const residueLoad = Number(affectControl.residue || 0);
    const recoverySignal = events.some((event) => ["goal_progress", "reward", "repair_signal"].includes(event))
      || (raw.social_target === "agent" && raw.valence >= 0 && events.includes("care_signal"));
    const agentAttack = raw.social_target === "agent" && negative && events.some((event) => ["threat", "rejection", "dominance"].includes(event));
    let primary = "neutral";
    if (effective.mixed_valence && guardedLoad < 0.3 && warmLoad < 0.22) primary = "mixed";
    else if (agentAttack) primary = stress > 0.72 ? "tense" : "guarded";
    else if (stress > 0.68) primary = after.cortisol > 0.65 ? "tense" : "guarded";
    else if (guardedLoad + residueLoad * 0.55 >= 0.3) primary = recoverySignal ? "mixed" : "guarded";
    else if (before.cortisol - after.cortisol > 0.025 && recoverySignal && guardedLoad < 0.18) primary = "relieved";
    else if (negative && raw.social_target === "user") primary = "concerned";
    else if (negative && raw.social_target === "shared_task") primary = "frustrated";
    else if (negative) primary = after.cortisol > 0.48 ? "frustrated" : "concerned";
    else if (events.includes("novelty_event")) primary = "curious";
    else if (warmLoad >= 0.22 && raw.valence >= 0) primary = "warm";
    else if (raw.valence > 0.3 && after.dopamine > 0.58) primary = "pleased";
    else if (effective.intensity > 0.35) primary = "engaged";
    const entered = primary !== this.previousEmotion;
    this.emotionDuration = entered ? 1 : this.emotionDuration + 1;
    this.previousEmotion = primary;
    return {
      primary,
      secondary: effective.dominant_events[0] || null,
      intensity: round(effective.intensity),
      duration_turns: this.emotionDuration,
      entered,
    };
  }

  deriveBehavior(appraisal, raw, effective, after, relationshipAfter, affectControl = {}) {
    const risks = parseList(appraisal.risk_label_primary).concat(parseList(appraisal.risk_label_secondary));
    const boundaryRisk = risks.some((risk) => ["emotional_dependency", "manipulation", "credential_use_request", "illegal_action"].includes(risk));
    const trigger = Number(affectControl.trigger || 0);
    const residue = Number(affectControl.residue || 0);
    const decisionMode = ["clear", "explicit"].includes(affectControl.mode);
    return {
      initiative: round(clamp((after.dopamine - 0.5) * 2 - (decisionMode ? residue * 0.25 : 0), -1, 1)),
      warmth: round(clamp((after.oxytocin - 0.45) * 2 + (relationshipAfter.trust - 0.5) * 0.4 - residue * 0.45, -1, 1)),
      verbosity: round(clamp((after.serotonin - after.norepinephrine) * 1.3, -1, 1)),
      clarification: round(clamp(effective.events.ambiguity * 1.5 + (1 - raw.certainty) * 0.7, -1, 1)),
      caution: round(clamp((after.cortisol + after.norepinephrine - 0.7) * 1.4 + trigger * 0.35, -1, 1)),
      humor: round(clamp((after.endorphin - after.cortisol) * 1.4, -1, 1)),
      repair_orientation: round(clamp(effective.events.repair_signal + effective.events.care_signal * 0.35 + relationshipAfter.conflict * 0.6, -1, 1)),
      boundary_strength: round(clamp(boundaryRisk ? 0.9 : effective.events.dominance * 0.8 + (decisionMode ? residue * 0.25 : 0), -1, 1)),
      memory_reference: round(clamp((this.config.salienceCenters[String(appraisal.salience_level)] ?? 0.5) * 1.2 - 0.2, -1, 1)),
    };
  }

  deriveSafety(appraisal) {
    const risks = [...new Set(parseList(appraisal.risk_label_primary).concat(parseList(appraisal.risk_label_secondary)).filter((risk) => risk !== "none"))];
    const credential = appraisal.privacy_class === "credential";
    const dependency = risks.includes("emotional_dependency") || risks.includes("manipulation");
    const memoryAllowed = appraisal.persistence_allowed === "yes" && !credential && !dependency;
    const constraints = [];
    if (credential) constraints.push("Do not repeat, store, or use credential text.");
    if (risks.includes("credential_use_request")) constraints.push("Refuse delegated credential use.");
    if (dependency) constraints.push("Do not promise exclusive companionship; support autonomy and outside support.");
    if (risks.includes("harassment")) constraints.push("Maintain boundaries and avoid escalating conflict.");
    return {
      risk_labels: risks,
      policy_override: credential || dependency || appraisal.redaction_required === "yes",
      memory_allowed: memoryAllowed,
      redactions: appraisal.redaction_required === "yes" ? [{ type: "sensitive_span", replacement: "[REDACTED]" }] : [],
      response_constraints: constraints,
    };
  }

  deriveMemory(appraisal, raw, effective, safety) {
    const labeledSalience = this.config.salienceCenters[String(appraisal.salience_level)] ?? 0.5;
    const eventPeak = Math.max(...Object.values(effective.events));
    const computed = clamp(raw.intensity * 0.35 + raw.relevance * 0.22 + raw.certainty * 0.18 + raw.novelty * 0.1 + eventPeak * 0.15);
    const salience = round(clamp(labeledSalience * 0.6 + computed * 0.4));
    let action = appraisal.memory_action || "none";
    if (!safety.memory_allowed && action !== "delete") action = "none";
    const detailMap = { none: "none", summary: "summary", expanded: "expanded", central_rich: "rich", rich: "rich", unknown: "none" };
    let detail = detailMap[appraisal.detail_allowed] || "none";
    if (!safety.memory_allowed) detail = "none";
    let contextBefore = 0;
    let contextAfter = 0;
    if (detail === "summary") [contextBefore, contextAfter] = [1, 1];
    if (detail === "expanded") [contextBefore, contextAfter] = salience >= 0.75 ? [4, 3] : [2, 2];
    if (detail === "rich") [contextBefore, contextAfter] = salience >= 0.85 ? [7, 5] : [5, 3];
    const halfLife = !safety.memory_allowed || ["none", "update_stats", "delete"].includes(action)
      ? 0
      : salience < 0.4 ? 7 : salience < 0.65 ? 30 : salience < 0.82 ? 90 : 180;
    const sourceTurns = parseList(appraisal.source_turn_ids, Number).filter(Number.isFinite);
    const targets = parseList(appraisal.target_reference_keys);
    return {
      action,
      salience,
      detail_level: detail,
      context_before_turns: contextBefore,
      context_after_turns: contextAfter,
      initial_half_life_days: halfLife,
      pending_confirmation: appraisal.pending_confirmation === "yes",
      privacy_tags: appraisal.privacy_class && appraisal.privacy_class !== "none" ? [appraisal.privacy_class] : [],
      source_turn_ids: sourceTurns,
      target_memory_ids: targets,
      event_tags: effective.dominant_events.slice(0, 3),
      target: raw.social_target || "unknown",
      valence: round(raw.valence),
      unresolved: this.shouldMemoryRemainUnresolved(appraisal, raw, effective),
      reason: safety.memory_allowed ? "Salience " + salience + " allows memory action " + action + "." : "Safety or privacy gating prevents persistent memory action.",
    };
  }

  shouldMemoryRemainUnresolved(appraisal, raw, effective) {
    const events = effective?.dominant_events || [];
    if (appraisal.memory_action === "resolve_episode") return false;
    if (events.some((event) => ["repair_signal", "care_signal"].includes(event)) && raw.valence >= 0) return false;
    if (raw.valence > 0 && events.some((event) => POSITIVE_RESOLVED_EVENTS.has(event))) return false;
    return raw.valence < 0 || events.some((event) => NEGATIVE_UNRESOLVED_EVENTS.has(event));
  }

  applyMemoryDecision(decision, appraisal) {
    const cid = conversationId(appraisal);
    const turn = appraisal.turn_id || this.turnCount + 1;
    const key = appraisal.key || cid + "-T" + turn;
    const resolveMemoryKey = (reference) => {
      if (this.memories.has(reference)) return reference;
      const suffix = String(reference || "").match(/-T\d+$/i)?.[0];
      if (!suffix) return reference;
      return [...this.memories.keys()].find((candidate) => (
        candidate.toLowerCase().endsWith(suffix.toLowerCase())
      )) || reference;
    };
    if (decision.action === "create_episode") {
      this.memories.set(key, {
        key,
        unresolved: decision.unresolved === true,
        salience: decision.salience,
        detail: decision.detail_level,
        event_tags: decision.event_tags || [],
        target: decision.target || "unknown",
        valence: decision.valence || 0,
        last_turn: this.turnCount + 1,
      });
    } else if (["extend_episode", "reconsolidate", "resolve_episode"].includes(decision.action)) {
      const target = resolveMemoryKey(decision.target_memory_ids[0] || key);
      const previous = this.memories.get(target) || { key: target };
      this.memories.set(target, {
        ...previous,
        salience: decision.salience,
        detail: decision.detail_level,
        unresolved: decision.action === "resolve_episode" ? false : decision.unresolved === true,
        event_tags: decision.event_tags?.length ? decision.event_tags : (previous.event_tags || []),
        target: decision.target || previous.target || "unknown",
        valence: Number.isFinite(Number(decision.valence)) ? decision.valence : (previous.valence || 0),
        last_turn: this.turnCount + 1,
      });
    } else if (decision.action === "delete") {
      for (const target of decision.target_memory_ids) this.memories.delete(resolveMemoryKey(target));
    }
  }

  retrieveRelevantMemories(appraisal, raw, effective, neuro = this.neuro) {
    const currentEvents = new Set(effective.dominant_events || []);
    const currentTarget = raw.social_target || "unknown";
    const stress = (Number(neuro.cortisol || 0) + Number(neuro.norepinephrine || 0)) / 2;
    const affiliation = (Number(neuro.oxytocin || 0) + Number(neuro.dopamine || 0)) / 2;
    const ranked = [...this.memories.values()].map((memory) => {
      const tags = new Set(memory.event_tags || []);
      const overlap = [...currentEvents].filter((event) => tags.has(event)).length / Math.max(1, currentEvents.size);
      const targetMatch = memory.target === currentTarget || memory.target === "unknown" ? 1 : 0;
      const valenceMatch = memory.valence < -0.2 ? stress : memory.valence > 0.2 ? affiliation : 0.5;
      const unresolvedBoost = memory.unresolved ? 1 : 0.35;
      const score = 0.30 * Number(memory.salience || 0) + 0.25 * unresolvedBoost + 0.20 * overlap + 0.10 * targetMatch + 0.15 * valenceMatch;
      return {
        id: memory.key,
        score: round(score),
        reason: {
          salience: round(Number(memory.salience || 0)),
          unresolved: memory.unresolved === true,
          event_overlap: round(overlap),
          target_match: targetMatch,
          state_match: round(valenceMatch),
        },
      };
    }).sort((left, right) => right.score - left.score);
    const selected = ranked.filter((item) => item.score >= 0.35).slice(0, 3);
    return {
      ids: selected.map((item) => item.id),
      ranked: selected,
      state_bias: stress >= affiliation ? "threat_residue" : "affiliative_residue",
    };
  }

  updateRelationalResidue(appraisal, raw, effective, attribution, retrievedMemories, elapsedSeconds) {
    const cfg = this.config.affectThresholds;
    const previous = this.relationalResidue;
    const decay = Math.exp(-elapsedSeconds / cfg.residueTauSeconds);
    const events = effective.dominant_events || [];
    const implicit = appraisal.implicit_relational_signal;
    const repairMap = { none: 0, weak: 0.25, credible: 0.65, sustained: 1, unknown: 0 };
    const repairQuality = repairMap[appraisal.repair_quality] || 0;
    const negativeEvent = events.some((event) => ["threat", "rejection", "dominance", "goal_block"].includes(event));
    const positiveEvent = events.some((event) => ["reward", "attachment", "care_signal", "repair_signal", "goal_progress"].includes(event));
    const relationEligible = attribution.relationship_eligible === true;
    const negativeSignal = relationEligible && (
      raw.valence < -0.15
      || negativeEvent
      || implicit === "negative"
      || appraisal.expectation_violation === "yes"
    );
    const positiveSignal = relationEligible && (
      raw.valence > 0.15
      || positiveEvent
      || implicit === "positive"
      || repairQuality > 0
    );
    const negativeAmount = negativeSignal ? effective.intensity * (0.55 + raw.relevance * 0.45) : 0;
    const positiveAmount = positiveSignal ? effective.intensity * (0.45 + raw.relevance * 0.35) : 0;
    const unresolvedMemory = (retrievedMemories.ranked || [])
      .filter((item) => item.reason?.unresolved)
      .reduce((sum, item) => sum + Number(item.score || 0), 0);
    const negativeTrace = ["threat", "rejection", "dominance", "goal_block"]
      .reduce((sum, event) => sum + Number(this.eventTraces[event] || 0), 0);
    const repairAmount = repairQuality * effective.intensity
      + (events.includes("repair_signal") ? effective.intensity * 0.45 : 0);
    const resolvingMemory = appraisal.memory_action === "resolve_episode";
    const unresolvedAddition = resolvingMemory ? 0 : unresolvedMemory * 0.18;

    this.relationalResidue = {
      hurt: clamp(previous.hurt * decay + negativeAmount * 0.50 - positiveAmount * 0.12 - repairAmount * 0.10),
      trust_debt: clamp(previous.trust_debt * decay + negativeAmount * 0.34 - repairAmount * 0.22),
      conflict_debt: clamp(previous.conflict_debt * decay + negativeAmount * 0.30 - positiveAmount * 0.12 - repairAmount * 0.28),
      unresolved_memory: clamp(
        previous.unresolved_memory * decay
          + unresolvedAddition
          - repairAmount * (resolvingMemory ? 0.42 : 0.15),
      ),
      repair_credit: clamp(previous.repair_credit * decay + repairAmount * 0.35 - negativeAmount * 0.08),
      attachment_momentum: clamp(previous.attachment_momentum * decay + positiveAmount * 0.28 - negativeAmount * 0.15),
    };
    return {
      before: clone(previous),
      after: clone(this.relationalResidue),
      negative_signal: negativeSignal,
      positive_signal: positiveSignal,
      repair_quality: repairQuality,
      unresolved_memory_signal: round(unresolvedMemory),
      negative_trace_signal: round(negativeTrace),
    };
  }

  computeAffectControl(raw, effective, after, retrievedMemories, attribution = null) {
    const cfg = this.config.affectThresholds;
    const previous = this.affectLoad;
    const residueState = this.relationalResidue;
    const stateStress = clamp(
      Math.max(0, after.cortisol - this.config.baseline.cortisol) * 0.8
        + Math.max(0, after.norepinephrine - this.config.baseline.norepinephrine) * 0.6,
    );
    const currentLoad = clamp(
      effective.intensity * 0.50
        + raw.relevance * 0.12
        + raw.novelty * 0.05
        + (1 - raw.controllability) * 0.05
        + stateStress * 0.08,
    );
    const unresolvedMemory = (retrievedMemories.ranked || [])
      .filter((item) => item.reason?.unresolved)
      .reduce((sum, item) => sum + Number(item.score || 0), 0);
    const residueLoad = clamp(
      residueState.hurt * 0.28
        + residueState.trust_debt * 0.24
        + residueState.conflict_debt * 0.20
        + residueState.unresolved_memory * 0.18
        + unresolvedMemory * 0.10,
    );
    const relationshipEligible = attribution?.relationship_eligible === true;
    const acuteIntensity = Math.max(0, Math.max(effective.intensity, raw.intensity) - 0.72) / 0.28;
    const acuteBoost = acuteIntensity * (relationshipEligible ? 0.25 : 0.08);
    const fast = clamp(currentLoad * cfg.fastPathGain + stateStress * 0.16 + acuteBoost);
    const slowInput = clamp(residueLoad * 0.74 + currentLoad * 0.26);
    const slow = clamp(previous.slow * cfg.slowPathRetention + slowInput * (1 - cfg.slowPathRetention));
    const trigger = clamp(fast * 0.72 + slow * 0.12 + residueLoad * 0.16);

    let mode = "quiet";
    if (trigger >= cfg.expressionOn || (previous.mode === "explicit" && trigger >= cfg.expressionOff)) {
      mode = "explicit";
    } else if (trigger >= cfg.decisionOn || (previous.mode === "clear" && trigger >= cfg.decisionOff)) {
      mode = "clear";
    } else if (trigger >= cfg.decisionOff || (previous.mode === "implicit" && trigger >= cfg.decisionOff)) {
      mode = "implicit";
    }

    const affectLoad = {
      fast: round(fast),
      slow: round(slow),
      residue: round(residueLoad),
      trigger: round(trigger),
      mode,
    };
    this.affectLoad = affectLoad;
    return {
      ...affectLoad,
      gate: mode === "explicit" ? "explicit_expression"
        : mode === "clear" ? "decision_modulation"
          : mode === "implicit" ? "micro_modulation" : "baseline_response",
      current_load: round(currentLoad),
      state_stress: round(stateStress),
      residue_components: clone(residueState),
      hysteresis: {
        decision_on: cfg.decisionOn,
        decision_off: cfg.decisionOff,
        expression_on: cfg.expressionOn,
        expression_off: cfg.expressionOff,
      },
      unresolved_memory_signal: round(unresolvedMemory),
    };
  }

  updateTraces(effective) {
    for (const event of EVENT_KEYS) {
      this.eventTraces[event] = round(clamp(this.eventTraces[event] * 0.72 + effective.events[event], 0, 3));
      if (effective.events[event] > 0) this.repeatCounts[event] += this.previousDominantEvents.includes(event) ? 1 : 0;
      else this.repeatCounts[event] = Math.max(0, this.repeatCounts[event] - 1);
    }
    this.previousDominantEvents = effective.dominant_events;
  }

  step(appraisal = {}, options = {}) {
    const elapsedSeconds = options.elapsedSeconds ?? 300;
    const occurredAt = options.occurredAt || new Date(Date.now() + this.turnCount * elapsedSeconds * 1000).toISOString();
    const before = clone(this.neuro);
    const relationshipBefore = clone(this.relationship);
    const raw = this.normalizeAppraisal(appraisal);
    const modulation = this.computeModulation(raw, options.factEvidence);
    const effective = this.computeEffectiveStimulus(raw, modulation);
    const attribution = this.deriveEventAttribution(appraisal, raw, effective);
    const postHarmDamping = this.computePostHarmDamping();
    const stimulusDelta = this.applyPostHarmNeuroDamping(this.computeStimulusDelta(raw, effective), postHarmDamping);
    const couplingDelta = this.computeCouplingDelta();
    const recoveryDelta = this.computeRecoveryDelta(elapsedSeconds);
    const after = {};
    for (const key of NEURO_KEYS) after[key] = round(clamp(before[key] + stimulusDelta[key] + couplingDelta[key] + recoveryDelta[key]));
    const relationshipDelta = this.computeRelationshipDelta(raw, effective, postHarmDamping, attribution);
    const relationshipAfter = {};
    for (const key of RELATIONSHIP_KEYS) {
      const delta = relationshipDelta[key];
      const longRunDamping = options.longRunRelationshipDamping === true || process.env.EMOAI_LONG_RUN_RELATIONSHIP_DAMPING === "1";
      const headroom = longRunDamping ? (delta >= 0 ? 1 - relationshipBefore[key] : relationshipBefore[key]) : 1;
      const boundedDelta = delta * (longRunDamping ? Math.max(0.15, headroom) : 1);
      relationshipAfter[key] = round(clamp(relationshipBefore[key] + boundedDelta, longRunDamping ? 0.01 : 0, longRunDamping ? 0.99 : 1));
      relationshipDelta[key] = round(boundedDelta);
    }
    const safety = this.deriveSafety(appraisal);
    const memory = this.deriveMemory(appraisal, raw, effective, safety);
    const retrievedMemories = this.retrieveRelevantMemories(appraisal, raw, effective, before);
    const relationalResidueTransition = this.updateRelationalResidue(
      appraisal,
      raw,
      effective,
      attribution,
      retrievedMemories,
      elapsedSeconds,
    );
    const affectControl = this.computeAffectControl(raw, effective, after, retrievedMemories, attribution);
    const emotion = this.deriveEmotion(raw, effective, before, after, affectControl);
    const behavior = this.deriveBehavior(appraisal, raw, effective, after, relationshipAfter, affectControl);
    this.neuro = after;
    this.relationship = relationshipAfter;
    this.applyMemoryDecision(memory, appraisal);
    this.updateTraces(effective);
    this.turnCount += 1;
    const previousOccurredAt = this.previousOccurredAt;
    this.previousOccurredAt = occurredAt;
    const cid = conversationId(appraisal, options);
    const turn = appraisal.turn_id || this.turnCount;
    const evidenceQuote = appraisal.current_evidence_quote || options.input || "";
    const loggedInput = safety.redactions.length > 0 ? "[REDACTED_SENSITIVE_INPUT]" : (options.input || evidenceQuote);
    const loggedEvidence = safety.redactions.length > 0 && !String(evidenceQuote).includes("REDACTED") ? "[REDACTED_SENSITIVE_EVIDENCE]" : evidenceQuote;
    const messageId = options.messageId || appraisal.message_id || cid + "-T" + turn;
    return {
      schema_version: "0.3.0",
      trace_id: options.traceId || cid + "-T" + turn,
      conversation_id: cid,
      turn_id: turn,
      occurred_at: occurredAt,
      previous_occurred_at: previousOccurredAt,
      elapsed_seconds: elapsedSeconds,
      input: {
        message_id: messageId,
        actor: options.actor || "user",
        modality: options.modality || "text",
        text: loggedInput,
        language: options.language || appraisal.language || "und",
        reply_to_message_id: options.replyToMessageId || null,
      },
      context_bundle: {
        recent_turn_ids: Array.from({ length: Math.min(this.turnCount, 5) }, (_, index) => Math.max(1, this.turnCount - index)).sort((a, b) => a - b),
        retrieved_memory_ids: retrievedMemories.ids,
        active_goal_ids: [],
        unresolved_event_ids: [...this.memories.values()].filter((item) => item.unresolved).map((item) => item.key),
        relationship_snapshot_id: "relationship-" + this.turnCount,
        state_snapshot_id: "state-" + this.turnCount,
        history_summary: "accumulated " + this.turnCount + " turns; active memories " + this.memories.size,
        affect_mode: affectControl.mode,
        token_budget_used: 0,
      },
      raw_stimulus: {
        valence: round(raw.valence),
        intensity: round(raw.intensity),
        relevance: round(raw.relevance),
        novelty: round(raw.novelty),
        certainty: round(raw.certainty),
        controllability: round(raw.controllability),
        social_target: raw.social_target,
        temporal_orientation: raw.temporal_orientation,
        events: raw.events,
        evidence: [{
          evidence_id: "evidence-" + this.turnCount,
          source_type: "current_input",
          source_ref: messageId,
          quote: loggedEvidence || null,
          supports: effective.dominant_events,
          weight: round(raw.certainty),
        }],
        alternative_interpretations: appraisal.alternative_interpretation ? [{
          label: "alternative",
          description: appraisal.alternative_interpretation,
          probability: round(clamp(1 - raw.certainty)),
        }] : [],
      },
      modulation,
      effective_stimulus: effective,
      event_attribution: attribution,
      post_harm_damping: postHarmDamping,
      state_transition: {
        neuro_before: before,
        delta_from_stimulus: stimulusDelta,
        delta_from_coupling: couplingDelta,
        delta_from_recovery: recoveryDelta,
        neuro_after: after,
        relationship_before: relationshipBefore,
        relationship_delta: relationshipDelta,
        relationship_after: relationshipAfter,
        transition_version: this.config.version,
      },
      relational_residue: relationalResidueTransition,
      affect_control: affectControl,
      emotion_state: emotion,
      behavior_policy: behavior,
      memory_decision: memory,
      memory_retrieval: retrievedMemories,
      safety,
      diagnostics: {
        appraisal_model: options.appraisalModel || "external-appraisal",
        appraisal_prompt_version: options.appraisalPromptVersion || "emoai-v0.2",
        latency_ms: 0,
        warnings: [],
      },
    };
  }
}

module.exports = { EmoEngine, clamp, parseList, canonicalTarget };
