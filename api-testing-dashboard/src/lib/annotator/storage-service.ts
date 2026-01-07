/**
 * Storage Service - Abstracted file storage for annotator app
 *
 * Currently implements Supabase Storage.
 * Can be swapped to Google Drive, S3, or other providers by implementing
 * the StorageService interface.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface StorageService {
  upload(file: File | Blob, path: string): Promise<string>;
  download(path: string): Promise<Blob>;
  getUrl(path: string): Promise<string>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
}

// ----------------------------------------------------------------------------
// Supabase Storage Implementation
// ----------------------------------------------------------------------------

const BUCKET_NAME = 'annotator-files';

class SupabaseStorageService implements StorageService {
  private supabase: SupabaseClient;
  private initialized = false;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Use service role key for storage operations (bypasses RLS)
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Initialize the storage bucket if it doesn't exist
   */
  private async ensureBucket(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

      if (!bucketExists) {
        // Create bucket - this requires admin privileges
        // In production, create the bucket via Supabase dashboard or migrations
        console.warn(
          `Bucket "${BUCKET_NAME}" does not exist. Please create it in Supabase dashboard.`
        );
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error checking storage bucket:', error);
    }
  }

  /**
   * Upload a file to storage
   * @param file - File or Blob to upload
   * @param path - Storage path (e.g., "training/{userId}/{pairId}_original.docx")
   * @returns The storage path
   */
  async upload(file: File | Blob, path: string): Promise<string> {
    await this.ensureBucket();

    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    return data.path;
  }

  /**
   * Download a file from storage
   * @param path - Storage path
   * @returns File contents as Blob
   */
  async download(path: string): Promise<Blob> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error) {
      throw new Error(`Download failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a signed URL for a file (valid for 1 hour)
   * @param path - Storage path
   * @returns Signed URL
   */
  async getUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      throw new Error(`Failed to get URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete a file from storage
   * @param path - Storage path
   */
  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Check if a file exists
   * @param path - Storage path
   * @returns true if file exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      // Try to get metadata by listing the specific path
      const pathParts = path.split('/');
      const fileName = pathParts.pop() || '';
      const folder = pathParts.join('/');

      const { data, error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .list(folder, {
          search: fileName,
          limit: 1,
        });

      if (error) return false;
      return data.some((file) => file.name === fileName);
    } catch {
      return false;
    }
  }
}

// ----------------------------------------------------------------------------
// Factory and Singleton
// ----------------------------------------------------------------------------

let storageServiceInstance: StorageService | null = null;

/**
 * Get the storage service instance (singleton)
 */
export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new SupabaseStorageService();
  }
  return storageServiceInstance;
}

/**
 * Set a custom storage service (for testing or switching providers)
 */
export function setStorageService(service: StorageService): void {
  storageServiceInstance = service;
}

// ----------------------------------------------------------------------------
// Path Helpers
// ----------------------------------------------------------------------------

/**
 * Generate storage path for a training document
 */
export function getTrainingDocPath(
  userId: string,
  pairId: string,
  type: 'original' | 'annotated'
): string {
  return `training/${userId}/${pairId}_${type}.docx`;
}

/**
 * Generate storage path for a session document
 */
export function getSessionDocPath(
  userId: string,
  sessionId: string,
  type: 'input' | 'output'
): string {
  return `sessions/${userId}/${sessionId}_${type}.docx`;
}

// ----------------------------------------------------------------------------
// Export default instance
// ----------------------------------------------------------------------------

export const storageService = {
  get instance() {
    return getStorageService();
  },
  upload: (file: File | Blob, path: string) => getStorageService().upload(file, path),
  download: (path: string) => getStorageService().download(path),
  getUrl: (path: string) => getStorageService().getUrl(path),
  delete: (path: string) => getStorageService().delete(path),
  exists: (path: string) => getStorageService().exists(path),
};
