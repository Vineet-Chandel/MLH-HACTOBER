import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let clientInstance = null;

/**
 * Returns the configured GoogleGenAI client instance.
 * Lazily instantiated to ensure environment variables are loaded.
 */
export function getGemmaClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in server/.env');
  }

  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey });
  }

  return clientInstance;
}

/**
 * Returns the configured Gemma model identifier.
 */
export function getGemmaModel() {
  return process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
}

/**
 * Helper to generate text using the configured Gemma model.
 * @param {string|Array} contents
 * @param {Object} [config]
 */
export async function generateContent(contents, config = {}) {
  const ai = getGemmaClient();
  const model = getGemmaModel();

  return await ai.models.generateContent({
    model,
    contents,
    config,
  });
}
