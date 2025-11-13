import { createTool } from '@mastra/core';
import { z } from 'zod';

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
	execute: async ({
		context,
		mastra,
		runtimeContext,
		threadId,
		resourceId,
		memory,
	}) => {
		const { userMessage } = context;

		const agent = mastra?.getAgent('fruitAgent');
		if (!agent || !threadId || !resourceId || !memory) {
			throw new Error('fruit agent context not found');
		}

		const result = await agent.generate(userMessage, {
			runtimeContext,
			memory: {
				thread: threadId,
				resource: resourceId,
			},
			maxSteps: 2,
		});

		return {
			response: result.text,
		};
	},
});
