import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const directory = new URL('../supabase/migrations/', import.meta.url);
const names = readdirSync(directory)
  .filter((name) => name.startsWith('20261002'))
  .sort();
const body = names
  .map(
    (name) =>
      `-- ${name}\n${readFileSync(new URL(name, directory), 'utf8')
        .replace(/^begin;\s*$/gm, '')
        .replace(/^commit;\s*$/gm, '')}`,
  )
  .join('\n');
const hash = createHash('sha256').update(body).digest('hex');
const sql = `-- ZUNO SOCIAL BACKEND — pending approval for project Zuno app only.\n-- Extends the existing account foundation; no sample people or credentials.\n-- Adds server-enforced friends/blocks, private-by-default GPS, private inboxes,\n-- member-only chats, audience/capacity-checked meetups and owner-uploaded avatars.\n-- PostGIS discovery is capped at 50 km / 100 people; location expires in 90 seconds.\n-- Cron removes expired location rows every 5 minutes. No location history table.\n-- SHA256 ${hash}\nbegin;\n${body}\ncreate table zuno_private.deployment_log (version text primary key, checksum text not null, applied_at timestamptz not null default now());\nalter table zuno_private.deployment_log enable row level security;\nrevoke all on zuno_private.deployment_log from public,anon,authenticated;\ninsert into zuno_private.deployment_log(version,checksum) values('20261002_social','${hash}');\ncommit;\nselect 'Zuno social backend applied' as status;\n`;
mkdirSync(new URL('../release-artifacts/', import.meta.url), { recursive: true });
writeFileSync(new URL('../release-artifacts/supabase-social-deploy.sql', import.meta.url), sql);
console.log(
  JSON.stringify({ migrations: names, sha256: hash, bytes: Buffer.byteLength(sql) }, null, 2),
);
