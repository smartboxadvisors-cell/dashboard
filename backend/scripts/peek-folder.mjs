// scripts/peek-folder.mjs
import fs from 'fs';
import { google } from 'googleapis';

// --- tiny argv parser ---
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  })
);

// Prefer CLI flags, then env
const KEY_PATH   = argv.key     || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const FOLDER_ID  = argv.folder  || process.env.FOLDER_ID;
const DELEGATED  = argv.subject || process.env.DELEGATED_USER; // optional

if (!KEY_PATH) {
  throw new Error(
    'Missing key path. Pass --key="C:/path/to/credentials.json" or set GOOGLE_APPLICATION_CREDENTIALS.'
  );
}
if (!FOLDER_ID) {
  throw new Error(
    'Missing FOLDER_ID. Pass --folder="<drive folder id>" or set FOLDER_ID env.'
  );
}

const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));

const scopes = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const auth = DELEGATED
  ? new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes,
      subject: DELEGATED, // domain-wide delegation
    })
  : new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes,
    });

await auth.authorize();

const drive = google.drive({ version: 'v3', auth });

// who am i?
const who = await drive.about.get({ fields: 'user(emailAddress,displayName)' });
console.log('Acting as:', who.data.user);

// list files in folder
const { data } = await drive.files.list({
  q: `'${FOLDER_ID}' in parents and trashed=false`,
  includeItemsFromAllDrives: true,
  supportsAllDrives: true,
  pageSize: 50,
  fields:
    'files(id,name,mimeType,modifiedTime,owners(emailAddress,displayName))',
  orderBy: 'modifiedTime desc',
});

const rows = (data.files || []).map((f) => ({
  id: f.id,
  name: f.name,
  mime: f.mimeType,
  modified: f.modifiedTime,
}));

console.table(rows);
if (!rows.length) {
  console.log(
    'No items found. Check that the acting identity has at least Viewer access to this folder.'
  );
}
