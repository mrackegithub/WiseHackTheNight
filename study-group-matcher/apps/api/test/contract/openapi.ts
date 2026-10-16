import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const specPath = fileURLToPath(new URL('../../../../contracts/openapi.yaml', import.meta.url));
const spec = parse(readFileSync(specPath, 'utf8')) as object;

// strict: false because OpenAPI adds keywords Ajv doesn't know (example, x-owner, ...).
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'openapi', undefined, false);

const escape = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');

/** Validates a JSON response body against its schema in contracts/openapi.yaml. */
export function validateResponse(path: string, method: string, status: number, body: unknown) {
  const ref = `openapi#/paths/${escape(path)}/${method.toLowerCase()}/responses/${status}/content/application~1json/schema`;
  const validate = ajv.getSchema(ref) ?? ajv.compile({ $ref: ref });
  const valid = validate(body) as boolean;
  return { valid, errors: validate.errors ?? [] };
}
