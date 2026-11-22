import fs from 'node:fs';
import path from 'node:path';
import * as webpushModule from 'web-push';

const webpush = webpushModule.default || webpushModule;

const ENV_PATH = path.resolve(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.resolve(process.cwd(), '.env.example');
const DEFAULT_SUBJECT = 'mailto:admin@elanati.app';

function readEnvSource() {
  if (fs.existsSync(ENV_PATH)) {
    return fs.readFileSync(ENV_PATH, 'utf8');
  }
  if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    return fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  }
  return '';
}

function getEnvValue(content, key) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const k = trimmed.slice(0, eqIndex).trim();
    if (k === key) {
      return trimmed.slice(eqIndex + 1).replace(/^['"]|['"]$/g, '').trim();
    }
  }
  return '';
}

function upsertEnvVar(lines, key, value) {
  const keyRegex = new RegExp(`^\\s*${key}\\s*=`);
  let updated = false;
  const nextLines = lines.map((line) => {
    if (!updated && keyRegex.test(line)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!updated) {
    nextLines.push(`${key}=${value}`);
  }
  return nextLines;
}

function main() {
  const force = process.argv.includes('--force') || process.argv.includes('-f');
  const source = readEnvSource();

  const existingPublic = getEnvValue(source, 'VAPID_PUBLIC_KEY');
  const existingPrivate = getEnvValue(source, 'VAPID_PRIVATE_KEY');
  const existingSubject = getEnvValue(source, 'VAPID_SUBJECT');

  if (!force && existingPublic && existingPrivate) {
    console.log('ℹ️ مفاتيح VAPID موجودة بالفعل داخل ملف .env.');
    console.log('   لإعادة توليد مفاتيح جديدة (مع استبدال الحالية)، شغّل الأمر مع --force:');
    console.log('   npm run vapid:generate -- --force');
    return;
  }

  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  const subject = existingSubject || DEFAULT_SUBJECT;

  const normalized = source.replace(/\r\n/g, '\n');
  let lines = normalized ? normalized.split('\n') : [];
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (!fs.existsSync(ENV_PATH) && lines.length === 0) {
    lines.push('# مفاتيح إشعارات Web Push المباشرة');
  }

  lines = upsertEnvVar(lines, 'VAPID_PUBLIC_KEY', publicKey);
  lines = upsertEnvVar(lines, 'VAPID_PRIVATE_KEY', privateKey);
  lines = upsertEnvVar(lines, 'VAPID_SUBJECT', subject);

  fs.writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, 'utf8');
  try {
    fs.chmodSync(ENV_PATH, 0o600);
  } catch {
    // Ignore chmod failures on filesystems that do not support POSIX modes.
  }

  console.log('✅ تم توليد مفاتيح VAPID وتحديث ملف .env بنجاح:');
  console.log(`   VAPID_PUBLIC_KEY=${publicKey}`);
  console.log('   VAPID_PRIVATE_KEY=[تم الحفظ داخل .env بشكل آمن]');
  console.log(`   VAPID_SUBJECT=${subject}`);
  console.log('');
  console.log('📌 الخطوة التالية للنشر على Vercel:');
  console.log('   انسخ قيم VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY و VAPID_SUBJECT من ملف .env');
  console.log('   وأضفها في Vercel -> Settings -> Environment Variables ثم أعد النشر (Redeploy).');
}

main();
