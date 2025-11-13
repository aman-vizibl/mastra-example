PROBLEM:

### ThreadId and resourceId undefined

```js
		// UNDEFINED //
		console.log(
			'---------------------',
			threadId,
			resourceId,
			'---------------------',
		);
```

Using network mode with workflow as tools within a subagent the network agent loses track of when to resume a workflow to improve this we could potentially leverage working memory. But working memory is thread scoped.

At Ln: 83 from workflows/fruit-hitl-workflow.ts file, we get threadId and resourceId undefined in network mode hence preventing us from taping into the shared working memory of the agents.

### Agents talk to each other

Although hard to reproduce in this particular case, in case of more complex workflows the network agent seem to generate the response for the sub agent and does not wait for the user 