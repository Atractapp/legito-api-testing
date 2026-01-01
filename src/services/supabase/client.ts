/**
 * Supabase Client Configuration
 *
 * Centralized Supabase client setup for test results storage,
 * configuration management, and report generation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase/database';

/**
 * Supabase client configuration
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  options?: {
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    detectSessionInUrl?: boolean;
  };
}

/**
 * Singleton Supabase client instance
 */
let supabaseClient: SupabaseClient<Database> | null = null;
let supabaseServiceClient: SupabaseClient<Database> | null = null;

/**
 * Get or create the Supabase client (anon key - for RLS-protected operations)
 */
export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = config?.url ?? process.env.SUPABASE_URL;
  const anonKey = config?.anonKey ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase URL and anon key are required. ' +
      'Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
    );
  }

  supabaseClient = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: config?.options?.autoRefreshToken ?? true,
      persistSession: config?.options?.persistSession ?? false,
      detectSessionInUrl: config?.options?.detectSessionInUrl ?? false,
    },
  });

  return supabaseClient;
}

/**
 * Get or create the Supabase service client (service role - bypasses RLS)
 */
export function getSupabaseServiceClient(config?: SupabaseConfig): SupabaseClient<Database> {
  if (supabaseServiceClient) {
    return supabaseServiceClient;
  }

  const url = config?.url ?? process.env.SUPABASE_URL;
  const serviceRoleKey = config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase URL and service role key are required for service client. ' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  supabaseServiceClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseServiceClient;
}

/**
 * Reset clients (useful for testing)
 */
export function resetSupabaseClients(): void {
  supabaseClient = null;
  supabaseServiceClient = null;
}

/**
 * Health check for Supabase connection
 */
export async function checkSupabaseConnection(client: SupabaseClient<Database>): Promise<boolean> {
  try {
    const { error } = await client.from('test_runs').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Supabase client wrapper with convenience methods
 */
export class SupabaseWrapper {
  private client: SupabaseClient<Database>;
  private serviceClient?: SupabaseClient<Database>;

  constructor(config: SupabaseConfig) {
    this.client = getSupabaseClient(config);
    if (config.serviceRoleKey) {
      this.serviceClient = getSupabaseServiceClient(config);
    }
  }

  /**
   * Get the regular client (with RLS)
   */
  getClient(): SupabaseClient<Database> {
    return this.client;
  }

  /**
   * Get the service client (bypasses RLS)
   */
  getServiceClient(): SupabaseClient<Database> {
    if (!this.serviceClient) {
      throw new Error('Service client not configured. Provide serviceRoleKey in config.');
    }
    return this.serviceClient;
  }

  /**
   * Check connection health
   */
  async isHealthy(): Promise<boolean> {
    return checkSupabaseConnection(this.client);
  }

  /**
   * Execute a transaction-like operation (best effort, not true transactions)
   */
  async executeWithRollback<T>(
    operation: (client: SupabaseClient<Database>) => Promise<T>,
    rollback: (client: SupabaseClient<Database>) => Promise<void>
  ): Promise<T> {
    try {
      return await operation(this.client);
    } catch (error) {
      try {
        await rollback(this.client);
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      throw error;
    }
  }
}

export default {
  getSupabaseClient,
  getSupabaseServiceClient,
  resetSupabaseClients,
  checkSupabaseConnection,
  SupabaseWrapper,
};
