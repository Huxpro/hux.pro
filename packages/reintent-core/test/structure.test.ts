// The layering: the core imports nothing outside itself, the libraries only the core's public
// entry, and instance files are literal: elements and literal props, no expressions. (Ported from
// Huxpro/airtalk#845; here the instance files are The Wardrobe's, experiences/reintent/program.)
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const repo = join(root, '..', '..');
const files = (dir: string, at = root) =>
  readdirSync(join(at, dir))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(at, dir, f));
const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);

test('the core imports nothing outside the core', () => {
  for (const f of files('src/core'))
    for (const i of imports(f)) assert.match(i, /^\.\/[\w-]+$/, `${f} imports ${i}`);
});

test('the libraries import only the core’s public entry (and each other)', () => {
  for (const f of files('src/lib'))
    for (const i of imports(f))
      assert.ok(i === '../core/index' || /^\.\/[\w-]+$/.test(i), `${f} imports ${i}`);
});

test('instance files hold only elements and literal props', () => {
  const instances = files('experiences/reintent/program', repo).filter((f) => f.endsWith('.tsx'));
  assert.ok(instances.length >= 2);
  for (const f of instances) {
    const sf = ts.createSourceFile(
      f,
      readFileSync(f, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const bad: string[] = [];
    const literal = (n: ts.Node): boolean =>
      ts.isStringLiteral(n) ||
      ts.isNumericLiteral(n) ||
      n.kind === ts.SyntaxKind.TrueKeyword ||
      n.kind === ts.SyntaxKind.FalseKeyword ||
      (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand)) ||
      // An element is literal too (its own props are checked as the walk reaches them): a
      // structural choice's alternatives are subtrees.
      ts.isJsxElement(n) ||
      ts.isJsxSelfClosingElement(n) ||
      ts.isJsxFragment(n) ||
      (ts.isArrayLiteralExpression(n) && n.elements.every(literal)) ||
      (ts.isObjectLiteralExpression(n) &&
        n.properties.every((p) => ts.isPropertyAssignment(p) && literal(p.initializer)));
    const visit = (n: ts.Node) => {
      if (ts.isJsxExpression(n) && n.expression && !literal(n.expression))
        bad.push(n.getText(sf).slice(0, 60));
      ts.forEachChild(n, visit);
    };
    sf.statements.filter(ts.isExportAssignment).forEach(visit);
    assert.deepEqual(bad, [], `${f}: expressions in an instance file`);
  }
});
