import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
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

const findSuspendPayload = (
	steps: Record<string, unknown>,
):
	| {
			suggestedFruit: string;
			message: string;
	  }
	| undefined => {
	for (const stepResult of Object.values(steps)) {
		if (stepResult && typeof stepResult === 'object') {
			// Check if this step has a suspendPayload
			if (
				'suspendPayload' in stepResult &&
				stepResult.suspendPayload !== undefined
			) {
				return stepResult.suspendPayload as {
					suggestedFruit: string;
					message: string;
				};
			}
			// Check nested steps recursively (for nested workflows)
			if ('steps' in stepResult && stepResult.steps) {
				const nested = findSuspendPayload(
					stepResult.steps as Record<string, unknown>,
				);
				if (nested) return nested;
			}
		}
	}
	return undefined;
};

const refineAndConfirmFruitStep = createStep({
	id: 'confirm-and-refine',
	inputSchema: z.object({
		draftFruit: z.string().optional(),
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
		suggestedFruit: z.string(), // Pass back the fruit being approved/rejected
	}),
	execute: async ({ inputData, resumeData, mastra, writer, ...params }) => {
		// If resuming with approval, use the fruit from resumeData (the one user approved)
		if (resumeData?.approved && resumeData?.suggestedFruit) {
			await writer?.custom({
				type: 'data-step-approved',
				data: { fruit: resumeData.suggestedFruit, status: 'approved' },
			});
			return { draftFruit: resumeData.suggestedFruit, approved: true };
		}

		// Emit event: starting fruit generation
		await writer?.custom({
			type: 'data-step-progress',
			data: 'generating-fruit',
		});

		// Generate a new fruit
		const currentFruit = FRUITS[fruitIndex % FRUITS.length]!;
		fruitIndex++;

		// Emit event: fruit generated
		await writer?.custom({
			type: 'data-step-progress',
			data: { fruit: currentFruit, status: 'generated' },
		});

		// Emit event: awaiting user confirmation
		await writer?.custom({
			type: 'data-step-suspended',
			data: { fruit: currentFruit, status: 'awaitng-confirmation' },
		});

		// Always suspend to get user feedback
		await params.suspend({ suggestedFruit: currentFruit });

		// This return should not be reached as suspend stops execution
		return { draftFruit: currentFruit, approved: false };
	},
});

// Preprocessing step to add before the inner workflow
const preprocessStep = createStep({
	id: 'preprocess-fruit-request',
	inputSchema: z.object({
		draftFruit: z.string().optional(),
	}),
	outputSchema: z.object({
		draftFruit: z.string().optional(),
	}),
	execute: async ({ inputData, writer }) => {
		await writer?.custom({
			type: 'data-step-progress',
			data: {
				status: 'preprocessing',
				message: 'Preparing fruit suggestion...',
			},
		});

		// Simulate some preprocessing
		await new Promise((resolve) => setTimeout(resolve, 100));

		await writer?.custom({
			type: 'data-step-progress',
			data: {
				status: 'preprocessed',
				message: 'Ready to suggest fruits!',
			},
		});

		return {
			draftFruit: inputData?.draftFruit,
		};
	},
});

// Inner workflow that handles the fruit confirmation loop
export const innerFruitWorkflow = createWorkflow({
	id: 'inner-fruit-confirmation',
	inputSchema: z.object({
		draftFruit: z.string().optional(),
	}),
	outputSchema: z.object({
		approved: z.boolean(),
		draftFruit: z.string(),
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

// Main workflow that nests the inner workflow
export const workflow = createWorkflow({
	id: 'fruit-suggestion',
	inputSchema: z.object({
		draftFruit: z.string().optional(),
	}),
	outputSchema: z.object({
		fruit: z.string(),
	}),
})
	.then(preprocessStep)
	.then(innerFruitWorkflow)
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
	execute: async (inputData, context) => {
		if (!context || !context.mastra || !context.writer) {
			throw new Error('fruit agent context not found');
		}

		const fruitWorkflow = context.mastra.getWorkflow('fruit-suggestion');
		if (!fruitWorkflow) {
			throw new Error('Fruit suggestion workflow not found');
		}
		const run = await fruitWorkflow.createRun();
		const streamOutput = run.streamVNext({
			requestContext: context.requestContext,
			inputData: { draftFruit: undefined },
		});

		for await (const chunk of streamOutput.fullStream) {
			await context.writer.custom(chunk);
		}

		const result = await streamOutput.result;

		if (result.status === 'suspended') {
			const suspendPayload = findSuspendPayload(result.steps);
			return {
				runId: run.runId,
				suggestedFruit: suspendPayload?.suggestedFruit ?? '',
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
		suggestedFruit: z
			.string()
			.describe(
				'The fruit that was suggested and is being approved/rejected',
			),
		approved: z
			.boolean()
			.describe('Whether the user approved the suggested fruit'),
	}),
	outputSchema: z.object({
		runId: z.string().optional(),
		suggestedFruit: z.string(),
		approved: z.boolean(),
		status: z.string(),
	}),
	execute: async (inputData, context) => {
		if (!context || !context.agent || !context.mastra || !context.writer) {
			throw new Error('fruit agent context not found');
		}

		const { runId, approved, suggestedFruit } = inputData;
		const fruitWorkflow = context.mastra.getWorkflow('fruit-suggestion');
		if (!fruitWorkflow) {
			throw new Error('Fruit suggestion workflow not found');
		}
		const run = await fruitWorkflow.createRun({ runId });
		// Pass suggestedFruit back so the step knows which fruit was approved/rejected
		const streamOutput = run.resumeStreamVNext({
			resumeData: { approved, suggestedFruit },
			requestContext: context.requestContext,
		});

		for await (const chunk of streamOutput.fullStream) {
			await context.writer.custom(chunk);
		}

		const result = await streamOutput.result;

		if (result.status === 'suspended') {
			const suspendPayload = findSuspendPayload(result.steps);
			return {
				runId: run.runId,
				suggestedFruit: suspendPayload?.suggestedFruit ?? '',
				status: 'suspended',
				approved: false,
			};
		}

		if (result.status === 'success') {
			const output = result.result as {
				draftFruit: string;
				approved: boolean;
			};
			return {
				suggestedFruit: output.draftFruit,
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
