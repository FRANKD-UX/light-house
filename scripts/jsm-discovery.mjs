// Local owner-operated read-only preparation; import has no network side effects.
// Verified 2026-11-28:
// https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-servicedesk/
// https://developer.atlassian.com/cloud/jira/service-desk/basic-auth-for-rest-apis/
// Existing account email/API-token Basic auth only; never acquire credentials here.
// Not application authentication or proof of Forge app permissions/configuration.
import { URL, pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

const MAX_BYTES = 1_048_576;
class DiscoveryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = (code) => {
  throw new DiscoveryError(code);
};
function integer(value, min, max) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value))
    fail('INVALID_INPUT');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max)
    fail('INVALID_INPUT');
  return number;
}
function id(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,17}$/.test(value))
    fail('INVALID_RESPONSE');
  return value;
}
function label(value) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 256 ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    fail('INVALID_RESPONSE');
  return value;
}
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('INVALID_RESPONSE');
  return value;
}
function fields(data) {
  if (
    !Array.isArray(data.requestTypeFields) ||
    data.requestTypeFields.length > 100
  )
    fail('INVALID_RESPONSE');
  const fieldIds = new Set();
  let optionCount = 0;
  function options(values, depth = 0) {
    if (!Array.isArray(values) || values.length > 100 || depth > 3)
      fail('UNSUPPORTED_SCHEMA');
    const ids = new Set();
    return values.map((raw) => {
      const value = object(raw);
      if (++optionCount > 1000) fail('UNSUPPORTED_SCHEMA');
      const optionId = id(value.value);
      if (ids.has(optionId)) fail('INVALID_RESPONSE');
      ids.add(optionId);
      return {
        id: optionId,
        children: options(value.children ?? [], depth + 1),
      };
    });
  }
  return data.requestTypeFields.map((raw) => {
    const field = object(raw);
    const schema = object(field.jiraSchema);
    if (
      typeof field.fieldId !== 'string' ||
      !/^(customfield_[1-9]\d{0,17}|[a-z][a-zA-Z0-9]{0,63})$/.test(
        field.fieldId,
      ) ||
      fieldIds.has(field.fieldId) ||
      typeof field.required !== 'boolean' ||
      typeof schema.type !== 'string' ||
      !/^[a-z][a-z0-9_-]{0,39}$/.test(schema.type)
    )
      fail('UNSUPPORTED_SCHEMA');
    fieldIds.add(field.fieldId);
    // Account/group identities and non-ID option values must never be projected.
    if (
      (['user', 'group'].includes(schema.type) ||
        ['user', 'group'].includes(schema.items) ||
        (typeof schema.custom === 'string' &&
          /(?:user|group)picker/i.test(schema.custom))) &&
      (!Array.isArray(field.validValues) || field.validValues.length > 0)
    )
      fail('UNSUPPORTED_SCHEMA');
    return {
      fieldId: field.fieldId,
      name: label(field.name),
      required: field.required,
      jiraSchema: { type: schema.type },
      validValues: options(field.validValues),
    };
  });
}
async function body(response) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
    fail('RESPONSE_TOO_LARGE');
  if (!response.body) fail('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > MAX_BYTES) fail('RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(item.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function discover(
  { site, email, token, desk, type, start, maxPages },
  fetcher,
) {
  try {
    if (
      typeof site !== 'string' ||
      !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net\/?$/.test(
        site,
      )
    )
      fail('INVALID_INPUT');
    if (
      typeof email !== 'string' ||
      email.length > 254 ||
      !/^[^\s:@]+@[^\s:@]+$/.test(email) ||
      typeof token !== 'string' ||
      token.length < 1 ||
      token.length > 4096 ||
      /\s/.test(token)
    )
      fail('CREDENTIALS_REQUIRED');
    if (typeof fetcher !== 'function') fail('INVALID_INPUT');
    const origin = new URL(site).origin;
    let cursor = integer(start ?? '0', 0, 1_000_000);
    const pages = integer(maxPages ?? '5', 1, 5);
    if (
      desk !== undefined &&
      (typeof desk !== 'string' || !/^[1-9]\d{0,17}$/.test(desk))
    )
      fail('INVALID_INPUT');
    if (
      type !== undefined &&
      (desk === undefined ||
        typeof type !== 'string' ||
        !/^[1-9]\d{0,17}$/.test(type) ||
        start !== undefined ||
        maxPages !== undefined)
    )
      fail('INVALID_INPUT');
    const path = `/rest/servicedeskapi/servicedesk${desk === undefined ? '' : `/${desk}/requesttype${type === undefined ? '' : `/${type}/field`}`}`;
    const values = [];
    const seen = new Set();
    for (let page = 0; page < pages; page++) {
      const url = `${origin}${path}${type === undefined ? `?start=${cursor}&limit=20` : ''}`;
      const response = await fetcher(url, {
        method: 'GET',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
        },
        signal: globalThis.AbortSignal.timeout(15_000),
      });
      if (response.redirected || (response.url && response.url !== url))
        fail('REDIRECT_REJECTED');
      if (response.status !== 200)
        fail(
          response.status === 401 || response.status === 403
            ? 'ACCESS_DENIED'
            : response.status === 429
              ? 'RATE_LIMITED'
              : 'HTTP_FAILED',
        );
      const data = object(await body(response));
      if (type !== undefined)
        return {
          ok: true,
          kind: 'request-type-fields',
          serviceDeskId: desk,
          requestTypeId: type,
          fields: fields(data),
          visibility: 'current-credential-only',
          metadataShape: 'bounded-nonpaginated-object',
        };
      if (
        !Array.isArray(data.values) ||
        data.values.length > 20 ||
        data.start !== cursor ||
        !Number.isInteger(data.limit) ||
        data.limit < 1 ||
        data.limit > 20 ||
        data.values.length > data.limit ||
        typeof data.isLastPage !== 'boolean' ||
        (!data.isLastPage && data.values.length === 0)
      )
        fail('INVALID_RESPONSE');
      const projected = data.values.map((raw) => {
        const row = object(raw);
        const rowId = id(row.id);
        if (seen.has(rowId)) fail('INVALID_RESPONSE');
        seen.add(rowId);
        if (desk !== undefined) {
          if (row.serviceDeskId !== desk) fail('INVALID_RESPONSE');
          return { id: rowId, serviceDeskId: desk, name: label(row.name) };
        }
        const key = label(row.projectKey);
        if (!/^[A-Z][A-Z0-9_]{0,254}$/.test(key)) fail('INVALID_RESPONSE');
        return {
          id: rowId,
          projectId: id(row.projectId),
          projectKey: key,
          projectName: label(row.projectName),
        };
      });
      values.push(...projected);
      cursor += data.limit;
      if (cursor > 1_000_000) fail('INVALID_RESPONSE');
      if (data.isLastPage || page + 1 === pages)
        return {
          ok: true,
          kind: desk === undefined ? 'service-desks' : 'request-types',
          values,
          isLastPage: data.isLastPage,
          nextCursor: data.isLastPage ? null : String(cursor),
          truncated: !data.isLastPage,
          visibility: 'current-credential-only',
        };
    }
    fail('INVALID_RESPONSE');
  } catch (error) {
    return {
      ok: false,
      code: error instanceof DiscoveryError ? error.code : 'REQUEST_FAILED',
    };
  }
}

export async function main(args, env, fetcher, output) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = new Map([
      ['--desk', 'desk'],
      ['--type', 'type'],
      ['--start', 'start'],
      ['--max-pages', 'maxPages'],
    ]).get(args[index]);
    if (
      !option ||
      options[option] !== undefined ||
      args[index + 1] === undefined
    ) {
      output(JSON.stringify({ ok: false, code: 'INVALID_INPUT' }));
      return 1;
    }
    options[option] = args[index + 1];
  }
  const result = await discover(
    {
      ...options,
      site: env.LH_JSM_SITE,
      email: env.LH_JSM_EMAIL,
      token: env.LH_JSM_API_TOKEN,
    },
    fetcher,
  );
  output(JSON.stringify(result));
  return result.ok ? 0 : 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await main(
    process.argv.slice(2),
    process.env,
    globalThis.fetch,
    (value) => process.stdout.write(`${value}\n`),
  );
}
