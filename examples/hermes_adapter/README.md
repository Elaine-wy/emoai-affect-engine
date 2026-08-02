# Generic Adapter Example

This folder intentionally contains only a minimal adapter skeleton.

It does not include credentials, local paths, provider URLs, platform state, logs, memory, or concrete scenarios.

A host agent should:

1. Produce a structured appraisal for each turn.
2. Call the Node runtime with input, appraisal, and previous state.
3. Store the returned state.
4. Add system_context and response_context to the next LLM request.
5. Add its own persona, task, and world prompt separately.
