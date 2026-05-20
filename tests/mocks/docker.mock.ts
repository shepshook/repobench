import { vi } from 'vitest';
import { IDocker } from '../../src/core/contracts';

export class MockDocker implements IDocker {
  public createVolumeMock = vi.fn();
  public getVolumeMock = vi.fn();
  public getImageMock = vi.fn();
  public pullMock = vi.fn();
  public createContainerMock = vi.fn();

  async createVolume(options: any): Promise<any> {
    return this.createVolumeMock(options);
  }

  getVolume(name: string): any {
    return this.getVolumeMock(name);
  }

  getImage(image: string): any {
    return this.getImageMock(image);
  }

  async pull(image: string): Promise<any> {
    return this.pullMock(image);
  }

  async createContainer(options: any): Promise<any> {
    const result = await this.createContainerMock(options);
    return result || {
      id: 'mock-container-id',
      Id: 'mock-container-id',
      start: vi.fn().mockResolvedValue({}),
      stop: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue({}),
      inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
      exec: vi.fn().mockResolvedValue({
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, callback) => { 
            if (event === 'data') {
              // Simulate some data emission
              setTimeout(() => callback(Buffer.from('native\n')), 10);
            }
            if (event === 'end') callback(); 
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      }),
    };
  }

  /**
   * Helper to setup a successful volume creation
   */
  setupCreateVolumeSuccess() {
    this.createVolumeMock.mockResolvedValue({ Id: 'mock-vol-id', Name: 'mock-vol-name' });
  }

  /**
   * Helper to setup a volume already exists error
   */
  setupCreateVolumeAlreadyExists() {
    const error = new Error('conflict: volume already exists');
    (error as any).json = { message: 'conflict: volume already exists' };
    this.createVolumeMock.mockRejectedValue(error);
  }

  /**
   * Helper to setup a generic Docker error
   */
  setupCreateVolumeError(message: string = 'Docker API Error') {
    const error = new Error(message);
    (error as any).json = { message };
    this.createVolumeMock.mockRejectedValue(error);
  }

  /**
   * Helper to setup a successful volume retrieval
   */
  setupGetVolumeSuccess() {
    this.getVolumeMock.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
    });
  }

  /**
   * Helper to setup a 'no such volume' error for getVolume
   */
  setupGetVolumeNotFound() {
    const error = new Error('no such volume');
    (error as any).json = { message: 'no such volume' };
    this.getVolumeMock.mockImplementation(() => {
      throw error;
    });
  }

  /**
   * Helper to setup a successful image inspection
   */
  setupGetImageSuccess() {
    this.getImageMock.mockReturnValue({
      inspect: vi.fn().mockResolvedValue({}),
    });
  }

  /**
   * Helper to setup a successful container creation
   */
  setupCreateContainerSuccess() {
    this.createContainerMock.mockResolvedValue({
      id: 'mock-container-id',
      Id: 'mock-container-id',
      start: vi.fn().mockResolvedValue({}),
      stop: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue({}),
      inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
      exec: vi.fn().mockResolvedValue({
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, callback) => { 
            if (event === 'data') {
              // Simulate some data emission
              setTimeout(() => callback(Buffer.from('native\n')), 10);
            }
            if (event === 'end') callback(); 
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      }),
    });
  }
}
