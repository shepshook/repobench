import { JsonlDatasetImporter } from './src/infrastructure/jsonl-dataset-importer';
import { CandidateRepository } from './src/core/repositories/candidate-repository';
import { initDatabase, getRawDb, reinitDatabase } from './src/infrastructure/persistence/database';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function run() {
  const tempDbPath = path.join(os.tmpdir(), `reproduce-bug-${Date.now()}.db`);
  reinitDatabase(tempDbPath);
  
  const repo = new CandidateRepository();
  const importer = new JsonlDatasetImporter(repo);
  
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const mockData = [
    {
      repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
      preFixHash: 'a'.repeat(40),
      postFixHash: 'b'.repeat(40),
      curation: { score: 0.9, reasoning: 'Good', isApproved: true },
      status: 'validated',
      metadata: { candidateId: id, createdAt: new Date().toISOString() },
    },
  ];
  
  const tempFile = path.join(os.tmpdir(), `reproduce-bug-${Date.now()}.jsonl`);
  await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));
  
  console.log('First import...');
  await importer.import(tempFile);
  console.log('Count after first import:', repo.getAll().length);
  
  console.log('Second import...');
  await importer.import(tempFile);
  console.log('Count after second import:', repo.getAll().length);
  
  await fs.unlink(tempFile);
  await fs.unlink(tempDbPath);
}

run().catch(console.error);
