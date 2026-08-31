# Affect Engine Design

This document describes the boundaries and data flow of the engine. It is intended for contributors and host-application authors who need to understand why a field appears in the runtime result.

## Design goals

The engine keeps a small, inspectable state between turns and translates that state into controls that a host model can follow. The design favors explicit inputs, bounded numeric state, deterministic transitions, and host-side control over identity and safety.

The engine is not trying to simulate a brain. Neuro-inspired names provide a vocabulary for tuning response tendencies; the values are application state.

## Runtime pipeline

```mermaid
flowchart TB
    U[User turn or product event] --> A[Host appraisal / classifier]
    A --> P[Appraisal schema]
    P --> E[processTurn(payload)]
    E --> N[Normalize appraisal]
    N --> M[Apply modulation and effective stimulus]
    M --> T[Attribute event and gate relationship changes]
    T --> X[Update neuro and relationship state]
    X --> Q[Safety and memory decisions]
    Q --> R[Retrieve memories and update relational residue]
    R --> C[Derive affect, behavior,<br/>and expression contracts]
    C --> O[State + record + contexts]
    O --> H[Host model request]
```

The implementation entry point is [`src/runtime.js`](../src/runtime.js). The state machine is in [`src/engine/emoEngine.js`](../src/engine/emoEngine.js).

## State model

### Neuro-inspired state

The engine stores six bounded values, initialized from [`src/engine/config.js`](../src/engine/config.js):

- dopamine: reward and progress pressure;
- serotonin: stability and response bandwidth;
- norepinephrine: alertness and urgency;
- cortisol: strain and defensive load;
- oxytocin: affiliation and relational openness;
- endorphin: relief and buffering.

Each event contributes through `eventNeuroMatrix`. Target-specific overrides allow the same event to have a different meaning when it affects the agent, the user, or a shared task. Recovery moves each value toward its baseline using a per-variable time constant. Coupling adds small secondary effects between variables.

### Relationship state

The relationship vector contains `trust`, `familiarity`, `affection`, `conflict`, and `security`. Relationship changes are intentionally gated by event attribution. A task failure can change the agent's strain without being treated as harm caused by the user.

### Traces and memory

Event traces decay over time and amplify or adapt repeated events. Memories are keyed records containing salience, detail, event tags, target, valence, unresolved state, and the last turn. Retrieval ranks memories by salience, unresolved status, event overlap, target match, and current state match.

Relational residue is a separate slow state for hurt, trust debt, conflict debt, unresolved memory, repair credit, and attachment momentum. It lets a repair reduce harm without making a single apology erase all history.

## Appraisal contract

The host provides one appraisal per turn. Core scale fields describe valence, intensity, relevance, novelty, certainty, and controllability. Event fields identify one primary event and up to two secondary events. Target, attribution, expectation violation, relational signal, repair quality, memory instructions, privacy, and risk labels refine how the engine applies the stimulus.

See [`docs/APPRAISAL_SPEC.md`](APPRAISAL_SPEC.md) for field semantics and [`schemas/model_appraisal_prediction.schema.json`](../schemas/model_appraisal_prediction.schema.json) for validation.

The engine accepts assistant/npc aliases for the agent target. Unknown or low-confidence attribution is deliberately conservative: it can affect internal state while avoiding a confident relationship penalty.

## Transition stages

`EmoEngine.step` performs the following stages in order:

1. normalize levels into bounded continuous values and event slots;
2. calculate modulation from personality, history, relationship familiarity, arousal, certainty, and optional fact evidence;
3. calculate effective stimulus and cap correlated positive events;
4. derive causal and relationship attribution;
5. calculate post-harm damping from negative traces;
6. combine stimulus, coupling, and time-based recovery into the next neuro vector;
7. calculate relationship deltas, optionally applying long-run headroom damping;
8. derive safety constraints and memory action;
9. retrieve relevant memories and update relational residue;
10. derive affect control mode and behavior policy;
11. derive emotion state and export the complete transition record.

Every stage is represented in the returned record so a host can inspect a surprising result instead of treating the output as a black box.

## Affect control and expression

The affect load has fast, slow, residue, and trigger components. Hysteresis separates decision thresholds from expression thresholds, producing four modes:

- `quiet`: background wording and stance changes;
- `implicit`: small subjective or relational signals;
- `clear`: visible expression plus a related choice or commitment;
- `explicit`: direct first-person affect and a visible relational consequence.

[`src/embodiment/embodiedLayer.js`](../src/embodiment/embodiedLayer.js) maps the mode and state into interpretation bias, relationship distance, initiative, action pressure, delivery guidance, and an expression plan. The generated context tells the host model how to act on the state; it does not define a persona or output format.

[`src/affectMarkers.js`](../src/affectMarkers.js) is intentionally separate. It selects an optional UI marker from the state transition, can be disabled, and suppresses markers for safety risks or text-only output.

## Attribution and relationship safety

Relationship harm requires evidence that the player caused an event affecting the agent. Explicit attribution is preferred. Evidence cues are only a fallback and should be replaced or extended by a host-specific attribution layer for other languages and domains.

Events attributed to the environment or shared task can still increase strain, caution, or visible effort, but they do not automatically reduce trust in the user. Repair and care signals can reduce residue gradually while preserving unresolved debt when the history warrants it.

## Safety and privacy boundary

`deriveSafety` collects risk labels, redaction requirements, memory permission, and response constraints. Credential or dependency-related inputs can suppress persistence and marker output. The engine does not enforce a platform safety policy, perform a refusal, or decide whether a host may send a request. Those controls stay above the affect layer.

## Host integration boundary

The host must provide:

- raw-text appraisal or another structured event source;
- persona, task, world, capability, and formatting instructions;
- platform safety policy and enforcement;
- long-term state storage and retention policy;
- model provider integration;
- product-specific evaluation, including real dialogue or task outcomes.

Recommended prompt order is safety policy, `system_context`, host persona/task/world, retrieved ordinary context, current user turn, and `response_context` near the final response instruction. The host should treat `result.state` as the persistence payload and keep the full `record` for debugging or evaluation only when its privacy policy allows that.

## Extension points

- Add or tune events and matrices in `config.js`.
- Supply a custom `config` to `EmoEngine` for personality, recovery, thresholds, and target gains.
- Pass fact evidence to `EmoEngine.step` from a host adapter when event strength should be grounded in verified facts.
- Replace the built-in attribution cues with a domain-specific adapter.
- Add a product-specific renderer or policy layer around the generic contracts.

Keep these adapters outside the core engine so the package remains reusable and provider-neutral.

## Verification

The repository currently provides executable smoke and regression scripts rather than a full test framework. They cover neutral input, external task setbacks, strong relational stimuli, repair, residue, and state persistence. A host integration should add schema validation, provider-specific contract tests, and real-environment evaluation separately.
