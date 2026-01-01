/**
 * API Testing Platform - Context Management Service
 * Handles all context creation, retrieval, updating, and cleanup operations
 */

import {
  TestExecutionContext,
  TestRun,
  SingleTestExecutionContext,
  DependencyContext,
  AssertionContext,
  AggregatedContext,
  RequestContext,
  ResponseContext,
  TestStatus,
  ContextManagementError,
  ActiveRunMemory,
  TestCase,
  TestDependency,
  TestResult,
  EnvironmentVariable,
} from './02_context_management_types';
import { createClient } from '@supabase/supabase-js';

/**
 * Central context management service
 * Manages all aspects of test execution context
 */
export class TestExecutionContextManager {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // In-memory cache for active runs
  private activeRunCache = new Map<string, ActiveRunMemory>();

  // Context size limits
  private readonly MAX_CONTEXT_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_SHARED_VARIABLES = 1000;
  private readonly MAX_CAPTURED_DATA = 5000;
  private readonly CONTEXT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Initialize cleanup job for expired contexts
    this.initializeCleanupJob();
  }

  // ========================================================================
  // CONTEXT INITIALIZATION
  // ========================================================================

  /**
   * Create initial test execution context for a test run
   */
  async initializeTestRunContext(
    runId: string,
    projectId: string,
    environmentId: string
  ): Promise<TestExecutionContext> {
    try {
      const { data, error } = await this.supabase
        .from('test_execution_context')
        .insert({
          run_id: runId,
          shared_auth_tokens: {},
          shared_variables: {},
          captured_data: {},
          test_order: [],
        })
        .select()
        .single();

      if (error) throw error;

      // Cache in memory
      this.activeRunCache.set(runId, {
        runId,
        context: data,
        lastAccessedAt: new Date(),
        accessCount: 1,
        memoryUsage: this.estimateMemoryUsage(data),
      });

      return data;
    } catch (error) {
      throw new ContextManagementError(
        'initializeTestRunContext',
        `Failed to initialize context for run ${runId}`,
        error
      );
    }
  }

  /**
   * Retrieve existing test execution context
   */
  async getTestRunContext(runId: string): Promise<TestExecutionContext | null> {
    try {
      // Check memory cache first
      const cached = this.activeRunCache.get(runId);
      if (cached) {
        cached.lastAccessedAt = new Date();
        cached.accessCount++;
        return cached.context;
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('test_execution_context')
        .select('*')
        .eq('run_id', runId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Cache in memory
        this.activeRunCache.set(runId, {
          runId,
          context: data,
          lastAccessedAt: new Date(),
          accessCount: 1,
          memoryUsage: this.estimateMemoryUsage(data),
        });
      }

      return data || null;
    } catch (error) {
      throw new ContextManagementError(
        'getTestRunContext',
        `Failed to retrieve context for run ${runId}`,
        error
      );
    }
  }

  // ========================================================================
  // CONTEXT UPDATING
  // ========================================================================

  /**
   * Update shared authentication tokens in context
   */
  async updateSharedAuthTokens(
    runId: string,
    tokens: Record<string, string>
  ): Promise<TestExecutionContext> {
    try {
      const context = await this.getTestRunContext(runId);
      if (!context) {
        throw new Error(`Context not found for run ${runId}`);
      }

      const updatedTokens = {
        ...context.shared_auth_tokens,
        ...tokens,
      };

      this.validateContextSize(updatedTokens);

      const { data, error } = await this.supabase
        .from('test_execution_context')
        .update({
          shared_auth_tokens: updatedTokens,
          updated_at: new Date(),
        })
        .eq('run_id', runId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      if (this.activeRunCache.has(runId)) {
        const cached = this.activeRunCache.get(runId)!;
        cached.context = data;
        cached.memoryUsage = this.estimateMemoryUsage(data);
      }

      return data;
    } catch (error) {
      throw new ContextManagementError(
        'updateSharedAuthTokens',
        `Failed to update auth tokens for run ${runId}`,
        error
      );
    }
  }

  /**
   * Update shared variables across test execution
   */
  async updateSharedVariables(
    runId: string,
    variables: Record<string, any>
  ): Promise<TestExecutionContext> {
    try {
      const context = await this.getTestRunContext(runId);
      if (!context) {
        throw new Error(`Context not found for run ${runId}`);
      }

      const updatedVariables = {
        ...context.shared_variables,
        ...variables,
      };

      if (Object.keys(updatedVariables).length > this.MAX_SHARED_VARIABLES) {
        throw new Error(
          `Exceeded maximum shared variables limit: ${this.MAX_SHARED_VARIABLES}`
        );
      }

      this.validateContextSize(updatedVariables);

      const { data, error } = await this.supabase
        .from('test_execution_context')
        .update({
          shared_variables: updatedVariables,
          updated_at: new Date(),
        })
        .eq('run_id', runId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      if (this.activeRunCache.has(runId)) {
        const cached = this.activeRunCache.get(runId)!;
        cached.context = data;
        cached.memoryUsage = this.estimateMemoryUsage(data);
      }

      return data;
    } catch (error) {
      throw new ContextManagementError(
        'updateSharedVariables',
        `Failed to update shared variables for run ${runId}`,
        error
      );
    }
  }

  /**
   * Capture variables from test response
   */
  async captureVariablesFromResponse(
    runId: string,
    testCaseId: string,
    responseBody: any,
    captureSpec: Record<string, string>
  ): Promise<Record<string, any>> {
    try {
      const captured: Record<string, any> = {};

      for (const [varName, jsonPath] of Object.entries(captureSpec)) {
        const value = this.extractValueFromPath(responseBody, jsonPath);
        if (value !== undefined) {
          captured[varName] = value;
        }
      }

      // Update context with captured data
      const context = await this.getTestRunContext(runId);
      if (!context) {
        throw new Error(`Context not found for run ${runId}`);
      }

      const updatedCapturedData = {
        ...context.captured_data,
        [testCaseId]: captured,
      };

      if (Object.keys(updatedCapturedData).length > this.MAX_CAPTURED_DATA) {
        throw new Error(
          `Exceeded maximum captured data limit: ${this.MAX_CAPTURED_DATA}`
        );
      }

      const { data, error } = await this.supabase
        .from('test_execution_context')
        .update({
          captured_data: updatedCapturedData,
          updated_at: new Date(),
        })
        .eq('run_id', runId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      if (this.activeRunCache.has(runId)) {
        const cached = this.activeRunCache.get(runId)!;
        cached.context = data;
      }

      return captured;
    } catch (error) {
      throw new ContextManagementError(
        'captureVariablesFromResponse',
        `Failed to capture variables from response for run ${runId}`,
        error
      );
    }
  }

  /**
   * Update test execution order in context
   */
  async updateTestExecutionOrder(
    runId: string,
    testIds: string[]
  ): Promise<TestExecutionContext> {
    try {
      const { data, error } = await this.supabase
        .from('test_execution_context')
        .update({
          test_order: testIds,
          updated_at: new Date(),
        })
        .eq('run_id', runId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      if (this.activeRunCache.has(runId)) {
        const cached = this.activeRunCache.get(runId)!;
        cached.context = data;
      }

      return data;
    } catch (error) {
      throw new ContextManagementError(
        'updateTestExecutionOrder',
        `Failed to update test execution order for run ${runId}`,
        error
      );
    }
  }

  // ========================================================================
  // DEPENDENCY RESOLUTION
  // ========================================================================

  /**
   * Resolve dependencies for a test case
   */
  async resolveDependencies(testCaseId: string): Promise<DependencyContext> {
    try {
      // Get all dependencies for this test
      const { data: dependencies, error } = await this.supabase
        .from('test_dependencies')
        .select('*')
        .eq('dependent_test_id', testCaseId);

      if (error) throw error;

      // Get execution chain
      const executionChain = await this.getExecutionChain(testCaseId);

      // Determine required variables
      const requiredVariables: Record<string, string> = {};
      for (const dep of dependencies || []) {
        if (dep.dependency_type === 'data' || dep.dependency_type === 'token') {
          // This would be determined by the test configuration
          requiredVariables[`test_${dep.required_test_id}`] =
            dep.dependency_type;
        }
      }

      return {
        testId: testCaseId,
        dependencies: dependencies || [],
        executionChain,
        requiredVariables,
        isReady: (dependencies || []).length === 0 || executionChain.length > 0,
      };
    } catch (error) {
      throw new ContextManagementError(
        'resolveDependencies',
        `Failed to resolve dependencies for test ${testCaseId}`,
        error
      );
    }
  }

  /**
   * Get execution chain for dependent tests
   */
  async getExecutionChain(testCaseId: string): Promise<string[]> {
    try {
      // Use the PostgreSQL function to get the chain
      const { data, error } = await this.supabase.rpc(
        'get_test_execution_chain',
        { test_id: testCaseId }
      );

      if (error) throw error;

      return (data || [])
        .sort((a: any, b: any) => a.test_order - b.test_order)
        .map((item: any) => item.test_id);
    } catch (error) {
      throw new ContextManagementError(
        'getExecutionChain',
        `Failed to get execution chain for test ${testCaseId}`,
        error
      );
    }
  }

  // ========================================================================
  // ASSERTION CONTEXT
  // ========================================================================

  /**
   * Create assertion context from test result
   */
  async createAssertionContext(
    testResultId: string,
    responseBody: any,
    responseHeaders: Record<string, string | string[]>,
    statusCode: number,
    variables: Record<string, any>,
    captureVars: Record<string, string>
  ): Promise<AssertionContext> {
    return {
      testResultId,
      responseBody,
      responseHeaders,
      statusCode,
      variables,
      captureVars,
    };
  }

  // ========================================================================
  // AGGREGATED CONTEXT
  // ========================================================================

  /**
   * Create aggregated context for batch operations
   */
  async createAggregatedContext(
    runId: string,
    testCaseIds: string[]
  ): Promise<AggregatedContext> {
    try {
      const context = await this.getTestRunContext(runId);
      if (!context) {
        throw new Error(`Context not found for run ${runId}`);
      }

      const aggregated: AggregatedContext = {
        runId,
        testResults: new Map(),
        executionContexts: new Map(),
        sharedTokens: new Map(Object.entries(context.shared_auth_tokens)),
        sharedVariables: new Map(Object.entries(context.shared_variables)),
        metadata: {},
      };

      // Fetch all results for the test cases
      const { data: results, error } = await this.supabase
        .from('test_results')
        .select('*')
        .eq('run_id', runId)
        .in('test_case_id', testCaseIds);

      if (error) throw error;

      for (const result of results || []) {
        aggregated.testResults.set(result.test_case_id, result);
      }

      return aggregated;
    } catch (error) {
      throw new ContextManagementError(
        'createAggregatedContext',
        `Failed to create aggregated context for run ${runId}`,
        error
      );
    }
  }

  // ========================================================================
  // ENVIRONMENT VARIABLES
  // ========================================================================

  /**
   * Get environment variables and merge with context
   */
  async getEnvironmentContext(environmentId: string): Promise<Record<string, any>> {
    try {
      const { data, error } = await this.supabase
        .from('environment_variables')
        .select('key, value, is_secret')
        .eq('environment_id', environmentId);

      if (error) throw error;

      const envContext: Record<string, any> = {};
      for (const variable of data || []) {
        // Don't expose secrets in the context, just keys
        envContext[variable.key] = variable.is_secret ? '***REDACTED***' : variable.value;
      }

      return envContext;
    } catch (error) {
      throw new ContextManagementError(
        'getEnvironmentContext',
        `Failed to get environment context for environment ${environmentId}`,
        error
      );
    }
  }

  /**
   * Get secret environment variable value
   */
  async getSecretVariable(environmentId: string, key: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('environment_variables')
        .select('value')
        .eq('environment_id', environmentId)
        .eq('key', key)
        .eq('is_secret', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data?.value || null;
    } catch (error) {
      throw new ContextManagementError(
        'getSecretVariable',
        `Failed to get secret variable ${key}`,
        error
      );
    }
  }

  // ========================================================================
  // CONTEXT CLEANUP & EXPIRATION
  // ========================================================================

  /**
   * Clean up old test execution contexts
   */
  async cleanupExpiredContexts(): Promise<number> {
    try {
      const expirationTime = new Date(Date.now() - this.CONTEXT_TTL);

      const { error } = await this.supabase
        .from('test_execution_context')
        .delete()
        .lt('updated_at', expirationTime);

      if (error) throw error;

      // Clear from memory cache
      for (const [runId, memory] of this.activeRunCache.entries()) {
        if (memory.lastAccessedAt < expirationTime) {
          this.activeRunCache.delete(runId);
        }
      }

      return this.activeRunCache.size;
    } catch (error) {
      throw new ContextManagementError(
        'cleanupExpiredContexts',
        'Failed to cleanup expired contexts',
        error
      );
    }
  }

  /**
   * Clear context for a completed run
   */
  async clearRunContext(runId: string): Promise<void> {
    try {
      // Don't delete from database, just mark as archived
      // Contexts are kept for history/debugging

      // Remove from memory cache
      this.activeRunCache.delete(runId);
    } catch (error) {
      throw new ContextManagementError(
        'clearRunContext',
        `Failed to clear context for run ${runId}`,
        error
      );
    }
  }

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Extract value from JSON path
   */
  private extractValueFromPath(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indices like items[0]
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        current = current[arrayKey]?.[parseInt(index)];
      } else {
        current = current[key];
      }
    }

    return current;
  }

  /**
   * Estimate memory usage of context
   */
  private estimateMemoryUsage(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return jsonString.length * 2; // UTF-16 encoding
  }

  /**
   * Validate context size
   */
  private validateContextSize(context: any): void {
    const size = this.estimateMemoryUsage(context);
    if (size > this.MAX_CONTEXT_SIZE) {
      throw new Error(
        `Context size ${size} exceeds maximum allowed size ${this.MAX_CONTEXT_SIZE}`
      );
    }
  }

  /**
   * Initialize cleanup job
   */
  private initializeCleanupJob(): void {
    // Run cleanup every 6 hours
    setInterval(() => {
      this.cleanupExpiredContexts().catch((error) => {
        console.error('Error during context cleanup:', error);
      });
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Get cache statistics
   */
  getMemoryStats(): {
    cachedRuns: number;
    totalMemoryUsage: number;
    averageAccessCount: number;
  } {
    let totalMemory = 0;
    let totalAccess = 0;

    for (const memory of this.activeRunCache.values()) {
      totalMemory += memory.memoryUsage;
      totalAccess += memory.accessCount;
    }

    return {
      cachedRuns: this.activeRunCache.size,
      totalMemoryUsage: totalMemory,
      averageAccessCount: this.activeRunCache.size > 0 ? totalAccess / this.activeRunCache.size : 0,
    };
  }
}

/**
 * Request builder with context injection
 */
export class ContextAwareRequestBuilder {
  constructor(
    private contextManager: TestExecutionContextManager,
    private environmentId: string
  ) {}

  /**
   * Build request with context variables
   */
  async buildRequest(
    endpoint: string,
    requestConfig: any,
    context: TestExecutionContext
  ): Promise<RequestContext> {
    // Replace variables in endpoint
    const resolvedEndpoint = this.replaceVariables(endpoint, context.shared_variables);

    // Get environment variables
    const envVars = await this.contextManager.getEnvironmentContext(this.environmentId);

    // Merge headers with context
    const headers = {
      ...requestConfig.headers,
      ...this.getAuthHeader(context.shared_auth_tokens),
    };

    // Replace variables in headers, body, params
    const body = requestConfig.body
      ? this.replaceVariablesInObject(requestConfig.body, context.shared_variables)
      : undefined;

    const queryParams = requestConfig.queryParams
      ? this.replaceVariablesInObject(
          requestConfig.queryParams,
          context.shared_variables
        )
      : {};

    return {
      method: requestConfig.method,
      url: `${resolvedEndpoint}?${new URLSearchParams(queryParams).toString()}`,
      headers,
      body,
      timeout: requestConfig.timeout,
    };
  }

  /**
   * Replace variables in string
   */
  private replaceVariables(str: string, variables: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? String(variables[varName]) : match;
    });
  }

  /**
   * Replace variables in object recursively
   */
  private replaceVariablesInObject(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, variables);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replaceVariablesInObject(item, variables));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceVariablesInObject(value, variables);
      }
      return result;
    }

    return obj;
  }

  /**
   * Get authentication header from context
   */
  private getAuthHeader(tokens: Record<string, string>): Record<string, string> {
    const authHeader: Record<string, string> = {};

    for (const [tokenName, tokenValue] of Object.entries(tokens)) {
      if (tokenName.includes('bearer') || tokenName.includes('access')) {
        authHeader['Authorization'] = `Bearer ${tokenValue}`;
      } else if (tokenName.includes('api') || tokenName.includes('key')) {
        authHeader['X-API-Key'] = tokenValue;
      }
    }

    return authHeader;
  }
}
