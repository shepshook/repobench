import { db } from '../../infrastructure/persistence/database';
import { ContainerMetadata } from '../contracts';

interface ContainerRow {
  containerId: string;
  image: string;
  createdAt: string;
  status: string;
  labels: string;
}

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
      JSON.stringify(metadata.labels),
    );
  }

  getById(containerId: string): ContainerMetadata | undefined {
    const row = db.prepare<ContainerRow>('SELECT * FROM containers WHERE container_id = ?').get(containerId);
    if (!row) return undefined;

    return {
      containerId: row.containerId,
      image: row.image,
      createdAt: row.createdAt,
      status: row.status,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      labels: JSON.parse(row.labels),
    };
  }

  getAll(): ContainerMetadata[] {
    const rows = db.prepare<ContainerRow>('SELECT * FROM containers').all();
    return rows.map(row => ({
      containerId: row.containerId,
      image: row.image,
      createdAt: row.createdAt,
      status: row.status,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      labels: JSON.parse(row.labels),
    }));
  }

  delete(containerId: string): void {
    db.run('DELETE FROM containers WHERE container_id = ?', containerId);
  }
}
