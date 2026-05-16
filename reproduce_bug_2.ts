import { JsonlDatasetImporter } from './src/infrastructure/jsonl-dataset-importer';
import { CandidateRepository } from './src/core/repositories/candidate-repository';
import { initDatabase, getRawDb, reinitDatabase } from './src/infrastructure/persistence/database';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function run() {
  const tempDbPath = path.join(os.tmpdir(), `reproduce-bug-2-${Date.now()}.db`);
  reinitDatabase(tempDbPath);
  
  const repo = new CandidateRepository();
  const importer = new JsonlDatasetImporter(repo);
  
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const mockData1 = [
    {
      repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
      preFixHash: 'a'.repeat(40),
      postFixHash: 'b'.repeat(40),
      curation: { score: 0.9, reasoning: 'Good', isApproved: true },
      status: 'validated',
      metadata: { candidateId: id, createdAt: new Date().toISOString() },
    },
  ];
  
  const mockData2 = [
    {
      repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
      preFixHash: 'a'.repeat(40),
      postFixHash: 'b'.repeat(40),
      curation: { score: 0.8, reasoning: 'Updated', isApproved: true },
      status: 'curated',
      metadata: { candidateId: id, createdAt: new Date().toISOString() },
    },
  ];
  
  const file1 = path.join(os.tmpdir(), `file1-${Date.now()}.jsonl`);
  const file2 = path.join(os.tmpdir(), `file2-${Date.now()}.jsonl`);
  
  await fs.writeFile(file1, mockData1.map(d => JSON.stringify(d)).join('\n'));
  await fs.writeFile(file2, mockData2.map(d => JSON.stringify(d)).join('\n'));
  
  console.log('Importing file 1...');
  await importer.import(file1);
  console.log('Count:', repo.getAll().length);
  
  console.log('Importing file 2...');
  await importer.import(file2);
  console.log('Count:', repo.getAll().length);
  
  const candidate = repo.getById(id);
  console.log('Candidate status:', candidate?.status);
  console.log('Candidate reasoning:', candidate?.curation?.reasoning);
  
  await fs.unlink(file1);
  await fs.unlink(file2);
  await fs.unlink(tempDbPath);
}

run().catch(console.error);
