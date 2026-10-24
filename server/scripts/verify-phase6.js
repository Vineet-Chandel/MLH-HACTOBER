import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:8787';

async function verifyTextSample(name, payload) {
  console.log(`\n========================================`);
  console.log(`VERIFY TEXT: ${name}`);
  console.log(`========================================`);

  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`FAILED (${res.status}):`, errText);
    return;
  }

  const data = await res.json();

  console.log(`Top-level keys in response:`, Object.keys(data));
  console.log(`Analysis Risk Level: ${data.analysis?.risk_level}`);
  console.log(`Analysis Heuristic Score: ${data.analysis?.heuristic_score}`);
  console.log(`Url Checks Source: ${data.url_checks?.source}`);
  console.log(`Url Checks Checked At: ${data.url_checks?.checked_at}`);
  console.log(`Url Checks Not Checked:`, data.url_checks?.not_checked);
  console.log(`Total URLs Checked: ${data.url_checks?.urls?.length || 0}`);

  data.url_checks?.urls?.forEach((u, i) => {
    console.log(`  [URL ${i + 1}] Defanged: ${u.display_defanged}`);
    console.log(`        Normalized: ${u.normalized_url}`);
    console.log(`        Parse OK: ${u.parse_ok}`);
    console.log(`        Registrable Domain: ${u.registrable_domain}`);
    console.log(`        Highest Severity: ${u.highest_severity}`);
    console.log(`        Findings (${u.findings.length}):`);
    u.findings.forEach((f) => {
      console.log(`          - [${f.severity.toUpperCase()}] ${f.id} (${f.label}): ${f.detail}`);
    });
  });
}

async function verifyImageSample(name, imagePath, metadata = {}) {
  console.log(`\n========================================`);
  console.log(`VERIFY IMAGE: ${name}`);
  console.log(`========================================`);

  const fullPath = path.resolve(__dirname, imagePath);
  const fileBytes = fs.readFileSync(fullPath);
  const blob = new Blob([fileBytes], { type: 'image/png' });

  const formData = new FormData();
  formData.append('image', blob, path.basename(imagePath));
  if (metadata.message_type) formData.append('message_type', metadata.message_type);
  if (metadata.context_note) formData.append('context_note', metadata.context_note);
  if (metadata.claimed_org) formData.append('claimed_org', metadata.claimed_org);

  const res = await fetch(`${BASE_URL}/api/analyze-image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`FAILED (${res.status}):`, errText);
    return;
  }

  const data = await res.json();

  console.log(`Top-level keys in response:`, Object.keys(data));
  console.log(`Analysis Risk Level: ${data.analysis?.risk_level}`);
  console.log(`Analysis Heuristic Score: ${data.analysis?.heuristic_score}`);
  console.log(`Visible URLs from vision:`, data.analysis?.image_observations?.visible_urls);
  console.log(`Url Checks Source: ${data.url_checks?.source}`);
  console.log(`Url Checks Not Checked:`, data.url_checks?.not_checked);
  console.log(`Total URLs Checked: ${data.url_checks?.urls?.length || 0}`);

  data.url_checks?.urls?.forEach((u, i) => {
    console.log(`  [URL ${i + 1}] Defanged: ${u.display_defanged}`);
    console.log(`        Normalized: ${u.normalized_url}`);
    console.log(`        Parse OK: ${u.parse_ok}`);
    console.log(`        Registrable Domain: ${u.registrable_domain}`);
    console.log(`        Highest Severity: ${u.highest_severity}`);
    console.log(`        Findings (${u.findings.length}):`);
    u.findings.forEach((f) => {
      console.log(`          - [${f.severity.toUpperCase()}] ${f.id} (${f.label}): ${f.detail}`);
    });
  });
}

async function main() {
  // 1. Text Suspicious Bank
  await verifyTextSample('Suspicious Bank SMS with Claimed Org (SBI)', {
    message: 'URGENT: Your First National Bank account has been suspended due to suspicious activity. Verify your identity immediately at https://first-national-security-portal.xyz/login to avoid permanent closure.',
    message_type: 'sms',
    url: 'https://first-national-security-portal.xyz/login',
    claimed_org: 'State Bank of India',
  });

  // 2. Text Benign (No URLs)
  await verifyTextSample('Benign Grocery (No URLs)', {
    message: 'Hi Alex, your weekly order summary from FreshMart is ready. Your delivery of groceries is scheduled for tomorrow between 2 PM and 4 PM. View your items in the FreshMart app if you need to make changes before 8 PM tonight.',
    message_type: 'email',
  });

  // 3. Image Bank SMS
  await verifyImageSample('Bank SMS Screenshot', '../../samples/sample-bank-sms.png', {
    message_type: 'sms',
    claimed_org: 'State Bank of India',
  });

  // 4. Image Delivery Notice (Unencrypted HTTP link)
  await verifyImageSample('Delivery Notice Screenshot', '../../samples/sample-delivery.png', {
    message_type: 'email',
  });

  // 5. Image Non-message (Landscape Photo)
  await verifyImageSample('Landscape Photo (No text/links)', '../../samples/landscape-photo.png', {
    message_type: 'other',
  });

  console.log('\n========================================');
  console.log('ALL PHASE 6 VERIFICATIONS COMPLETED');
  console.log('========================================');
}

main().catch(console.error);
