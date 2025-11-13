import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { fruitAgent } from './fruit-agent';

export const chatAgent = new Agent({
	name: 'Chat Agent',
	instructions: `You are an intelligent chat assistant, designed to help users for choosing a favourite fruit

## When to Use Specialized Agent Tools

As the main conversational interface, you should identify when to use specialized agent tools:

1. **Fruit suggestion**: When users want to get a fruit recommendation you should invoke the delegateToFruitAgent tool 


### How It Works

The delegateToFruitAgent tool wraps a specialized agent that:
- Manages an internal workflow for fruit suggestion
- Recommends a fruit
- Handles confirmation or rejection
- Manages all workflow state internally through snapshots

**You don't need to track workflow state** - the outcome agent handles suspend/resume internally.
`,
	model: 'anthropic/claude-sonnet-4-5-20250929',
	agents: { fruitAgent },
	memory: new Memory({
		storage: new LibSQLStore({
			url: 'file:../mastra.db', // path is relative to the .mastra/output directory
		}),
	}),
});
