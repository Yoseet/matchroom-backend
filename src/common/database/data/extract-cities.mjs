#!/usr/bin/env node
/**
 * Extracts every city (`d_ciudad`) from the SEPOMEX postal-code XML.
 *
 * Output: ./cities.json (in this same folder).
 *
 * Usage:
 *   node src/common/database/data/extract-cities.mjs
 *
 * The first stage only collects cities. Zones are extracted later by
 * `extract-zones.mjs`, which links every settlement to one of these cities.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const XML_PATH = fileURLToPath(new URL('./CPdescarga.xml', import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL('./cities.json', import.meta.url));

const XML_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

/** Decodes the few XML entities used by SEPOMEX files. */
function decodeXml(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return XML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Returns the text content of every field inside a `<table>` element. */
function parseTable(tableXml) {
  const fields = {};

  for (const match of tableXml.matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
    fields[match[1]] = decodeXml(match[2]).trim();
  }

  return fields;
}

function cityKey(stateName, name) {
  return `${stateName}\u0000${name}`;
}

async function main() {
  console.log(`Leyendo ${XML_PATH} ...`);
  const xml = await readFile(XML_PATH, 'utf8');
  const tables = xml.match(/<table[^>]*>[\s\S]*?<\/table>/g) ?? [];

  console.log(`Registros encontrados: ${tables.length}`);

  const cities = new Map();

  for (const table of tables) {
    const row = parseTable(table);
    const name = row.d_ciudad?.trim();
    const stateName = row.d_estado?.trim();

    if (!name || !stateName) {
      continue;
    }

    const key = cityKey(stateName, name);

    if (!cities.has(key)) {
      cities.set(key, {
        name,
        stateName,
        countryCode: 'MX',
      });
    }
  }

  const result = [...cities.values()].sort(
    (a, b) =>
      a.stateName.localeCompare(b.stateName, 'es') ||
      a.name.localeCompare(b.name, 'es'),
  );

  const output = {
    source: 'CPdescarga.xml',
    generatedAt: new Date().toISOString(),
    total: result.length,
    cities: result,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Ciudades únicas: ${result.length}`);
  console.log(`Guardadas en ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
