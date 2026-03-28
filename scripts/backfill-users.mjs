import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function readArg(name) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
}

function resolveServiceAccount(inputPath) {
  if (!inputPath) return null;
  const fullPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Service account file not found: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

async function main() {
  const explicitServiceAccount = readArg('serviceAccount') || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const explicitProjectId = readArg('project') || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '';

  const sa = resolveServiceAccount(explicitServiceAccount);
  const projectId = explicitProjectId || sa?.project_id || '';

  if (sa) {
    initializeApp({
      credential: cert(sa),
      ...(projectId ? { projectId } : {})
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {})
    });
  }

  const auth = getAuth();
  const db = getFirestore();

  let pageToken = undefined;
  let totalScanned = 0;
  let totalWritten = 0;

  do {
    const page = await auth.listUsers(1000, pageToken);
    pageToken = page.pageToken;

    if (!page.users.length) continue;

    let batch = db.batch();
    let batchOps = 0;

    for (const user of page.users) {
      totalScanned += 1;

      const email = String(user.email || '').trim();
      if (!email) continue;

      const creationMs = user.metadata?.creationTime ? Date.parse(user.metadata.creationTime) : 0;
      const lastSignInMs = user.metadata?.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : 0;
      const lastSeenAt = Number.isFinite(lastSignInMs) && lastSignInMs > 0
        ? lastSignInMs
        : (Number.isFinite(creationMs) ? creationMs : Date.now());

      const ref = db.collection('app_users').doc(user.uid);
      batch.set(ref, {
        uid: user.uid,
        email,
        displayName: String(user.displayName || '').trim(),
        photoURL: String(user.photoURL || '').trim(),
        lastSeenAt,
        backfilledAt: Date.now(),
        source: 'auth-backfill'
      }, { merge: true });

      batchOps += 1;
      totalWritten += 1;

      if (batchOps >= 400) {
        await batch.commit();
        batch = db.batch();
        batchOps = 0;
      }
    }

    if (batchOps > 0) {
      await batch.commit();
    }

    console.log(`[backfill-users] scanned=${totalScanned}, written=${totalWritten}`);
  } while (pageToken);

  console.log(`[backfill-users] completed. scanned=${totalScanned}, written=${totalWritten}`);
}

main().catch((err) => {
  console.error('[backfill-users] failed:', err);
  console.error('Tip: run with --serviceAccount=path/to/service-account.json --project=your-project-id');
  process.exit(1);
});
