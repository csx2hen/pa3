import wabt from "wabt";
import { Type as AstType } from "../ast";
import { codeGenProgram } from "../codegen";
import { parse } from "../parser";
import { typeCheckProgram } from "../typecheck";
import { importObject } from "./import-object.test";
import * as compiler from '../compiler';

// Modify typeCheck to return a `Type` as we have specified below
export function typeCheck(source: string): Type {
  const ast = parse(source)
  const typedAst = typeCheckProgram(ast)
  switch (typedAst.a) {
    case AstType.bool:
      return BOOL
    case AstType.int:
      return NUM
    case AstType.none:
      return NONE
    default:
      return CLASS("todo")
  }
}

// Modify run to use `importObject` (imported above) to use for printing
export async function run(source: string) {
  const wabtInterface = await wabt();
  const compiled = compiler.compile(source);
  const myModule = wabtInterface.parseWat("test.wat", compiled.wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, {imports: importObject.imports});
  (wasmModule.instance.exports as any)._start();
}

type Type =
  | "int"
  | "bool"
  | "none"
  | { tag: "object", class: string }

export const NUM: Type = "int";
export const BOOL: Type = "bool";
export const NONE: Type = "none";
export function CLASS(name: string): Type {
  return { tag: "object", class: name }
};
