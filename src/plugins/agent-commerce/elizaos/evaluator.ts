import type { IElizaRuntime, Memory, State } from './types';

export const commerceEvaluator = {
  name: 'COMMERCE_TRACKER',
  description: 'Extracts job IDs and statuses from conversation and tracks them in agent memory',
  similes: ['track job', 'remember job'],
  alwaysRun: false,
  validate: async (_runtime: IElizaRuntime, message: Memory): Promise<boolean> => {
    return /job-[\w-]+/i.test(message.content.text);
  },
  handler: async (
    runtime: IElizaRuntime,
    message: Memory,
    _state: State,
  ): Promise<void> => {
    const jobIds = message.content.text.match(/job-[\w-]+/gi);
    if (!jobIds || jobIds.length === 0) return;

    await runtime.getMemoryManager().createMemory({
      content: {
        text: `Commerce job referenced: ${jobIds.join(', ')}`,
        jobIds,
        timestamp: new Date().toISOString(),
      },
      roomId: message.roomId,
      userId: message.userId,
      agentId: runtime.agentId,
    });
  },
};
