import type { IElizaRuntime, Memory, State } from './types';
import { IJobStore, ICommerceContext } from '../types';
import { MemoryJobStore } from '../index';

const contexts = new Map<string, { ctx: ICommerceContext; store: IJobStore }>();

function getOrCreate(runtime: IElizaRuntime): { ctx: ICommerceContext; store: IJobStore } {
  if (!contexts.has(runtime.agentId)) {
    const store = new MemoryJobStore();
    const ctx: ICommerceContext = {
      runtime: {
        agentId: runtime.agentId,
        character: runtime.character,
        getSetting: runtime.getSetting,
        getMemoryManager: runtime.getMemoryManager,
      } as unknown as any,
      jobStore: store,
      reputationGate: null as any,
    };
    contexts.set(runtime.agentId, { ctx, store });
  }
  return contexts.get(runtime.agentId)!;
}

export const commerceProvider = {
  name: 'COMMERCE_CONTEXT',
  description: 'Provides active ERC-8183 job context and crypto transport status to the agent',
  get: async (runtime: IElizaRuntime, _message: Memory, _state: State): Promise<string> => {
    const { store } = getOrCreate(runtime);
    const jobs = await store.listByAgent(runtime.agentId);

    if (jobs.length === 0) {
      return '[Commerce] No active jobs. You can create a new job with "Create a job for <provider> to <task>, budget <amount>"';
    }

    const recent = jobs.slice(-5);
    const summary = recent.map((j) =>
      `• ${j.jobId} | ${j.state} | provider: ${j.providerAgent} | "${j.taskDescription.slice(0, 40)}..."`,
    ).join('\n');

    return `[Commerce — ERC-8183 Secure Jobs]\n${summary}\n[Transport: ML-KEM-768 + AES-256-GCM | Ledger: SHA-256 attestation only]`;
  },
};
