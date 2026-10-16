import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const specPath = fileURLToPath(new URL('../../../../contracts/openapi.yaml', import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const spec = parse(readFileSync(specPath, 'utf8')) as any;

// strict: false because OpenAPI adds keywords Ajv doesn't know (example, x-owner, ...).
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'openapi', undefined, false);

const escape = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');

/** Validates a JSON response body against its schema in contracts/openapi.yaml. */
export function validateResponse(path: string, method: string, status: number, body: unknown) {
  const methodObj = spec.paths?.[path]?.[method.toLowerCase()];
  const responseObj = methodObj?.responses?.[status.toString()];

  let ref: string;
  if (responseObj?.$ref) {
    const componentName = responseObj.$ref.replace('#/components/responses/', '');
    ref = `openapi#/components/responses/${escape(componentName)}/content/application~1json/schema`;
  } else {
    ref = `openapi#/paths/${escape(path)}/${method.toLowerCase()}/responses/${status}/content/application~1json/schema`;
  }

  const validate = ajv.getSchema(ref) ?? ajv.compile({ $ref: ref });
  const valid = validate(body) as boolean;
  return { valid, errors: validate.errors ?? [] };
}

/** Validates an object against a schema in components/schemas. */
export function validateSchema(name: string, body: unknown) {
  const ref = `openapi#/components/schemas/${escape(name)}`;
  const validate = ajv.getSchema(ref) ?? ajv.compile({ $ref: ref });
  const valid = validate(body) as boolean;
  return { valid, errors: validate.errors ?? [] };
}
