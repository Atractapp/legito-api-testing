/**
 * AI Chat API Route
 * Supports multiple AI providers (OpenAI, Anthropic Claude, Google Gemini)
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

type AIProvider = 'openai' | 'anthropic' | 'google';

// Get AI model based on provider
function getModel(provider: AIProvider, apiKey: string) {
  switch (provider) {
    case 'openai': {
      const client = createOpenAI({ apiKey });
      return client('gpt-4o-mini');
    }
    case 'anthropic': {
      const client = createAnthropic({ apiKey });
      return client('claude-sonnet-4-20250514');
    }
    case 'google': {
      const client = createGoogleGenerativeAI({ apiKey });
      return client('models/gemini-2.0-flash');
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages || [];

    // Get AI provider settings from headers
    const provider = (request.headers.get('X-AI-Provider') || 'google') as AIProvider;
    const aiApiKey = request.headers.get('X-AI-API-Key');

    if (!aiApiKey) {
      return new Response(
        JSON.stringify({ error: `API key required for ${provider}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const model = getModel(provider, aiApiKey);

    // Use generateText for non-streaming response (simpler, more reliable)
    // maxRetries: 0 to avoid burning quota on failed attempts
    const { text } = await generateText({
      model,
      system: 'You are a helpful AI assistant. Be concise and helpful.',
      messages,
      maxRetries: 0,
    });

    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `AI Provider Error: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
