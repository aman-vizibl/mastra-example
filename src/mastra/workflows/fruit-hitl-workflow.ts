import { createStep, createTool, createWorkflow } from '@mastra/core';
import { z } from 'zod';

// List of fruits
const FRUITS = [
	'Apple',
	'Banana',
	'Orange',
	'Mango',
	'Strawberry',
	'Grape',
	'Watermelon',
];
let fruitIndex = 0;

const refineAndConfirmFruitStep = createStep({
	id: 'confirm-and-refine',
	inputSchema: z.object({
		draftFruit: z.string().nullable(),
	}),
	outputSchema: z.object({
		approved: z.boolean(),
		draftFruit: z.string(), // Keep same field name as input for loop compatibility
	}),
	suspendSchema: z.object({
		suggestedFruit: z.string(),
	}),
	resumeSchema: z.object({
		approved: z.boolean().default(false),
	}),
	execute: async ({ inputData, resumeData, mastra, ...params }) => {
		// Generate fruit if not already set (first time or after rejection)
		const currentFruit =
			inputData?.draftFruit || FRUITS[fruitIndex % FRUITS.length]!;
		if (!inputData?.draftFruit) {
			fruitIndex++;
		}

		// If approved, workflow is complete
		if (resumeData?.approved) {
			return { draftFruit: currentFruit, approved: true };
		}

		// Always suspend to get user feedback
		await params.suspend({ suggestedFruit: currentFruit });

		// This return should not be reached as suspend stops execution
		return { draftFruit: currentFruit, approved: false };
	},
});

export const workflow = createWorkflow({
	id: 'fruit-suggestion',
	inputSchema: z.object({
		draftFruit: z.string().nullable(),
	}),
	outputSchema: z.object({
		fruit: z.string(),
	}),
})
	.dountil(
		refineAndConfirmFruitStep,
		async ({ inputData, iterationCount }) => {
			const data = inputData as { approved: boolean };
			return Promise.resolve(data.approved || iterationCount >= 5);
		},
	)

	.commit();

// Tool to start the fruit suggestion workflow
export const startFruitWorkflowTool = createTool({
	id: 'start-fruit-workflow',
	description: 'Start a fruit suggestion workflow that will suggest a fruit',
	inputSchema: z.object({ message: z.string().default('recommend a fruit') }),
	outputSchema: z.object({
		runId: z.string(),
		suggestedFruit: z.string(),
		status: z.string(),
	}),
	execute: async ({ mastra, runtimeContext, threadId, resourceId }) => {
		const fruitWorkflow = mastra?.getWorkflow('fruit-suggestion');
		if (!fruitWorkflow) {
			throw new Error('Fruit suggestion workflow not found');
		}
		const run = await fruitWorkflow.createRunAsync();
		const result = await run.start({ runtimeContext });

		if (result.status === 'suspended') {
			const suspendPayload = result.steps['confirm-and-refine']
				?.suspendPayload as {
				suggestedFruit: string;
				message: string;
			};
			return {
				runId: run.runId,
				suggestedFruit: suspendPayload.suggestedFruit,
				status: 'suspended',
			};
		}

		return {
			runId: run.runId,
			suggestedFruit: '',
			status: result.status,
		};
	},
});

// Tool to resume the fruit suggestion workflow with user response
export const resumeFruitWorkflowTool = createTool({
	id: 'resume-fruit-workflow',
	description:
		'Resume a suspended fruit suggestion workflow with whether the user approved the fruit',
	inputSchema: z.object({
		runId: z.string().describe('The workflow run ID to resume'),
		approved: z
			.boolean()
			.describe('Whether the user approved the suggested fruit'),
	}),
	outputSchema: z.object({
		suggestedFruit: z.string(),
		approved: z.boolean(),
		status: z.string(),
	}),
	execute: async ({ context, mastra, runtimeContext }) => {
		const { runId, approved } = context;
		const fruitWorkflow = mastra?.getWorkflow('fruit-suggestion');
		if (!fruitWorkflow) {
			throw new Error('Fruit suggestion workflow not found');
		}
		const run = await fruitWorkflow.createRunAsync({ runId });
		const result = await run.resume({
			step: 'confirm-and-refine',
			resumeData: { approved },
			runtimeContext,
		});

		if (result.status === 'suspended') {
			const suspendPayload = result.steps['confirm-and-refine']
				?.suspendPayload as {
				suggestedFruit: string;
				message: string;
			};
			return {
				runId: run.runId,
				suggestedFruit: suspendPayload.suggestedFruit,
				status: 'suspended',
				approved: false,
			};
		}

		if (result.status === 'success') {
			const output = result.result as {
				suggestedFruit: string;
				approved: boolean;
			};
			return {
				suggestedFruit: output.suggestedFruit,
				approved: output.approved,
				status: 'success',
			};
		}

		return {
			suggestedFruit: '',
			approved: false,
			status: result.status,
		};
	},
});
