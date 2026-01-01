/**
 * Artillery processor for load testing
 * Handles authentication and helper functions
 */

let authToken = null;
let documentRecordIds = [];

module.exports = {
  authenticate,
  createDocumentRecord,
  cleanup,
  beforeScenario,
  afterScenario,
};

/**
 * Authenticate and store token
 */
async function authenticate(context, events, done) {
  const axios = require('axios');

  try {
    const response = await axios.post(
      `${process.env.API_BASE_URL}/auth/login`,
      {
        username: process.env.AUTH_USERNAME,
        password: process.env.AUTH_PASSWORD,
      }
    );

    authToken = response.data.accessToken || response.data.access_token;

    // Set authorization header for subsequent requests
    context.vars.authToken = authToken;

    if (!context.vars.$environment) {
      context.vars.$environment = {};
    }
    context.vars.$environment.Authorization = `Bearer ${authToken}`;

    return done();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return done(error);
  }
}

/**
 * Create a document record for testing
 */
async function createDocumentRecord(context, events, done) {
  const axios = require('axios');

  try {
    const response = await axios.post(
      `${process.env.API_BASE_URL}/api/v1/document-records`,
      {
        code: `PERF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: `Performance Test Document ${Date.now()}`,
        description: 'Created for load testing',
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    context.vars.documentRecordId = response.data.id;
    documentRecordIds.push(response.data.id);

    return done();
  } catch (error) {
    console.error('Failed to create document record:', error.message);
    return done(error);
  }
}

/**
 * Cleanup created resources
 */
async function cleanup(context, events, done) {
  const axios = require('axios');

  if (context.vars.documentRecordId) {
    try {
      await axios.delete(
        `${process.env.API_BASE_URL}/api/v1/document-records/${context.vars.documentRecordId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error.message);
    }
  }

  return done();
}

/**
 * Before scenario hook
 */
function beforeScenario(context, events, done) {
  // Initialize any scenario-specific data
  context.vars.startTime = Date.now();
  return done();
}

/**
 * After scenario hook
 */
function afterScenario(context, events, done) {
  // Log scenario duration
  const duration = Date.now() - context.vars.startTime;
  events.emit('histogram', 'scenario.duration', duration);
  return done();
}
