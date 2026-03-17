/**
 * from-schema: Generate CLI adapters from a GraphQL schema file.
 *
 * Parses a .graphql SDL file, extracts top-level Query fields that return
 * Connection types, resolves node types + scalar fields, and emits TypeScript
 * adapter files using the COOKIE + direct-POST-to-/graphql pattern.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── SDL parsing ─────────────────────────────────────────────────────────────

/** Scalar leaf types — fields of these types are included in the generated query */
const SCALAR_TYPES = new Set([
  'String', 'Int', 'Float', 'Boolean', 'ID',
  'DateTime', 'Date', 'BigInt', 'Decimal',
  'EmailAddress', 'URL', 'PhoneNumber',
]);
/** Complex types that have a useful single leaf field we can grab */
const SEMI_SCALAR: Record<string, string> = {
  Money: 'format',
  Currency: 'code',
};

function baseType(t: string): string {
  return t.replace(/[!\[\]\s]/g, '');
}

function isScalar(t: string): boolean {
  return SCALAR_TYPES.has(baseType(t));
}

/** Extract the body (everything between the outermost { }) of a named block. */
function extractTypeBody(schema: string, typeName: string): string | null {
  // Match: type Foo { ... } or input Foo { ... }
  const re = new RegExp(`(?:type|input|enum)\\s+${typeName}\\b[^{]*\\{`, 'g');
  const match = re.exec(schema);
  if (!match) return null;
  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < schema.length && depth > 0) {
    if (schema[i] === '{') depth++;
    else if (schema[i] === '}') depth--;
    i++;
  }
  return schema.slice(start, i - 1);
}

export interface GqlArg {
  name: string;
  type: string;       // raw SDL type string, e.g. "Int" / "ProposalFilter"
  required: boolean;
}

export interface GqlQueryField {
  name: string;
  args: GqlArg[];
  returnType: string; // e.g. "ProposalConnection"
  isConnection: boolean;
  nodeTypeName: string | null;
}

export interface GqlNodeField {
  name: string;
  type: string;        // base type name
  semiScalarLeaf?: string; // e.g. "format" for Money
}

/** Parse all top-level query fields from `type Query { ... }` */
export function parseQueryFields(schema: string): GqlQueryField[] {
  const body = extractTypeBody(schema, 'Query');
  if (!body) return [];

  // Strip block descriptions and line comments
  const stripped = body
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/#[^\n]*/g, '');

  const fields: GqlQueryField[] = [];
  const seen = new Set<string>();
  const lines = stripped.split('\n');

  // Two patterns to detect fields at 2-space indent:
  //
  // Pattern A (inline):   `  fieldName(a: T, b: T): ReturnType!`
  //                       `  fieldName: ReturnType!`
  //
  // Pattern B (multiline):  `  fieldName(`
  //                            `    a: T`
  //                            `    ...`
  //                          `  ): ReturnType!`
  //
  // The closing line for multiline is always `  ): ReturnType!`

  const inlineRe = /^  ([a-z][a-zA-Z0-9]*)\s*(?:\(([^)]*)\))?\s*:\s*(\S+)/;
  const openRe   = /^  ([a-z][a-zA-Z0-9]*)\s*\(\s*$/;
  const closeRe  = /^  \)\s*:\s*(\S+)/;

  let i = 0;
  let pendingName: string | null = null;
  let pendingArgs: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    if (pendingName) {
      // Inside a multiline arg block — look for closing `  ): ReturnType`
      const cm = closeRe.exec(line);
      if (cm) {
        const rt = cm[1].replace(/[!\[\]]/g, '');
        if (!seen.has(pendingName)) {
          seen.add(pendingName);
          const isConnection = rt.endsWith('Connection');
          fields.push({
            name: pendingName,
            args: parseArgs(pendingArgs.join(', ')),
            returnType: rt,
            isConnection,
            nodeTypeName: isConnection ? rt.replace(/Connection$/, '') : null,
          });
        }
        pendingName = null;
        pendingArgs = [];
      } else {
        // Collect arg lines (skip lines that are just whitespace)
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith(')')) pendingArgs.push(trimmed);
      }
      i++;
      continue;
    }

    // Try inline match
    const im = inlineRe.exec(line);
    if (im) {
      const name = im[1];
      const argsRaw = im[2] ?? '';
      const rt = im[3].replace(/[!\[\]]/g, '');
      if (!seen.has(name)) {
        seen.add(name);
        const isConnection = rt.endsWith('Connection');
        fields.push({
          name,
          args: parseArgs(argsRaw),
          returnType: rt,
          isConnection,
          nodeTypeName: isConnection ? rt.replace(/Connection$/, '') : null,
        });
      }
      i++;
      continue;
    }

    // Try multiline open
    const om = openRe.exec(line);
    if (om) {
      pendingName = om[1];
      pendingArgs = [];
      i++;
      continue;
    }

    i++;
  }

  return fields;
}

