// A scene file is data, so tools can read and write it without a model.
//
//   checkScene(source)                 what makes it not data: a statement, a
//                                      hook, an expression, a missing or
//                                      repeated id
//   patchScene(source, id, prop, v)    one prop of one node, written back as
//                                      a literal: "slower" without a model
//
// Both work on the source text through TypeScript's own parser; neither runs
// the scene.

import ts from "typescript";

/** What a prop may be besides a literal: data constructors from `stage`, nothing that computes. */
export const BINDINGS = new Set(["ref", "after", "at.top", "at.bottom", "at.below", "rule.clear", "rule.below", "rule.onScreen", "rule.minTarget"]);

/** Elements that are not nodes, so take no `id`. */
const NOT_NODES = new Set(["Stage", "WayOut"]);

export interface SceneProblem {
  line: number;
  column: number;
  message: string;
}

const parse = (source: string, file = "scene.tsx") => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const where = (sf: ts.SourceFile, node: ts.Node) => {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return { line: line + 1, column: character + 1 };
};

/** Whether an expression is data: a literal, an array or object of them, or a binding call. */
function isData(e: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(e)) return isData(e.expression);
  if (ts.isNumericLiteral(e) || ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return true;
  if (e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) return ts.isNumericLiteral(e.operand);
  if (ts.isArrayLiteralExpression(e)) return e.elements.every(isData);
  if (ts.isObjectLiteralExpression(e)) {
    return e.properties.every((p) => ts.isPropertyAssignment(p) && !ts.isComputedPropertyName(p.name) && isData(p.initializer));
  }
  if (ts.isCallExpression(e)) return BINDINGS.has(e.expression.getText()) && e.arguments.every(isData);
  return false;
}

const tagName = (el: ts.JsxOpeningLikeElement) => el.tagName.getText();

const attr = (el: ts.JsxOpeningLikeElement, name: string) =>
  el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name);

const literalString = (a: ts.JsxAttribute | undefined) =>
  a?.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : undefined;

/** The JSX tree the scene's default export returns, or a problem saying why there is none. */
function sceneTree(sf: ts.SourceFile): { tree?: ts.JsxElement | ts.JsxSelfClosingElement; problem?: SceneProblem } {
  const fn = sf.statements.find(
    (s): s is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(s) && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
  );
  if (!fn?.body) return { problem: { line: 1, column: 1, message: "a scene file's default export is a function returning its tree" } };
  const [only, ...rest] = fn.body.statements;
  if (!only || rest.length || !ts.isReturnStatement(only) || !only.expression) {
    return {
      problem: { ...where(sf, rest[0] ?? only ?? fn), message: "a scene is one returned JSX tree: no statements, no hooks, no logic (put logic in a kind)" },
    };
  }
  let e: ts.Expression = only.expression;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (!ts.isJsxElement(e) && !ts.isJsxSelfClosingElement(e)) {
    return { problem: { ...where(sf, e), message: "a scene returns a single <Stage> element" } };
  }
  return { tree: e };
}

export function checkScene(source: string, file?: string): SceneProblem[] {
  const sf = parse(source, file);
  const { tree, problem } = sceneTree(sf);
  if (!tree) return [problem!];
  const problems: SceneProblem[] = [];
  const ids = new Map<string, ts.Node>();

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const open = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = tagName(open);
      for (const p of open.attributes.properties) {
        if (!ts.isJsxAttribute(p)) {
          problems.push({ ...where(sf, p), message: `<${tag}>: spread props hide what a node is; write each prop out` });
          continue;
        }
        const init = p.initializer;
        if (!init || ts.isStringLiteral(init)) continue;
        if (ts.isJsxExpression(init) && init.expression && !isData(init.expression)) {
          problems.push({
            ...where(sf, init.expression),
            message: `<${tag} ${p.name.getText()}>: only literals and ${[...BINDINGS].join(", ")} (found \`${init.expression.getText().slice(0, 40)}\`)`,
          });
        }
      }
      if (!NOT_NODES.has(tag)) {
        const id = literalString(attr(open, "id"));
        if (!id) problems.push({ ...where(sf, open), message: `<${tag}> needs a literal id: stable, unique, named for what it is` });
        else if (ids.has(id)) problems.push({ ...where(sf, open), message: `<${tag}>: id "${id}" is used twice` });
        else ids.set(id, open);
      }
      if (ts.isJsxElement(node)) {
        for (const child of node.children) {
          if (ts.isJsxExpression(child) && child.expression && !isData(child.expression)) {
            problems.push({ ...where(sf, child.expression), message: `<${tag}>: a child is words or nodes, not \`${child.expression.getText().slice(0, 40)}\`` });
          }
          visit(child);
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return problems;
}

/** A value as scene source: a number or boolean in braces, a string in quotes, anything else as data in braces. */
function literal(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return `{${JSON.stringify(value)}}`;
}

/**
 * Set one prop of the node with `id` to `value`, as a literal. Refuses when
 * the current value is not data (it was never ours to write over) or the node
 * is not there. Returns the new source.
 */
export function patchScene(source: string, id: string, prop: string, value: unknown): string {
  const sf = parse(source);
  const { tree, problem } = sceneTree(sf);
  if (!tree) throw new Error(problem!.message);
  let target: ts.JsxOpeningLikeElement | undefined;
  const find = (node: ts.Node) => {
    if (target) return;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && literalString(attr(node, "id")) === id) target = node;
    else ts.forEachChild(node, find);
  };
  find(tree);
  if (!target) throw new Error(`no node with id "${id}"`);
  const existing = attr(target, prop);
  if (existing) {
    const init = existing.initializer;
    if (init && ts.isJsxExpression(init) && init.expression && !isData(init.expression)) {
      throw new Error(`${id}.${prop} is not a literal; it cannot be written back`);
    }
    const start = (init ?? existing.name).getStart(sf);
    const end = init ? init.getEnd() : existing.getEnd();
    const replacement = init ? literal(value) : `${prop}=${literal(value)}`;
    return source.slice(0, start) + replacement + source.slice(end);
  }
  // A prop it did not have yet: after its id.
  const idAttr = attr(target, "id")!;
  return source.slice(0, idAttr.getEnd()) + ` ${prop}=${literal(value)}` + source.slice(idAttr.getEnd());
}
