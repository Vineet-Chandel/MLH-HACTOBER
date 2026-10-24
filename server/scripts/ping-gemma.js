import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { getGemmaClient, getGemmaModel } from '../src/services/gemma.js';

// Ensure server/.env is loaded relative to script path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Minimal 1x1 red PNG base64 for vision/multimodal testing
const SAMPLE_1X1_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function pingGemma() {
  const model = getGemmaModel();
  console.log(`=================================================`);
  console.log(`  LinkSleuth Gemma 4 Capability Verification`);
  console.log(`  Target Model: ${model}`);
  console.log(`=================================================\n`);

  let textPass = false;
  let imagePass = false;
  let jsonPass = false;

  const ai = getGemmaClient();

  // Small delay helper between API requests to avoid rate limit spikes
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Text Prompt Verification
  console.log(`[Test 1/3] Sending short text prompt to ${model}...`);
  try {
    const textRes = await ai.models.generateContent({
      model,
      contents: 'Hello Gemma! Confirm you are online in 5 words or fewer.',
    });

    const reply = textRes.text?.trim();
    console.log(`[Test 1/3] Text Prompt Response:\n"${reply}"\n`);
    textPass = Boolean(reply && reply.length > 0);
  } catch (error) {
    console.error(`[Test 1/3] Text Prompt FAILED with error:`);
    console.error(error?.message || error);
  }

  await sleep(1000);

  // 2. Multimodal / Image Input Verification
  console.log(`[Test 2/3] Testing image input support with a sample inline PNG...`);
  try {
    const imageRes = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Describe the color of this small sample image in 5 words or fewer.' },
            {
              inlineData: {
                mimeType: 'image/png',
                data: SAMPLE_1X1_PNG,
              },
            },
          ],
        },
      ],
    });

    const imageReply = imageRes.text?.trim();
    console.log(`[Test 2/3] Image Input Response:\n"${imageReply}"\n`);
    imagePass = Boolean(imageReply && imageReply.length > 0);
  } catch (error) {
    console.error(`[Test 2/3] Image Input FAILED with error:`);
    console.error(error?.message || error);
  }

  await sleep(1000);

  // 3. Structured JSON Output Verification
  console.log(`[Test 3/3] Testing structured JSON mode support...`);
  try {
    const jsonRes = await ai.models.generateContent({
      model,
      contents:
        'Return a JSON object with keys "verified" (boolean true) and "status" (string "operational").',
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonText = jsonRes.text?.trim();
    console.log(`[Test 3/3] Raw JSON Output:\n${jsonText}`);
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === 'object') {
      jsonPass = true;
      console.log(`[Test 3/3] Parsed JSON Successfully:`, parsed, '\n');
    }
  } catch (error) {
    console.error(`[Test 3/3] Structured JSON mode FAILED with error:`);
    console.error(error?.message || error);
  }

  console.log(`=================================================`);
  console.log(`  Gemma 4 Verification Summary`);
  console.log(`=================================================`);
  console.log(`  Text Call:       ${textPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Image Input:     ${imagePass ? 'PASS' : 'FAIL'}`);
  console.log(`  JSON Mode:       ${jsonPass ? 'PASS (yes)' : 'FAIL (no)'}`);
  console.log(`=================================================`);

  if (!textPass) {
    process.exit(1);
  }
}

pingGemma().catch((err) => {
  console.error('Fatal ping-gemma error:', err);
  process.exit(1);
});
