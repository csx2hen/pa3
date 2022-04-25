import { Binop, BOOL, Expr, FunDef, Literal, NUM, Program, Stmt, Type, Uniop } from "./ast";

type Env = Map<string, boolean>;

export function codeGenProgram(prog: Program<Type>) : string {
  const emptyEnv = new Map<string, boolean>();
  const vars = prog.varDefs;
  const funs = prog.funDefs;
  const stmts = prog.stmts;

  const funsCode = funs.map(f => codeGenFunc(f, emptyEnv)).map(f => f.join("\n"));
  const allFuns = funsCode.join("\n\n");
  const varDecls = vars.map(v => `(global $${v.typedVar.name} (mut i32) ${codeGenLiteral(v.literal, emptyEnv).join("")})`).join("\n");
  const allStmts = stmts.map(s => codeGenStmt(s, emptyEnv)).map(f => f.join("\n"));

  const main = [`(local $scratch i32)`, ...allStmts].join("\n");

  let isExpr = false;
  if (stmts.length > 0 && stmts[stmts.length - 1].tag === "expr") {
    isExpr = true;
  }
  var retType = "";
  var retVal = "";
  if(isExpr) {
    retType = "(result i32)";
    retVal = "(local.get $scratch)"
  }

  return `
    (module
      (func $print_num (import "imports" "print_num") (param i32) (result i32))
      (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
      (func $print_none (import "imports" "print_none") (param i32) (result i32))
      (func $abs (import "imports" "abs") (param i32) (result i32))
      (func $min (import "imports" "min") (param i32 i32) (result i32))
      (func $max (import "imports" "max") (param i32 i32) (result i32))
      (func $pow (import "imports" "pow") (param i32 i32) (result i32))
      ${varDecls}
      ${allFuns}
      (func (export "_start") ${retType}
        ${main}
        ${retVal}
      )
    ) 
  `;
}

export function codeGenFunc(f: FunDef<Type>, locals :Env) : Array<string> {
  const withParamsAndVariables = new Map<string, boolean>(locals.entries());

  // Construct the environment for the function body
  const variables = f.body.varDefs;
  variables.forEach(v => withParamsAndVariables.set(v.typedVar.name, true));
  f.params.forEach(p => withParamsAndVariables.set(p.name, true));

  // Construct the code for params and variable declarations in the body
  const params = f.params.map(p => `(param $${p.name} i32)`).join(" ");
  const varDecls = variables.map(v => `(local $${v.typedVar.name} i32)${codeGenLiteral(v.literal, locals).join("")}(local.set $${v.typedVar.name})`).join("\n");

  const stmts = f.body.stmts.map(s => codeGenStmt(s, withParamsAndVariables)).map(f => f.join("\n"));
  const stmtsBody = stmts.join("\n");
  return [`(func $${f.name} ${params} (result i32)
    (local $scratch i32)
    ${varDecls}
    ${stmtsBody})`];
}

export function codeGenLiteral(literal: Literal<Type>, locals: Env) : Array<string> {
  switch (literal.tag) {
    case "bool":
      if (literal.value) return [`(i32.const 1)`];
      else return [`(i32.const 0)`];
    case "num":
      return [`(i32.const ${literal.value})`];
    case "none":
      return [`(i32.const 0)`];
  }
}

export function codeGenBinOp(binop: Binop) : Array<string> {
  switch (binop) {
    case Binop.Plus:
      return [`i32.add`];
    case Binop.Minus:
      return [`i32.sub`];
    case Binop.Star:
      return [`i32.mul`];
    case Binop.DoubleDash:
      return [`i32.div_s`];
    case Binop.Percentile:
      return [`i32.rem_s`];
    case Binop.DoubleEquals:
      return [`i32.eq`];
    case Binop.NotEqual:
      return [`i32.ne`];
    case Binop.LessOrEqual:
      return [`i32.le_s`];
    case Binop.GreaterOrEqual:
      return [`i32.ge_s`];
    case Binop.LessThan:
      return [`i32.lt_s`];
    case Binop.GreaterThan:
      return [`i32.gt_s`];
    case Binop.Is:
      return [`i32.eq`];
  }
}

