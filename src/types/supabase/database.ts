/**
 * Supabase Database Types
 *
 * Type definitions for the test results database schema.
 * These types should be regenerated when the schema changes
 * using: npx supabase gen types typescript
 */

export interface Database {
  public: {
    Tables: {
      test_runs: {
        Row: {
          id: string;
          run_id: string;
          environment: string;
          branch: string | null;
          commit_sha: string | null;
          triggered_by: string | null;
          started_at: string;
          completed_at: string | null;
          status: string;
          total_tests: number | null;
          passed_tests: number | null;
          failed_tests: number | null;
          skipped_tests: number | null;
          duration_ms: number | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          environment: string;
          branch?: string | null;
          commit_sha?: string | null;
          triggered_by?: string | null;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          total_tests?: number | null;
          passed_tests?: number | null;
          failed_tests?: number | null;
          skipped_tests?: number | null;
          duration_ms?: number | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          environment?: string;
          branch?: string | null;
          commit_sha?: string | null;
          triggered_by?: string | null;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          total_tests?: number | null;
          passed_tests?: number | null;
          failed_tests?: number | null;
          skipped_tests?: number | null;
          duration_ms?: number | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      test_results: {
        Row: {
          id: string;
          run_id: string;
          test_id: string;
          test_name: string;
          suite_name: string | null;
          category: string;
          tags: string[] | null;
          status: string;
          duration_ms: number | null;
          error_message: string | null;
          error_stack: string | null;
          assertions_passed: number | null;
          assertions_failed: number | null;
          request_logs: Record<string, unknown> | null;
          response_logs: Record<string, unknown> | null;
          screenshots: string[] | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          test_id: string;
          test_name: string;
          suite_name?: string | null;
          category: string;
          tags?: string[] | null;
          status: string;
          duration_ms?: number | null;
          error_message?: string | null;
          error_stack?: string | null;
          assertions_passed?: number | null;
          assertions_failed?: number | null;
          request_logs?: Record<string, unknown> | null;
          response_logs?: Record<string, unknown> | null;
          screenshots?: string[] | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          test_id?: string;
          test_name?: string;
          suite_name?: string | null;
          category?: string;
          tags?: string[] | null;
          status?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          error_stack?: string | null;
          assertions_passed?: number | null;
          assertions_failed?: number | null;
          request_logs?: Record<string, unknown> | null;
          response_logs?: Record<string, unknown> | null;
          screenshots?: string[] | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      test_configurations: {
        Row: {
          id: string;
          config_name: string;
          environment: string;
          api_base_url: string;
          rate_limit_rpm: number | null;
          timeout_ms: number | null;
          retry_attempts: number | null;
          parallel_workers: number | null;
          feature_flags: Record<string, unknown> | null;
          active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          config_name: string;
          environment: string;
          api_base_url: string;
          rate_limit_rpm?: number | null;
          timeout_ms?: number | null;
          retry_attempts?: number | null;
          parallel_workers?: number | null;
          feature_flags?: Record<string, unknown> | null;
          active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          config_name?: string;
          environment?: string;
          api_base_url?: string;
          rate_limit_rpm?: number | null;
          timeout_ms?: number | null;
          retry_attempts?: number | null;
          parallel_workers?: number | null;
          feature_flags?: Record<string, unknown> | null;
          active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      test_metrics: {
        Row: {
          id: string;
          run_id: string;
          endpoint: string;
          method: string;
          avg_response_time_ms: number | null;
          min_response_time_ms: number | null;
          max_response_time_ms: number | null;
          p95_response_time_ms: number | null;
          p99_response_time_ms: number | null;
          request_count: number | null;
          error_count: number | null;
          error_rate: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          endpoint: string;
          method: string;
          avg_response_time_ms?: number | null;
          min_response_time_ms?: number | null;
          max_response_time_ms?: number | null;
          p95_response_time_ms?: number | null;
          p99_response_time_ms?: number | null;
          request_count?: number | null;
          error_count?: number | null;
          error_rate?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          endpoint?: string;
          method?: string;
          avg_response_time_ms?: number | null;
          min_response_time_ms?: number | null;
          max_response_time_ms?: number | null;
          p95_response_time_ms?: number | null;
          p99_response_time_ms?: number | null;
          request_count?: number | null;
          error_count?: number | null;
          error_rate?: number | null;
          created_at?: string;
        };
      };
      flaky_tests: {
        Row: {
          id: string;
          test_id: string;
          test_name: string;
          flake_count: number | null;
          last_flake_at: string;
          first_flake_at: string;
          flake_history: Record<string, unknown> | null;
          resolved: boolean | null;
          resolved_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          test_id: string;
          test_name: string;
          flake_count?: number | null;
          last_flake_at?: string;
          first_flake_at?: string;
          flake_history?: Record<string, unknown> | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          test_id?: string;
          test_name?: string;
          flake_count?: number | null;
          last_flake_at?: string;
          first_flake_at?: string;
          flake_history?: Record<string, unknown> | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      test_reports: {
        Row: {
          id: string;
          run_id: string;
          report_type: string;
          format: string;
          storage_path: string | null;
          public_url: string | null;
          generated_at: string;
          expires_at: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          report_type: string;
          format: string;
          storage_path?: string | null;
          public_url?: string | null;
          generated_at?: string;
          expires_at?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          report_type?: string;
          format?: string;
          storage_path?: string | null;
          public_url?: string | null;
          generated_at?: string;
          expires_at?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

export default Database;
