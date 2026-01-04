---
description: Generate a new API test following project patterns
allowed-tools: Read, Write, Glob, Grep
argument-hint: [endpoint-name] [http-method]
---

## Target
Endpoint: $1
Method: $2

## Steps

1. **Find existing patterns:**
   - Look at similar tests in `tests/integration/`
   - Check test helpers in `src/helpers/`
   - Review API client in `src/api/`

2. **Generate test structure:**
   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest';
   import Joi from 'joi';
   import { faker } from '@faker-js/faker';
   // Import relevant helpers and API clients

   describe('$1', () => {
     // Setup and teardown

     describe('$2 $1', () => {
       it('should return expected response', async () => {
         // Arrange
         // Act
         // Assert with Joi schema validation
       });

       it('should handle error cases', async () => {
         // Test error scenarios
       });
     });
   });
   ```

3. **Include:**
   - Joi schema for response validation
   - Faker for test data generation
   - Proper setup/teardown
   - Both success and error test cases
   - Clear test descriptions

4. **Save to appropriate location:**
   - `tests/integration/` for integration tests
   - `tests/e2e/` for end-to-end tests