function parseArgs(raw: string): GqlArg[] {
  if (!raw.trim()) return [];
  const args: GqlArg[] = [];
  // Args look like: name: Type, name: Type = default
  // Strip description comments
  const cleaned = raw.replace(/"""[\s\S]*?"""/g, '').replace(/#.*/g, '');
  // Split by comma but be careful of nested types like [String!]
  const parts = cleaned.split(/,(?![^\[]*\])/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx < 0) continue;
    const name = part.slice(0, colonIdx).trim();
    const rest = part.slice(colonIdx + 1).split('=')[0].trim();
    args.push({ name, type: rest, required: rest.endsWith('!') });
  }
  return args;
}

/** Extract scalar fields from a type body string */
export function extractNodeFields(schema: string, typeName: string): GqlNodeField[] {
  const body = extractTypeBody(schema, typeName);
  if (!body) return [];

  const fields: GqlNodeField[] = [];
  const stripped = body.replace(/"""[\s\S]*?"""/g, '').replace(/#.*/g, '');

  // Match: fieldName: TypeName! (no args — skip methods/connections)
  const fieldRe = /^\s{2}([a-z][a-zA-Z0-9]*)\s*:\s*\[?([A-Za-z]+)[!\]]*/gm;
  let m: RegExpExecArray | null;

  while ((m = fieldRe.exec(stripped)) !== null) {
    const fieldName = m[1];
    const typBase = m[2];

    if (isScalar(typBase)) {
      fields.push({ name: fieldName, type: typBase });
    } else if (SEMI_SCALAR[typBase]) {
      fields.push({ name: fieldName, type: typBase, semiScalarLeaf: SEMI_SCALAR[typBase] });
    }
    // Skip complex/connection fields
  }

  return fields;
}

// ── Filter type introspection ────────────────────────────────────────────────

export interface FilterArg {
  cliName: string;
  gqlField: string;
  type: 'string' | 'int' | 'bool' | 'enum';
  enumValues?: string[];
  help: string;
}

/** Try to derive useful --args from a filter input type */
export function extractFilterArgs(schema: string, filterTypeName: string): FilterArg[] {
  const body = extractTypeBody(schema, filterTypeName);
  if (!body) return [];

  const stripped = body.replace(/"""[\s\S]*?"""/g, '').replace(/#.*/g, '');
  const args: FilterArg[] = [];

  const fieldRe = /^\s{2}([a-z][a-zA-Z0-9]*)\s*:\s*\[?([A-Za-z]+)[!\]]*/gm;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(stripped)) !== null) {
    const field = m[1];
    const typ = m[2];

    // nameCont → --query
    if (field === 'nameCont') {
      args.push({ cliName: 'query', gqlField: field, type: 'string', help: 'Filter by name (partial match)' });
    }
    // stateIn → --state (enum)
    else if (field === 'stateIn') {
      const enumVals = extractEnumValues(schema, typ);
      args.push({
        cliName: 'state',
        gqlField: field,
        type: 'enum',
        enumValues: enumVals,
        help: `Filter by state: all, ${enumVals.map(v => v.toLowerCase()).join(', ')}`,
      });
    }
    // idEq / idIn → skip (internal)
  }

  return args;
}