export function codeGenExpr(expr : Expr<Type>, locals : Env) : Array<string> {
  switch(expr.tag) {
    case "literal": return codeGenLiteral(expr.literal, locals);
    case "id":
      if(locals.has(expr.name)) { return [`(local.get $${expr.name})`]; }
      else { return [`(global.get $${expr.name})`]; }
    case "binexpr":
      const lhsExprs = codeGenExpr(expr.left, locals);
      const rhsExprs = codeGenExpr(expr.right, locals);
      const opstmts = codeGenBinOp(expr.op);
      return [...lhsExprs, ...rhsExprs, ...opstmts];
    case "uniexpr":
      switch (expr.op) {
        case Uniop.Minus:
          const dummyLit = <Literal<Type>>{value: 0, tag: "num"};
          dummyLit.a = NUM;
          const dummyVar = <Expr<Type>>{tag:"literal", literal: dummyLit};
          dummyVar.a = NUM;
          const lhsExprs = codeGenExpr(dummyVar, locals);
          const rhsExprs = codeGenExpr(expr.expr, locals);
          const opstmts = codeGenBinOp(Binop.Minus);
          return [...lhsExprs, ...rhsExprs, ...opstmts];
        case Uniop.Not:
          const dummyLitBool = <Literal<Type>>{value: true, tag: "bool"};
          dummyLitBool.a = BOOL;
          const dummyVarBool = <Expr<Type>>{tag:"literal", literal: dummyLitBool};
          dummyVarBool.a = BOOL;
          const lhsExprsBool = codeGenExpr(dummyVarBool, locals);
          const rhsExprsBool = codeGenExpr(expr.expr, locals);
          const opstmtsBool = codeGenBinOp(Binop.Minus);
          return [...lhsExprsBool, ...rhsExprsBool, ...opstmtsBool];
      }
    case "call":
      const valStmts = expr.args.map(e => codeGenExpr(e, locals)).map(f => f.join("\n"));
      let toCall = expr.name;
      if(expr.name === "print") {
        if (expr.args[0].a !== undefined) {
          switch(expr.args[0].a) {
            case BOOL: toCall = "print_bool"; break;
            default: toCall = "print_num"; break;
          }
        } else {
          toCall = "print_none";
        }
      }
      valStmts.push(`(call $${toCall})`);
      return valStmts;
    case "brackets":
      return codeGenExpr(expr.expr, locals);
  }
}

export function codeGenStmt(stmt : Stmt<Type>, locals : Env) : Array<string> {
  switch(stmt.tag) {
    case "return":
      if (stmt.ret) {
        const valStmts = codeGenExpr(stmt.ret, locals);
        valStmts.push("return");
        return valStmts;
      } else {
        const noneExpr = <Expr<Type>>{tag: "literal", literal: {tag: "none"}};
        const valStmts = codeGenExpr(noneExpr, locals);
        valStmts.push("return");
        return valStmts;
      }
    case "assign":
      const valStmts = codeGenExpr(stmt.value, locals);
      if(locals.has(stmt.name)) { valStmts.push(`(local.set $${stmt.name})`); }
      else { valStmts.push(`(global.set $${stmt.name})`); }
      return valStmts;
    case "expr":
      const result = codeGenExpr(stmt.expr, locals);
      result.push("(local.set $scratch)");
      return result;
    case "while":
      const condGenWhile = codeGenExpr(stmt.cond, locals).join("\n");
      const stmtsWhile = stmt.stmts.map(s => codeGenStmt(s, locals)).map(f => f.join("\n")).join("\n");
      return [`(
        loop $while
        ${condGenWhile}
        (if
          (then
            ${stmtsWhile}
            br $while
          )
        )
      )`];
    case "if":
      const condGen = codeGenExpr(stmt.cond, locals).join("\n");
      const stmts = stmt.stmts.map(s => codeGenStmt(s, locals)).map(f => f.join("\n")).join("\n");
      let elifGen = "";
      let elseGen = "";
      if (stmt.else) {
        const elseStmts = stmt.else.map(s => codeGenStmt(s, locals)).map(f => f.join("\n")).join("\n");
        elseGen = `
        (else
          ${elseStmts}
        )
        `
      }
      if (stmt.elif) {
        const elifCondGen = codeGenExpr(stmt.elif.cond, locals).join("\n");
        const elifStmts = stmt.elif.stmts.map(s => codeGenStmt(s, locals)).map(f => f.join("\n")).join("\n");
        if (stmt.else === undefined) { 
          elifGen = `
          (else
            ${elifCondGen}
            (if (then ${elifStmts}))
          )
          `
        } else {
          elifGen = `
          (else
            ${elifCondGen}
            (if 
              (then ${elifStmts})
              ${elseGen}
            )
          )
          `
        }
        return [`
        ${condGen}
        (if
           (then
             ${stmts}
           )
           ${elifGen}
        )
       `]; 
      }
      return [`
       ${condGen}
       (if
          (then
            ${stmts}
          )
          ${elseGen}
       )
      `];
    case "pass":
      return [];
  }
}