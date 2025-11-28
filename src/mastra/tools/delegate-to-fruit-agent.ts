import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { appendFileSync } from 'fs';
import { join } from 'path';

export const delegateToFruitAgent = createTool({
	id: 'delegate-to-fruit-specialist',
	description: `Delegate to the fruit specialist agent to suggest a fruit for the user.
    This agent will handle the entire fruit suggestion process including:
    - Gathering user input
    - Handling confirmation or rejection
    - Suggesting a fruit


    Use this tool when users want get a fruit recommendation.
    The agent manages its own conversation flow and state, so simply pass each user message to it.`,
	inputSchema: z.object({
		userMessage: z
			.string()
			.describe(
				"The user's message. Can be their initial request to suggest a fruit or feedback on the suggested fruit",
			),
	}),
	outputSchema: z.object({
		response: z
			.string()
			.describe("The fruit agent's response to present to the user"),
	}),
	execute: async (inputData, context) => {
		const { userMessage } = inputData;

		if (!context || !context.agent || !context.mastra || !context.writer) {
			throw new Error('fruit agent context not found');
		}

		const agent = context.mastra.getAgent('fruitAgent');

		const subThreadId = `${context.agent.threadId}:outcome-agent-state-thread`;
		const subResourceId = `${context.agent.resourceId}:outcome-agent`;

		// Use stream() instead of generate() to capture all events including custom tool-output events
		const streamResult = await agent.stream(userMessage, {
			requestContext: context.requestContext,
			memory: {
				thread: subThreadId,
				resource: subResourceId,
			},
			maxSteps: 2,
		});

		// Forward all stream events to parent writer
		// Use relative path from project root, assuming cwd is .mastra/output
		const logFile = join('../../src', 'delegation-agent.log');
		console.log('Log file path:', logFile);
		for await (const chunk of streamResult.fullStream) {
			const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(chunk, null, 2)}\n`;
			console.log('Writing to log:', logFile);
			appendFileSync(logFile, logEntry);
			await context.writer.custom({
				type: 'data-delegated-agent',
				data: chunk,
			});
		}

		const result = await streamResult.text;

		return {
			response: result,
		};
	},
});