function extractEnumValues(schema: string, enumName: string): string[] {
  const body = extractTypeBody(schema, enumName);
  if (!body) return [];
  return body.split('\n').map(l => l.trim()).filter(v => /^[A-Z_]+$/.test(v));
}

// ── Adapter code generation ──────────────────────────────────────────────────

export interface AdapterSpec {
  site: string;
  endpoint: string;
  query: GqlQueryField;
  nodeFields: GqlNodeField[];
  filterArgs: FilterArg[];
}

export function generateAdapter(spec: AdapterSpec): string {
  const { site, endpoint, query, nodeFields, filterArgs } = spec;
  const name = query.name;

  // Pick the best fields: id first, then scalars, cap at 8
  const pickedFields = pickFields(nodeFields);
  const columns = pickedFields.map(f => f.name);

  // Build GQL field selection
  const gqlFields = pickedFields.map(f =>
    f.semiScalarLeaf ? `              ${f.name} { ${f.semiScalarLeaf} }` : `              ${f.name}`
  ).join('\n');

  // Build CLI args
  const cliArgs: string[] = [
    `{ name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' }`,
  ];
  for (const fa of filterArgs) {
    if (fa.type === 'enum' && fa.enumValues?.length) {
      const choices = fa.enumValues.map(v => `'${v.toLowerCase()}'`).join(', ');
      cliArgs.push(`{ name: '${fa.cliName}', default: 'all', help: '${fa.help}' }`);
    } else if (fa.type === 'string') {
      cliArgs.push(`{ name: '${fa.cliName}', default: '', help: '${fa.help}' }`);
    }
  }

  // Build variables construction
  const filterTypeName = query.args.find(a => a.name === 'filter')?.type.replace(/[!\[\]]/g, '') ?? null;
  const filterLines: string[] = [];
  for (const fa of filterArgs) {
    if (fa.type === 'enum') {
      filterLines.push(
        `    const ${fa.cliName}Val = (kwargs['${fa.cliName}'] || 'all').toUpperCase();\n` +
        `    if (kwargs['${fa.cliName}'] && kwargs['${fa.cliName}'] !== 'all') filterVars.${fa.gqlField} = [${fa.cliName}Val];`
      );
    } else if (fa.type === 'string') {
      filterLines.push(`    if (kwargs['${fa.cliName}']) filterVars.${fa.gqlField} = kwargs['${fa.cliName}'];`);
    }
  }

  const hasFilter = filterTypeName && filterArgs.length > 0;

  // Build result mapper
  const mapLines = pickedFields.map(f => {
    if (f.semiScalarLeaf) {
      return `      ${f.name}: (node.${f.name}?.${f.semiScalarLeaf} ?? ''),`;
    }
    if (f.type === 'DateTime' || f.type === 'Date') {
      return `      ${f.name}: (node.${f.name} ?? '').slice(0, 10),`;
    }
    return `      ${f.name}: node.${f.name} ?? '',`;
  }).join('\n');

  // Build description from query name
  const description = `${capitalize(name)} from ${site}`;

  // Determine the base URL for navigation
  const endpointUrl = endpoint;
  const origin = endpointUrl.replace(/\/graphql.*$/, '');

  return `import { cli, Strategy } from '../../registry.js';

cli({
  site: '${site}',
  name: '${name}',
  description: '${description}',
  domain: '${extractHost(endpoint)}',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    ${cliArgs.join(',\n    ')},
  ],
  columns: ${JSON.stringify(columns)},
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;
${hasFilter ? `    const filterVars: Record<string, any> = {};\n${filterLines.join('\n')}` : ''}

    await page.goto('${origin}/dashboard');
    await page.wait(2);

    const variables: any = { first: limit${hasFilter ? ', ...(Object.keys(filterVars).length ? { filter: filterVars } : {})' : ''} };

    const body = JSON.stringify({
      query: \`
        query ${capitalize(name)}($first: Int!${hasFilter ? `, $filter: ${filterTypeName}` : ''}) {
          ${name}(first: $first${hasFilter ? ', filter: $filter' : ''}) {
            nodes {
${gqlFields}
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      \`,
      variables,
    });

    const result = await page.evaluate(\`
      (async () => {
        const resp = await fetch('${endpointUrl}', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: \${JSON.stringify(body)}
        });
        return resp.json();
      })()
    \`);

    const nodes: any[] = result?.data?.${name}?.nodes ?? [];
    return nodes.map((node: any) => ({
${mapLines}
    }));
  },
});
`;
}

