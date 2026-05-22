import fs from 'node:fs/promises';
import { IDatasetExporter, ICandidateRepository, CandidateExportSchema } from '../core/contracts.js';

export class JsonlDatasetExporter implements IDatasetExporter {
  constructor(private repo: ICandidateRepository) {}

    async export(path: string): Promise<number> {
      try {
         const candidates = this.repo.getAll();
         
         const lines: string[] = [];
         for (const c of candidates) {
           // Basic filter
           if (c.status !== 'curated' || c.curation?.isApproved !== true) {
             continue;
           }

           const exportData = {
             repository: {
               url: c.repositoryUrl,
               name: c.repositoryName,
             },
             preFixHash: c.preFixHash,
             postFixHash: c.postFixHash,
             curation: c.curation,
             status: c.status,
             metadata: {
               candidateId: c.id,
               createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : new Date(c.created_at).toISOString(),
             },
           };
     
           const validation = CandidateExportSchema.safeParse(exportData);
           if (validation.success) {
             lines.push(JSON.stringify(validation.data));
           } else {
             // Silently ignore candidates that do not meet the export schema requirements
           }
         }
     
         await fs.writeFile(path, lines.join('\n') + (lines.length > 0 ? '\n' : ''), { encoding: 'utf8' });
         return lines.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`Failed to export dataset to ${path}: ${error.message}`, { cause: error });
      }
    }
}
