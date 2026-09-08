import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let firebaseAdminApp: App | null = null;

/**
 * Normalizes and parses raw Service Account credentials from JSON, Base64, or text fragments.
 */
function parseServiceAccount(raw: string | undefined): any | null {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;

  // Clean markdown code fence formatting if present
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // 1. Direct JSON string or missing outer curly braces
  const tryParse = (str: string) => {
    try {
      const parsed = JSON.parse(str);
      if (parsed && (parsed.private_key || parsed.client_email || parsed.project_id)) {
        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
      }
    } catch {}
    return null;
  };

  // Try direct parse
  let result = tryParse(trimmed);
  if (result) return result;

  // If missing outer curly brackets (e.g. user copied properties without { })
  if (!trimmed.startsWith('{') && (trimmed.includes('"type"') || trimmed.includes('"private_key"') || trimmed.includes('"project_id"'))) {
    result = tryParse('{' + trimmed.replace(/^[^{\w"]*/, '').replace(/[^}\w"]*$/, '') + '}');
    if (result) return result;
  }

  // 2. Base64 encoded JSON string
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    result = tryParse(decoded);
    if (result) return result;
    if (!decoded.startsWith('{') && (decoded.includes('"type"') || decoded.includes('"private_key"'))) {
      result = tryParse('{' + decoded + '}');
      if (result) return result;
    }
  } catch {}

  // 3. File path on disk
  try {
    if (fs.existsSync(trimmed) && fs.statSync(trimmed).isFile()) {
      const fileContent = fs.readFileSync(trimmed, 'utf8');
      result = tryParse(fileContent);
      if (result) return result;
    }
  } catch {}

  return null;
}

/**
 * Ensures a physical credentials file exists on disk if raw JSON was placed in GOOGLE_APPLICATION_CREDENTIALS.
 */
function ensureServiceAccountFile(saJson: any): string {
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const saFilePath = path.join(dataDir, 'firebase-service-account.json');
    fs.writeFileSync(saFilePath, JSON.stringify(saJson, null, 2), 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = saFilePath;
    return saFilePath;
  } catch {
    const tmpPath = '/tmp/firebase-service-account.json';
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(saJson, null, 2), 'utf8');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
      return tmpPath;
    } catch {
      return '';
    }
  }
}

export function getFirebaseAdmin(): App {
  if (!firebaseAdminApp) {
    const existingApps = getApps();
    if (existingApps.length > 0 && existingApps[0]) {
      firebaseAdminApp = existingApps[0];
      return firebaseAdminApp;
    }

    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    let projectId = process.env.FIREBASE_PROJECT_ID;
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        projectId = projectId || config.projectId;
      } catch {}
    }

    const finalProjectId = projectId || 'bse-nexus';

    // Check all potential Service Account env variables
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
                           process.env.FIREBASE_SERVICE_ACCOUNT ||
                           process.env.SERVICE_ACCOUNT_KEY ||
                           process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const saJson = parseServiceAccount(rawCredentials);

    // If GOOGLE_APPLICATION_CREDENTIALS was set to raw JSON text, fix it so Google Auth doesn't crash on lstat
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      if (saJson) {
        ensureServiceAccountFile(saJson);
      } else {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
    }

    if (saJson) {
      try {
        ensureServiceAccountFile(saJson);
        firebaseAdminApp = initializeApp({
          credential: cert(saJson),
          projectId: saJson.project_id || finalProjectId,
        });
        console.info(`[FirebaseAdmin] Successfully initialized Firebase Admin SDK for project: ${saJson.project_id || finalProjectId}`);
        return firebaseAdminApp;
      } catch (e) {
        console.warn('[FirebaseAdmin] Failed to initialize with parsed Service Account:', e);
      }
    }

    // Check for individual private key and client email variables
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (clientEmail && privateKey) {
      try {
        privateKey = privateKey.replace(/\\n/g, '\n');
        const customCredentials = {
          projectId: finalProjectId,
          clientEmail,
          privateKey,
        };
        ensureServiceAccountFile(customCredentials);
        firebaseAdminApp = initializeApp({
          credential: cert(customCredentials),
          projectId: finalProjectId,
        });
        console.info('[FirebaseAdmin] Successfully initialized Firebase Admin SDK with individual client credentials.');
        return firebaseAdminApp;
      } catch (e) {
        console.warn('[FirebaseAdmin] Failed to initialize with individual credentials:', e);
      }
    }

    // Default initialization with project ID
    try {
      firebaseAdminApp = initializeApp({
        projectId: finalProjectId,
      });
      console.info(`[FirebaseAdmin] Initialized Firebase Admin SDK with project ID: ${finalProjectId}`);
    } catch {
      firebaseAdminApp = initializeApp();
    }
  }
  return firebaseAdminApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseAdmin());
}