/** Priority order for field selection — lower = higher priority */
const FIELD_PRIORITY: Record<string, number> = {
  id: 0,
  name: 1, title: 1, fullName: 1,
  state: 2, status: 2,
  email: 3, emailAddress: 3,
  phone: 4, mobile: 4,
  amount: 5, format: 5,
  createdAt: 6, insertedAt: 6,
  updatedAt: 7,
  description: 8,
  reference: 9, displayReferenceNumber: 9,
};

function fieldPriority(f: GqlNodeField): number {
  if (f.name in FIELD_PRIORITY) return FIELD_PRIORITY[f.name];
  // Deprioritize boolean flags (isX, canX, hasX)
  if (/^(is|can|has)[A-Z]/.test(f.name)) return 90;
  // Deprioritize URLs
  if (f.type === 'URL') return 80;
  return 50;
}

function pickFields(fields: GqlNodeField[]): GqlNodeField[] {
  return [...fields].sort((a, b) => fieldPriority(a) - fieldPriority(b)).slice(0, 8);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface FromSchemaOpts {
  schemaPath: string;
  site: string;
  endpoint: string;     // e.g. https://go.ignitionapp.com/graphql
  outDir: string;
  only?: string[];      // filter to specific query names
  top?: number;         // max adapters to generate
}

export interface FromSchemaResult {
  ok: boolean;
  site: string;
  schemaPath: string;
  generated: { name: string; path: string; columns: string[] }[];
  skipped: string[];
}

export function fromSchema(opts: FromSchemaOpts): FromSchemaResult {
  const schema = fs.readFileSync(opts.schemaPath, 'utf-8');

  const allQueries = parseQueryFields(schema);
  const connectionQueries = allQueries.filter(q => q.isConnection && q.nodeTypeName);

  let targets = connectionQueries;
  if (opts.only?.length) {
    targets = targets.filter(q => opts.only!.includes(q.name));
  }
  if (opts.top) {
    targets = targets.slice(0, opts.top);
  }

  fs.mkdirSync(opts.outDir, { recursive: true });

  const generated: { name: string; path: string; columns: string[] }[] = [];
  const skipped: string[] = [];

  for (const query of targets) {
    const nodeFields = extractNodeFields(schema, query.nodeTypeName!);
    if (nodeFields.length === 0) {
      skipped.push(query.name);
      continue;
    }

    const filterArg = query.args.find(a => a.name === 'filter');
    const filterArgs = filterArg
      ? extractFilterArgs(schema, baseType(filterArg.type))
      : [];

    const spec: AdapterSpec = {
      site: opts.site,
      endpoint: opts.endpoint,
      query,
      nodeFields,
      filterArgs,
    };

    const code = generateAdapter(spec);
    const filePath = path.join(opts.outDir, `${query.name}.ts`);
    fs.writeFileSync(filePath, code, 'utf-8');

    const pickedFields = pickFields(nodeFields);
    generated.push({ name: query.name, path: filePath, columns: pickedFields.map(f => f.name) });
  }

  return { ok: generated.length > 0, site: opts.site, schemaPath: opts.schemaPath, generated, skipped };
}

export function renderFromSchemaResult(r: FromSchemaResult): string {
  const lines = [
    `opencli from-schema: ${r.ok ? 'OK' : 'FAIL'}`,
    `Site: ${r.site}`,
    `Schema: ${r.schemaPath}`,
    `Generated: ${r.generated.length}`,
  ];
  for (const g of r.generated) {
    lines.push(`  ✓ ${g.name} [${g.columns.join(', ')}] → ${g.path}`);
  }
  if (r.skipped.length) {
    lines.push(`Skipped (no scalar fields): ${r.skipped.join(', ')}`);
  }
  return lines.join('\n');
}
