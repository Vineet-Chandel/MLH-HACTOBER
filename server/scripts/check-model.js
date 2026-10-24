import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { getGemmaClient, getGemmaModel } from '../src/services/gemma.js';

// Ensure server/.env is loaded relative to script path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkModel() {
  const targetModel = getGemmaModel();
  console.log(`[check-model] Checking models available to configured API key...`);
  console.log(`[check-model] Target model: ${targetModel}`);

  try {
    const ai = getGemmaClient();
    const listResponse = await ai.models.list();

    const modelNames = [];
    if (listResponse && Symbol.asyncIterator in listResponse) {
      for await (const m of listResponse) {
        if (m?.name) modelNames.push(m.name);
      }
    } else if (Array.isArray(listResponse)) {
      for (const m of listResponse) {
        if (m?.name) modelNames.push(m.name);
      }
    } else if (listResponse?.models && Array.isArray(listResponse.models)) {
      for (const m of listResponse.models) {
        if (m?.name) modelNames.push(m.name);
      }
    }

    console.log(`\n[check-model] Available Models (${modelNames.length} total):`);
    for (const name of modelNames) {
      console.log(`  - ${name}`);
    }

    // Check if target model appears (matches exact, stripped 'models/' prefix, or substring)
    const normalizedTarget = targetModel.replace(/^models\//, '');
    const isFound = modelNames.some(
      (m) =>
        m === targetModel ||
        m === `models/${targetModel}` ||
        m.replace(/^models\//, '') === normalizedTarget
    );

    console.log('\n--- MODEL VERIFICATION RESULT ---');
    if (isFound) {
      console.log(`PASS: GEMMA_MODEL "${targetModel}" is available to your key.`);
      process.exit(0);
    } else {
      console.error(`FAIL: GEMMA_MODEL "${targetModel}" was not found in the list of available models.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n--- MODEL CHECK ERROR ---');
    console.error(error?.message || error);
    process.exit(1);
  }
}

checkModel();
