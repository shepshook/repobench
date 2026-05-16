import crypto from 'node:crypto';

export const generateValidUuid = () => crypto.randomUUID();
export const generateValidHash = () => crypto.randomBytes(20).toString('hex');

export const generateValidCandidateMetadata = () => ({
  candidateId: generateValidUuid(),
  createdAt: new Date().toISOString(),
});

export const generateValidRepository = (name = 'test-repo', url = 'https://github.com/user/test-repo') => ({
  name,
  url,
});
