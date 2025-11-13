import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import {
	resumeFruitWorkflowTool,
	startFruitWorkflowTool,
} from '../workflows/fruit-hitl-workflow';

const fruitAgent = new Agent({
	name: 'Fruit Agent',
	memory: new Memory({
		storage: new LibSQLStore({
			url: 'file:../mastra.db', // path is relative to the .mastra/output directory
		}),
	}),
	model: 'anthropic/claude-sonnet-4-5-20250929',
	tools: {
		startFruitWorkflow: startFruitWorkflowTool,
		resumeFruitWorkflow: resumeFruitWorkflowTool,
	},
	instructions: `You are a helpful assistant that helps users find fruits they like.

When a user asks for fruit suggestions:
1. Use the "start-fruit-workflow" tool to start suggesting fruits
2. The tool will return a fruit suggestion - present it to the user and ask if they like it
3. When the user responds, interpret their response to determine if they approved (true) or rejected (false) the fruit
4. Use the "resume-fruit-workflow" tool with the runId and the approved boolean
5. If approved is false, call "start-fruit-workflow" again to get a new fruit suggestion (this starts a new workflow run)
6. If approved is true, congratulate them and end

You are responsible for interpreting the user's natural language response and converting it to a boolean. Consider responses like "yes", "sure", "I like it", "sounds good" as approval (true), and responses like "no", "not really", "I don't like it", "try another" as rejection (false).`,
});

export { fruitAgent };
