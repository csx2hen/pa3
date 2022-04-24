import { Stmt, Expr, Binop } from "./ast";
import { parse } from "./parser";
import { typeCheckProgram } from "./typecheck";
import { codeGenProgram } from './codegen';

// https://learnxinyminutes.com/docs/wasm/


type CompileResult = {
  wasmSource: string,
};

export function compile(source: string) : CompileResult {
  const ast = parse(source);
  console.log("PARSED AST", ast);
  const typedAst = typeCheckProgram(ast);
  console.log("TYPE CHECKED AST", typedAst);
  const wasmSource = codeGenProgram(typedAst);
  console.log("CODE GEN", wasmSource);
  return {
    wasmSource: wasmSource
  };
}
