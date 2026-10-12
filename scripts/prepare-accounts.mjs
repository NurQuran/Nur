import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Manual activation only. Never executed by a build or by visiting the site.
const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = join(root, 'nur.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');
const dir = join(root, '.wrangler');
mkdirSync(dir, { recursive: true });
const temporaryConfig = join(dir, 'nur-accounts.json');
const writeConfiguration = id => writeFileSync(temporaryConfig, JSON.stringify({
  name: config.workerName, compatibility_date: '2026-10-01',
  d1_databases: id ? [{ binding: 'DB', database_name: 'nur-accounts', database_id: id, migrations_dir: '../migrations' }] : [],
}, null, 2));
writeConfiguration(config.databaseId);
function run(args, capture = false) {
  const result = spawnSync(process.execPath, [wrangler, ...args, '--config', temporaryConfig], {
    cwd: root, env: { ...process.env, WRANGLER_WRITE_LOGS: 'false' }, encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error || result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || result.stdout || 'Cloudflare est indisponible.');
    throw new Error('Étape interrompue : vérifiez votre connexion Cloudflare et le compte sélectionné.');
  }
  return result.stdout;
}
try {
  console.log('Préparation de la base Nur. Aucune publication du site et aucune suppression de données.');
  run(['whoami']);
  let databases = JSON.parse(run(['d1', 'list', '--json'], true));
  let db = config.databaseId ? databases.find(d => d.uuid === config.databaseId) : databases.find(d => d.name === 'nur-accounts');
  if (config.databaseId && !db) throw new Error('La base configurée est absente de ce compte. Aucun changement effectué.');
  if (!db) {
    run(['d1', 'create', 'nur-accounts', '--location', 'weur']);
    databases = JSON.parse(run(['d1', 'list', '--json'], true));
    db = databases.find(d => d.name === 'nur-accounts');
  }
  if (!db?.uuid || !/^[a-f0-9-]{36}$/i.test(db.uuid)) throw new Error('Identifiant de base introuvable.');
  writeConfiguration(db.uuid);
  run(['d1', 'migrations', 'apply', 'DB', '--remote']);
  writeFileSync(configPath, JSON.stringify({ ...config, databaseId: db.uuid }, null, 2) + '\n');
  console.log('Base prête. Configurez les secrets puis reconstruisez et publiez selon docs/ACTIVATION.md.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
