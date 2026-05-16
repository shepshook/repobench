import { describe, it, expect } from 'vitest';
import { IDatasetExporter, IDatasetImporter, CandidateExportSchema } from '../../src/core/contracts';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';

describe('IDatasetExporter', () => {
  it('should be implementable by a mock class', () => {
    class MockExporter implements IDatasetExporter {
      async export(path: string): Promise<void> {
        // Mock implementation
      }
    }
    const exporter: IDatasetExporter = new MockExporter();
    expect(exporter).toBeDefined();
  });
});

describe('IDatasetImporter', () => {
  it('should be implementable by a mock class', () => {
    class MockImporter implements IDatasetImporter {
      async import(path: string): Promise<void> {
        // Mock implementation
      }
    }
    const importer: IDatasetImporter = new MockImporter();
    expect(importer).toBeDefined();
  });
});

describe('CandidateExportSchema', () => {
  it('should be defined as a zod schema', () => {
    expect(CandidateExportSchema).toBeDefined();
    expect(typeof CandidateExportSchema.parse).toBe('function');
  });

  it('should validate a correct exported candidate object', () => {
    const candidateId = generateValidUuid();
    const validExport = {
      repository: {
        url: 'https://github.com/example/repo',
        name: 'example-repo',
      },
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
      curation: {
        score: 0.9,
        reasoning: 'This fix addresses the null pointer exception correctly.',
        isApproved: true,
      },
      status: 'validated',
      metadata: {
        candidateId: candidateId,
        createdAt: new Date().toISOString(),
      },
    };
    expect(() => CandidateExportSchema.parse(validExport)).not.toThrow();
  });

  it('should throw an error for missing repository information', () => {
    const candidateId = generateValidUuid();
    const invalidExport = {
      // repository missing
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
      curation: {
        score: 0.9,
        reasoning: '...',
        isApproved: true,
      },
      status: 'validated',
      metadata: {
        candidateId: candidateId,
        createdAt: new Date().toISOString(),
      },
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CandidateExportSchema.parse(invalidExport)).toThrow();
  });

  it('should throw an error for missing preFixHash', () => {
    const candidateId = generateValidUuid();
    const invalidExport = {
      repository: {
        url: 'https://github.com/example/repo',
        name: 'example-repo',
      },
      postFixHash: generateValidHash(), // missing preFixHash
      curation: {
        score: 0.9,
        reasoning: '...',
        isApproved: true,
      },
      status: 'validated',
      metadata: {
        candidateId: candidateId,
        createdAt: new Date().toISOString(),
      },
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CandidateExportSchema.parse(invalidExport)).toThrow();
  });

  it('should throw an error for missing postFixHash', () => {
    const candidateId = generateValidUuid();
    const invalidExport = {
      repository: {
        url: 'https://github.com/example/repo',
        name: 'example-repo',
      },
      preFixHash: generateValidHash(),
      // postFixHash missing
      curation: {
        score: 0.9,
        reasoning: '...',
        isApproved: true,
      },
      status: 'validated',
      metadata: {
        candidateId: candidateId,
        createdAt: new Date().toISOString(),
      },
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CandidateExportSchema.parse(invalidExport)).toThrow();
  });

  it('should throw an error for missing curation data', () => {
    const candidateId = generateValidUuid();
    const invalidExport = {
      repository: {
        url: 'https://github.com/example/repo',
        name: 'example-repo',
      },
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
      status: 'validated',
      // curation missing
      metadata: {
        candidateId: candidateId,
        createdAt: new Date().toISOString(),
      },
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CandidateExportSchema.parse(invalidExport)).toThrow();
  });

  it('should throw an error for missing metadata.candidateId', () => {
    const invalidExport = {
      repository: {
        url: 'https://github.com/example/repo',
        name: 'example-repo',
      },
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
      curation: {
        score: 0.9,
        reasoning: '...',
        isApproved: true,
      },
      status: 'validated',
      metadata: {
        // candidateId missing
        createdAt: new Date().toISOString(),
      },
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CandidateExportSchema.parse(invalidExport)).toThrow();
  });

  it('should throw an error for missing metadata.createdAt', () => {
    const candidateId = generateValidUuid();
    const invalidExport = {
      repository: {
        url: 'https://github.com/example/repo',
        name: 'example-repo',
      },
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
      curation: {
        score: 0.9,
        reasoning: '...',
        isApproved: true,
      },
      status: 'validated',
      metadata: {
        candidateId: candidateId,
        // createdAt missing
      },
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CandidateExportSchema.parse(invalidExport)).toThrow();
  });
});
