# Integration Guide v0.2

## Pipeline

1. Receive the current user turn or product event.
2. Build or retrieve ordinary conversation context.
3. Run an appraisal step that outputs schemas/model_appraisal_prediction.schema.json.
4. Call processTurn with input, appraisal, and prior state.
5. Persist result.state for the next turn.
6. Insert result.system_context and result.response_context into the model request.
7. Add your own persona, task, and world prompt separately.

## Prompt Placement

Recommended order:

1. Platform and safety policy.
2. EmoAI system_context.
3. External persona, task, and world prompt.
4. Retrieved memories and ordinary context.
5. User message.
6. EmoAI response_context close to the final response instruction.

This gives the affect layer enough priority to influence response decisions while keeping identity, task, world, and safety outside the package.

## What The Layer Controls

- Attention bias: what the agent treats as salient.
- Interpretation bias: charity, caution, verification, or repair.
- Relationship distance: warmth, guardedness, cautious warmth, or distance.
- Action pressure: initiative, restraint, boundary strength, or repair.
- Delivery: length, cadence, warmth, visible hurt, relief, strain, or curiosity.
- Memory pressure: whether an event becomes a persistent affective trace.
- Continuous emotional presence: quiet means background coloring rather than no affect.
- Affect amplitude: quiet, implicit, clear, or explicit expression.
- First-person feeling: optional when quiet, allowed when implicit, encouraged once when clear, and required once when explicit.
- Conditional soft decisions: relationship distance, initiative, trust posture, and repair behavior change only when supported by attribution and state.

Small signals are allowed to change internal state and remain perceptible in wording, cadence, or stance. Thresholds control expression amplitude and decision strength, not whether emotion exists at all.

Output constraints such as dialogue-only, action formatting, or scene narration belong in the host adapter. Do not put scenario names, fixed dialogue, world objects, or character identity inside the affect package.

## What The Host Must Provide

- Raw-text appraiser or classifier.
- Persona, task, world, and capability prompt.
- Safety policy.
- Long-term storage implementation.
- Model provider integration.
- Product-specific evaluation.

## Deployment Notes

The runtime is provider-neutral. It reads JSON from stdin and writes JSON to stdout, so it can be called from JavaScript, Python, or a local agent wrapper.
