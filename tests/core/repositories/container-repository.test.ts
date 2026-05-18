import { ContainerRepository } from '../../../src/core/repositories/container-repository';
import { db, reinitDatabase } from '../../../src/infrastructure/persistence/database';
import { ContainerMetadata, SANDBOX_APP_LABEL } from '../../../src/core/contracts';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('ContainerRepository', () => {
  let repository: ContainerRepository;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `container-repo-test-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    repository = new ContainerRepository();
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  it('should save and retrieve container metadata', () => {
    const metadata: ContainerMetadata = {
      containerId: 'cont-123',
      image: 'node:20-alpine',
      createdAt: new Date().toISOString(),
      status: 'running',
      labels: {
        app: SANDBOX_APP_LABEL,
      },
    };

    repository.save(metadata);

    const retrieved = repository.getById('cont-123');
    expect(retrieved).toEqual(metadata);
  });

  it('should return undefined for non-existent container', () => {
    expect(repository.getById('non-existent')).toBeUndefined();
  });

  it('should retrieve all tracked containers', () => {
    const containers: ContainerMetadata[] = [
      {
        containerId: 'cont-1',
        image: 'node:20-alpine',
        createdAt: new Date().toISOString(),
        status: 'running',
        labels: { app: SANDBOX_APP_LABEL },
      },
      {
        containerId: 'cont-2',
        image: 'node:20-alpine',
        createdAt: new Date().toISOString(),
        status: 'stopped',
        labels: { app: SANDBOX_APP_LABEL },
      },
    ];

    containers.forEach(c => repository.save(c));

    const all = repository.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(containers[0]);
    expect(all).toContainEqual(containers[1]);
  });

  it('should remove a container from tracking', () => {
    const metadata: ContainerMetadata = {
      containerId: 'cont-123',
      image: 'node:20-alpine',
      createdAt: new Date().toISOString(),
      status: 'running',
      labels: { app: SANDBOX_APP_LABEL },
    };

    repository.save(metadata);
    repository.delete('cont-123');

    expect(repository.getById('cont-123')).toBeUndefined();
    expect(repository.getAll()).toHaveLength(0);
  });
});
