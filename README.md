PROBLEM:

### Event propogation issue with nested workflow when resumed

Context: `data-` custom events are essential for `ai-sdk` tool part consumption for rendering UI elements and emitting events to FE for actions.

In the fruit suggestion workflow if we remove the `innerWorkflow` all events emitted within the workflow steps are piped through the top level chat agent stream when the workflow is stared & resumed.

However, if we add a simple workflow inside the main workflow and when control flow is resumed the no custom events are emitted. Please note that it does work when the workflow is started

Steps to reproduce:

- prompt `chatAgent` to suggest a fruit
- Inspect console logs and search for `data-step-` 
- you should be able to see workflow chunks being bubbled up to top level stream chunks marked with `DELEGATION AGENT TOOL::`
- prompt `chatAgent` to confirm the suggested fruit
- Inspect console logs and search for `data-step-` 
- No logs found

Expected behaviour: Any custom events written to writer within a nested workflow step should bubble up when the workflow is resumed.

