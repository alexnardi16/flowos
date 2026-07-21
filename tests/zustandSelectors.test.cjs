const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

test('Zustand selectors in app screens return stable store references', () => {
  const files = walk(path.join(process.cwd(), 'app')).filter((file) => /\.[jt]sx?$/.test(file));
  const violations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const selectorPattern = /useFlowStore\s*\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([^;\n]+)/g;
    let match;

    while ((match = selectorPattern.exec(source)) !== null) {
      const expression = match[2];
      if (/\.(filter|map|sort|slice|reduce|flatMap)\s*\(/.test(expression) || /^\s*[\[{]/.test(expression)) {
        violations.push(`${path.relative(process.cwd(), file)}: ${match[0].trim()}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Selectors must return stable references. Derive arrays/objects with useMemo outside the selector:\n${violations.join('\n')}`,
  );
});
