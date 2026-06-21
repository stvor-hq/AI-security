import { describe, it, expect } from 'bun:test';
import {
  HybridMemoryManager,
  persistMemory,
} from '../src/plugins/agent-commerce/elizaos/memory';
import { rmSync, existsSync } from 'fs';

describe('HybridMemoryManager', () => {

  it('stores and retrieves job history', async () => {
    const testDir = './data/test-memory-' + Date.now() + '-1';
    process.env.STVOR_MEMORY_DIR = testDir;

    const hm = new HybridMemoryManager('agent-test-1');
    await hm.store({
      agentId: 'agent-test-1',
      roomId: 'room-1',
      userId: 'user-1',
      content: {
        text: 'Job job-abc12345 created',
        jobIds: ['job-abc12345'],
      },
    });
    const history = hm.getJobHistory('job-abc12345');
    expect(history).toHaveLength(1);
    expect(history[0].content.text).toContain('job-abc12345');

    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it('persists across instances (survives restart)', async () => {
    const testDir = './data/test-memory-persist-' + Date.now() + '-2';
    process.env.STVOR_MEMORY_DIR = testDir;

    const agentId = 'agent-persist-2' + Date.now();
    const hm1 = new HybridMemoryManager(agentId);
    await hm1.store({
      agentId: agentId,
      roomId: 'r', userId: 'u',
      content: { text: 'restart test job-rst99999' },
    });

    // New instance (simulates restart)
    const hm2 = new HybridMemoryManager(agentId);
    const history = hm2.getJobHistory('job-rst99999');
    expect(history).toHaveLength(1);

    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it('falls back to file store when runtime throws', async () => {
    const testDir = './data/test-memory-fallback-' + Date.now() + '-3';
    process.env.STVOR_MEMORY_DIR = testDir;

    const agentId = 'agent-fallback-' + Date.now();
    const mockRuntime = {
      agentId: agentId,
      character: { name: 'Test' },
      getSetting: () => undefined,
      getMemoryManager: () => ({
        createMemory: async () => {
          throw new Error('runtime unavailable');
        },
        searchMemoriesByEmbedding: async () => [],
      }),
    };

    await expect(
      persistMemory(mockRuntime as never, {
        agentId: agentId,
        roomId: 'r', userId: 'u',
        content: { text: 'fallback test' },
      })
    ).resolves.toBeUndefined();

    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });
});