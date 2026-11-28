import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
const manifest = parse(readFileSync('manifest.yml', 'utf8'));
assert.equal(manifest.app.runtime.name, 'nodejs22.x');
assert.equal(manifest.modules['jira:globalPage'].length, 1);
const page = manifest.modules['jira:globalPage'][0];
assert.equal(page.title, 'Light House');
assert(
  manifest.modules.function.some(
    (entry) =>
      entry.key === page.resolver.function && entry.handler === 'index.handler',
  ),
);
assert(
  manifest.resources.some(
    (resource) =>
      resource.key === page.resource &&
      existsSync(`${resource.path}/index.html`),
  ),
);
assert.deepEqual(manifest.permissions.scopes, [
  'read:jira-work',
  'storage:app',
  'read:servicedesk-request',
  'write:servicedesk-request',
  'write:jira-work',
]);
assert.deepEqual(manifest.modules.sql, [
  { key: 'light-house-sql', engine: 'mysql' },
]);
const ingress = manifest.modules.webtrigger[0];
assert.equal(ingress.urlFormat, 'v2');
assert.equal(ingress.response.type, 'static');
assert.deepEqual(
  ingress.response.outputs.map((o) => o.statusCode),
  [202, 400, 401, 409, 413, 405, 429, 503],
);
for (const consumer of manifest.modules.consumer)
  assert(manifest.modules.function.some((f) => f.key === consumer.function));
for (const f of manifest.modules.function)
  assert(
    [
      'index.handler',
      'index.embeddedHandler',
      'index.migrateInstallation',
      'index.monitoringIngress',
      'index.monitoringConsume',
      'index.monitoringMigrate',
      'index.incidentMigrate',
    ].includes(f.handler),
  );
assert.equal(manifest.permissions.external, undefined);
if (!manifest.app.id)
  console.info(
    'Registration pending: app.id intentionally absent. forge register is required before deployment.',
  );

const embedded = manifest.modules['jira:issueContext'];
assert.equal(embedded.length, 1);
assert.equal(embedded[0].key, 'light-house-incident-context');
assert.equal(embedded[0].resource, 'light-house-issue-ui');
assert.equal(embedded[0].resolver.function, 'issue-context-resolver');
assert(
  manifest.resources.some(
    (r) => r.key === 'light-house-issue-ui' && r.path === 'dist/issue-ui',
  ),
);
assert(existsSync('dist/issue-ui/index.html'));

console.info(
  'Local manifest wiring and built resources passed. This is not Forge CLI validation.',
);
