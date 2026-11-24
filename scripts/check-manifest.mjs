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
assert.deepEqual(manifest.permissions.scopes, []);
console.info(
  'Local manifest wiring and built resources passed. This is not Forge CLI validation.',
);
if (!manifest.app.id)
  console.info(
    'Registration pending: app.id intentionally absent. forge register is required before deployment.',
  );
