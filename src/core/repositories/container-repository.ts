import { db } from '../../infrastructure/persistence/database';
import { ContainerMetadata } from '../contracts';

export class ContainerRepository {
  save(metadata: ContainerMetadata): void {
    db.run(
      `INSERT INTO containers (container_id, image, created_at, status, labels) 
       VALUES (?, ?, ?, ?, ?) 
       ON CONFLICT(container_id) DO UPDATE SET 
       image=excluded.image, 
       created_at=excluded.created_at, 
       status=excluded.status, 
       labels=excluded.labels`,
      metadata.containerId,
      metadata.image,
      metadata.createdAt,
      metadata.status,
      JSON.stringify(metadata.labels)
    );
  }

  getById(containerId: string): ContainerMetadata | undefined {
    const row = db.prepare('SELECT * FROM containers WHERE container_id = ?').get(containerId) as any;
    if (!row) return undefined;

    return {
      ...row,
      labels: JSON.parse(row.labels),
    };
  }

  getAll(): ContainerMetadata[] {
    const rows = db.prepare('SELECT * FROM containers').all() as any[];
    return rows.map(row => ({
      ...row,
      labels: JSON.parse(row.labels),
    }));
  }

  delete(containerId: string): void {
    db.run('DELETE FROM containers WHERE container_id = ?', containerId);
  }
}
