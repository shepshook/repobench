import fs from 'node:fs/promises';
import { IDatasetImporter, ICandidateRepository, CandidateExportSchema, Candidate } from '../core/contracts.js';

export class JsonlDatasetImporter implements IDatasetImporter {
  constructor(private repo: ICandidateRepository) {}

  async import(path: string): Promise<number> {
      let importedCount = 0;
      const seenIds = new Set<string>();
      try {
        const content = await fs.readFile(path, { encoding: 'utf8' });
       if (!content.trim()) {
         return 0;
       }
   
         const lines = content.split('\n').filter(line => line.trim());
    
         for (const line of lines) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed = JSON.parse(line);
         const exportValidation = CandidateExportSchema.safeParse(parsed);
 
         if (!exportValidation.success) {
           throw new Error(`Invalid JSONL line schema: ${exportValidation.error.message}`);
         }
 
          const exportData = exportValidation.data;
          const hash = exportData.postFixHash;

          const candidateId = exportData.metadata.candidateId;

          if (seenIds.has(candidateId)) {
            continue;
          }
          seenIds.add(candidateId);

          const existing = this.repo.getById(candidateId);
          
          const candidateData: Candidate = {
            id: candidateId,
            hash: hash,
            message: existing?.message || '',
            files: existing?.files || [],
             status: exportData.status,
            created_at: new Date(exportData.metadata.createdAt),
            repositoryUrl: exportData.repository.url,
            repositoryName: exportData.repository.name,
            preFixHash: exportData.preFixHash,
            postFixHash: exportData.postFixHash,
            curation: exportData.curation,
          };
  
    
           this.repo.upsert(candidateData);
          importedCount++;
        }


       return importedCount;
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     } catch (error: any) {
        if (error instanceof SyntaxError) {
          throw new Error(`Malformed JSONL file: ${error.message}`, { cause: error });
       }
       throw error;
     }
   }
}
