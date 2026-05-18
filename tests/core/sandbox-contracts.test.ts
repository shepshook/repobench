import { describe, it, expect } from 'vitest';
import { ISandboxManager, ContainerRepositorySchema } from '../../src/core/contracts';

describe('ISandboxManager', () => {
  it('should be implementable by a mock class with required methods', () => {
    class MockSandboxManager implements ISandboxManager {
      async cleanupOrphanedContainers(): Promise<void> {
        // Mock implementation
      }
      async trackContainer(containerId: string): Promise<void> {
        // Mock implementation
      }
      async stopContainer(containerId: string): Promise<void> {
        // Mock implementation
      }
    }
    const manager: ISandboxManager = new MockSandboxManager();
    expect(manager).toBeDefined();
  });
});

describe('ContainerRepositorySchema', () => {
  it('should validate a correct container metadata object', () => {
    const validContainer = {
      containerId: 'cont-123',
      image: 'repobench-node-20',
      createdAt: new Date().toISOString(),
      status: 'running',
      labels: { app: 'repobench' },
    };
    expect(() => ContainerRepositorySchema.parse(validContainer)).not.toThrow();
  });

  it('should throw an error if the app label is missing or incorrect', () => {
    const invalidContainer = {
      containerId: 'cont-123',
      image: 'repobench-node-20',
      createdAt: new Date().toISOString(),
      status: 'running',
      labels: { app: 'wrong-app' },
    };
    // @ts-expect-error - testing runtime validation
    expect(() => ContainerRepositorySchema.parse(invalidContainer)).toThrow();
  });

  it('should throw an error for missing required fields', () => {
    const invalidContainer = {
      containerId: 'cont-123',
      // missing image, createdAt, etc.
    };
    // @ts-expect-error - testing runtime validation
    expect(() => ContainerRepositorySchema.parse(invalidContainer)).toThrow();
  });
});
