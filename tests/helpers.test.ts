import wabt from "wabt";
import { NUM as AstNUM, BOOL as AstBOOL, NONE as AstNone } from "../ast";
import { codeGenProgram } from "../codegen";
import { parse } from "../parser";
import { typeCheckProgram } from "../typecheck";
import { importObject } from "./import-object.test";
import * as compiler from '../compiler';

// Modify typeCheck to return a `Type` as we have specified below
export function typeCheck(source: string): Type {
  throw new Error(source);
  const ast = parse(source)
  const typedAst = typeCheckProgram(ast)
  if (typedAst.a.tag == "class")
    return CLASS(typedAst.a.name)
  switch (typedAst.a) {
    case AstBOOL:
      return BOOL
    case AstNUM:
      return NUM
    default:
      return NONE
  }
}

// Modify run to use `importObject` (imported above) to use for printing
export async function run(source: string) {
  throw new Error(source);
  const wabtInterface = await wabt();
  const compiled = compiler.compile(source);
  const myModule = wabtInterface.parseWat("test.wat", compiled.wasmSource);
  var asBinary = myModule.toBinary({});
  const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
  const imports = {
    ...importObject.imports,
    runtime_check: (arg: number) => {
      if (arg === 0) {
        throw new Error("RUNTIME ERROR: the obj is null")
      }
      return arg;
    },
  };
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, { imports: imports, mem: { memory: memory } });
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
