# EmoAI Affect Engine v0.2.0

EmoAI is a generic neuro-inspired affect regulation layer for LLM agents. It turns structured appraisal signals into a persistent affect state, relationship state, memory pressure, and prompt fragments that can modulate the next model response.

This package is intentionally generic. It does not include any concrete character, game scene, product persona, test dialogue, provider configuration, API key, local state, or deployment log.

Version 0.2 adds a stronger affect-expression contract: quiet signals can still color wording, while clear or explicit affect can alter relational distance, trust posture, initiative, repair behavior, and response cadence. The engine also separates task setbacks from player-caused relational harm and exposes regression-testable state transitions.

## What It Does

- Tracks six neuro-inspired design variables: dopamine, serotonin, norepinephrine, cortisol, oxytocin, and endorphin.
- Tracks relationship variables: trust, familiarity, affection, conflict, and security.
- Converts stimulus appraisal into affect deltas through an event-to-state matrix.
- Applies history, relationship, uncertainty, and current arousal multipliers to stimulus strength.
- Creates affective memory traces with salience, detail level, persistence pressure, and retrieval bias.
- Produces internal prompt fragments that regulate tone, distance, initiative, caution, repair, and affect visibility.
- Produces structured decision and expression contracts for predictable host-model integration.
- Preserves continuous low-level affect without forcing repetitive emotion announcements.
- Uses explicit or evidence-backed attribution before changing player-facing relationship state.

## What It Does Not Do

- It does not classify raw user text by itself. A caller must provide structured appraisal fields.
- It does not define a character, NPC, assistant persona, world, task, safety policy, or product role.
- It does not include scenario examples, story data, benchmark cases, dialogue transcripts, or annotation workbooks.
- It does not claim the model has real feelings, consciousness, or biological neurotransmitters.
- It does not include provider credentials or model API settings.

The values are design abstractions, not biological measurements.

## Required Host Prompt

You must add your own persona, task, and world prompt separately.

Recommended ordering:

1. Platform and safety policy.
2. EmoAI affect regulation layer from system_context.
3. Your persona, task, and world prompt.
4. Retrieved conversation or memory context.
5. Current user turn and response_context.

EmoAI should be treated as a high-priority internal body-state mechanism inside the application, but it must not override safety policy, verified facts, or hard role capabilities.

## Quick Start

Run `npm run smoke` and `node scripts/regression.js`.

The runtime reads JSON from stdin and writes JSON to stdout.

## Programmatic Use

Use processTurn from src/runtime.js. Persist result.state and pass it back as payload.state on the next turn.

The host application should insert result.system_context and result.response_context into the model request. The package does not provide persona, task, world, model provider, or safety policy.

## Package Contents

- src/engine/config.js: event-state matrix and default parameters.
- src/engine/emoEngine.js: affect state, relationship state, memory, and transition engine.
- src/embodiment/embodiedLayer.js: maps state into response-control directives.
- src/runtime.js: generic stdin/stdout runtime and programmatic wrapper.
- schemas/model_appraisal_prediction.schema.json: structured appraisal schema.
- docs/APPRAISAL_SPEC.md: field definitions.
- docs/INTEGRATION.md: integration guidance.
- examples/hermes_adapter: minimal adapter notes, with no credentials or local paths.

## Release

The current release is `v0.2.0`. See [PATCH_NOTES.md](PATCH_NOTES.md) for the changes in this version.
