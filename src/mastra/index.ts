import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { chatAgent } from './agents/chat-agent';

import { workflow } from './workflows/fruit-hitl-workflow';
import { fruitAgent } from './agents/fruit-agent';

export const mastra = new Mastra({
	workflows: { 'fruit-suggestion': workflow },
	agents: { chatAgent, fruitAgent },
	storage: new LibSQLStore({
		// stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
		url: ':memory:',
	}),
	logger: new PinoLogger({
		name: 'Mastra',
		level: 'info',
	}),
	observability: {
		// Enables DefaultExporter and CloudExporter for AI tracing
		default: { enabled: true },
	},
});
