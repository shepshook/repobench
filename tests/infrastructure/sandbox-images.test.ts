import { describe, it, expect, vi } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { SandboxConfig } from '../../src/core/contracts';
import { createSandboxFixture } from './fixtures';

describe('Sandbox Images', () => {
  it('should use the configured baseImage when provided', async () => {
    const customImage = 'my-custom-image:latest';
    const { sandbox, mockDocker } = createSandboxFixture({ baseImage: customImage });
    
    await sandbox.init();
    
    expect(mockDocker.createContainerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Image: customImage,
      })
    );
  });

  it('should use the configured baseImagePath instead of baseImage if provided', async () => {
    const customPath = 'my-custom-path:latest';
    const { sandbox, mockDocker } = createSandboxFixture({ 
      baseImage: 'ignored-image', 
      baseImagePath: customPath 
    });
    
    await sandbox.init();
    
    expect(mockDocker.createContainerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Image: customPath,
      })
    );
  });

  it('should fall back to the default image (node:20-alpine) when no image is provided', async () => {
    const { sandbox, mockDocker } = createSandboxFixture({});
    
    await sandbox.init();
    
    expect(mockDocker.createContainerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Image: 'node:20-alpine',
      })
    );
  });
});
