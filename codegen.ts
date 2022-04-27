import { Binop, BOOL, ClassDef, Expr, FunDef, Literal, NUM, Program, Stmt, Type, Uniop } from "./ast";

type VarEnv = Map<string, boolean>;
type ClassData = { fields: string[], indexOfField: Map<string, number>, valOfField: Map<string, Literal<Type>> };
type ClassEnv = Map<string, ClassData>;

export function codeGenProgram(prog: Program<Type>): string {
  const varEnv = new Map<string, boolean>();
  const classEnv = new Map<string, { fields: [], indexOfField: Map<string, number>, valOfField: Map<string, Literal<Type>> }>();
  const vars = prog.varDefs;
  const funs = prog.funDefs;
  const classes = prog.classDefs;
  const stmts = prog.stmts;

  const classesCode = classes.map(c => codeGenClass(c, varEnv, classEnv)).map(c => c.join("\n"));
  const allClasses = classesCode.join("\n\n");
  const funsCode = funs.map(f => codeGenFunc(f, varEnv, classEnv)).map(f => f.join("\n"));
  const allFuns = funsCode.join("\n\n");
  const varDecls = vars.map(v => `(global $${v.typedVar.name} (mut i32) ${codeGenLiteral(v.literal, varEnv, classEnv).join("")})`).join("\n");
  const allStmts = stmts.map(s => codeGenStmt(s, varEnv, classEnv)).map(f => f.join("\n"));

  const main = [`(local $scratch i32)`, ...allStmts].join("\n");

  let isExpr = false;
  if (stmts.length > 0 && stmts[stmts.length - 1].tag === "expr") {
    isExpr = true;
  }
  var retType = "";
  var retVal = "";
  if (isExpr) {
    retType = "(result i32)";
    retVal = "(local.get $scratch)"
  }

  return `
    (module
      (func $print_num (import "imports" "print_num") (param i32) (result i32))
      (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
      (func $print_none (import "imports" "print_none") (param i32) (result i32))
      (func $runtime_check (import "imports" "runtime_check") (param i32) (result i32))
      (func $abs (import "imports" "abs") (param i32) (result i32))
      (func $min (import "imports" "min") (param i32 i32) (result i32))
      (func $max (import "imports" "max") (param i32 i32) (result i32))
      (func $pow (import "imports" "pow") (param i32 i32) (result i32))
      (import "mem" "memory" (memory 1))
      (global $heap (mut i32) (i32.const 4))
      ${allClasses}
      ${varDecls}
      ${allFuns}
      (func (export "_start") ${retType}
        ${main}
        ${retVal}
      )
    ) 
  `;
}

export function codeGenClass(c: ClassDef<Type>, varEnv: VarEnv, classEnv: ClassEnv): Array<string> {
  const classData: ClassData = { fields: [], indexOfField: new Map(), valOfField: new Map() };
  c.fields.forEach((f, idx) => {
    classData.fields.push(f.typedVar.name);
    classData.indexOfField.set(f.typedVar.name, idx);
    classData.valOfField.set(f.typedVar.name, f.literal);
  });
  classEnv.set(c.name, classData);
  const methods = c.methods.map(m => {
    return codeGenFunc({ ...m, name: `${c.name}$${m.name}` }, varEnv, classEnv);
  }).flat();
  return methods;
}

export function codeGenFunc(f: FunDef<Type>, varEnv: VarEnv, classEnv: ClassEnv): Array<string> {
  const withParamsAndVariables = new Map<string, boolean>(varEnv.entries());

  // Construct the environment for the function body
  const variables = f.body.varDefs;
  variables.forEach(v => withParamsAndVariables.set(v.typedVar.name, true));
  f.params.forEach(p => withParamsAndVariables.set(p.name, true));

  // Construct the code for params and variable declarations in the body
  const params = f.params.map(p => `(param $${p.name} i32)`).join(" ");
  const varDecls = variables.map(v => `(local $${v.typedVar.name} i32)${codeGenLiteral(v.literal, varEnv, classEnv).join("")}(local.set $${v.typedVar.name})`).join("\n");

  const stmts = f.body.stmts.map(s => codeGenStmt(s, withParamsAndVariables, classEnv)).map(f => f.join("\n"));
  const stmtsBody = stmts.join("\n");
  if (f.name.includes("__init__")) {
    return [`(func $${f.name} ${params} (result i32)
    (local $scratch i32)
    ${varDecls}
    ${stmtsBody}
    (local.get $self)
    return
    (i32.const 0)
    )`];
  }
  return [`(func $${f.name} ${params} (result i32)
    (local $scratch i32)
    ${varDecls}
    ${stmtsBody}
    (i32.const 0)
    )`];
}

export function codeGenLiteral(literal: Literal<Type>, varEnv: VarEnv, classEnv: ClassEnv): Array<string> {
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

export function codeGenBinOp(binop: Binop): Array<string> {
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

export function codeGenExpr(expr: Expr<Type>, varEnv: VarEnv, classEnv: ClassEnv): Array<string> {
  switch (expr.tag) {
    case "literal": return codeGenLiteral(expr.literal, varEnv, classEnv);
    case "id":
      if (varEnv.has(expr.name)) { return [`(local.get $${expr.name})`]; }
      else { return [`(global.get $${expr.name})`]; }
    case "binexpr":
      const lhsExprs = codeGenExpr(expr.left, varEnv, classEnv);
      const rhsExprs = codeGenExpr(expr.right, varEnv, classEnv);
      const opstmts = codeGenBinOp(expr.op);
      return [...lhsExprs, ...rhsExprs, ...opstmts];
    case "uniexpr":
      switch (expr.op) {
        case Uniop.Minus:
          const dummyLit = <Literal<Type>>{ value: 0, tag: "num" };
          dummyLit.a = NUM;
          const dummyVar = <Expr<Type>>{ tag: "literal", literal: dummyLit };
          dummyVar.a = NUM;
          const lhsExprs = codeGenExpr(dummyVar, varEnv, classEnv);
          const rhsExprs = codeGenExpr(expr.expr, varEnv, classEnv);
          const opstmts = codeGenBinOp(Binop.Minus);
          return [...lhsExprs, ...rhsExprs, ...opstmts];
        case Uniop.Not:
          const dummyLitBool = <Literal<Type>>{ value: true, tag: "bool" };
          dummyLitBool.a = BOOL;
          const dummyVarBool = <Expr<Type>>{ tag: "literal", literal: dummyLitBool };
          dummyVarBool.a = BOOL;
          const lhsExprsBool = codeGenExpr(dummyVarBool, varEnv, classEnv);
          const rhsExprsBool = codeGenExpr(expr.expr, varEnv, classEnv);
          const opstmtsBool = codeGenBinOp(Binop.Minus);
          return [...lhsExprsBool, ...rhsExprsBool, ...opstmtsBool];
      }
    case "call":
      if (classEnv.has(expr.name)) {
        let initvals: string[] = [];
        const classData = classEnv.get(expr.name);
        classData.fields.forEach((f, idx) => {
          const offset = idx * 4;
          const val = classData.valOfField.get(f);
          initvals = [
            ...initvals,
            `(global.get $heap)`,
            `(i32.add (i32.const ${offset}))`,
            ...codeGenLiteral(val, varEnv, classEnv),
            `(i32.store)`];
        });
        return [
          ...initvals,
          `(global.get $heap)`,
          `(global.set $heap (i32.add (global.get $heap) (i32.const ${classData.fields.length * 4})))`,
          `(call $${expr.name}$__init__)`
        ];
      }
      const valStmts = expr.args.map(e => codeGenExpr(e, varEnv, classEnv)).map(f => f.join("\n"));
      let toCall = expr.name;
      if (expr.name === "print") {
        if (expr.args[0].a !== undefined) {
          switch (expr.args[0].a) {
            case BOOL: toCall = "print_bool"; break;
            default: toCall = "print_num"; break;
          }
        } else {
          toCall = "print_none";
        }
      }
      valStmts.push(`(call $${toCall})`);
      return valStmts;
    case "callmethod":
      const argInstrs = [expr.obj, ...expr.args].map(a => codeGenExpr(a, varEnv, classEnv)).flat();
      if (expr.obj.a.tag !== "class") {
        throw new Error("should not reach");
      }
      return [...argInstrs, `call $${expr.obj.a.name}$${expr.name}`];
    case "getfield":
      const objStmts = codeGenExpr(expr.obj, varEnv, classEnv);
      if (expr.obj.a.tag !== "class") {
        throw new Error("should not reach");
      }
      const classData = classEnv.get(expr.obj.a.name);
      const indexOfField = classData.indexOfField.get(expr.name);
      return [...objStmts,
        `(call $runtime_check)`,
      `(i32.add (i32.const ${indexOfField * 4}))`,
        `(i32.load)`,
      ];
    case "brackets":
      return codeGenExpr(expr.expr, varEnv, classEnv);
  }
}

export function codeGenStmt(stmt: Stmt<Type>, varEnv: VarEnv, classEnv: ClassEnv): Array<string> {
  switch (stmt.tag) {
    case "return":
      if (stmt.ret) {
        const valStmts = codeGenExpr(stmt.ret, varEnv, classEnv);
        valStmts.push("return");
        return valStmts;
      } else {
        const noneExpr = <Expr<Type>>{ tag: "literal", literal: { tag: "none" } };
        const valStmts = codeGenExpr(noneExpr, varEnv, classEnv);
        valStmts.push("return");
        return valStmts;
      }
    case "assign":
      const valStmts = codeGenExpr(stmt.value, varEnv, classEnv);
      if (varEnv.has(stmt.name)) { valStmts.push(`(local.set $${stmt.name})`); }
      else { valStmts.push(`(global.set $${stmt.name})`); }
      return valStmts;
    case "assignfield":
      const objStmts = codeGenExpr(stmt.obj, varEnv, classEnv);
      if (stmt.obj.a.tag !== "class") {
        throw new Error("should not reach");
      }
      const vStmts = codeGenExpr(stmt.value, varEnv, classEnv);
      const classData = classEnv.get(stmt.obj.a.name);
      const indexOfField = classData.indexOfField.get(stmt.name);
      return [...objStmts,
        `(call $runtime_check)`,
      `(i32.add (i32.const ${indexOfField * 4}))`,
      ...vStmts,
        `(i32.store)`,
      ];
    case "expr":
      const result = codeGenExpr(stmt.expr, varEnv, classEnv);
      result.push("(local.set $scratch)");
      return result;
    case "while":
      const condGenWhile = codeGenExpr(stmt.cond, varEnv, classEnv).join("\n");
      const stmtsWhile = stmt.stmts.map(s => codeGenStmt(s, varEnv, classEnv)).map(f => f.join("\n")).join("\n");
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
      const condGen = codeGenExpr(stmt.cond, varEnv, classEnv).join("\n");
      const stmts = stmt.stmts.map(s => codeGenStmt(s, varEnv, classEnv)).map(f => f.join("\n")).join("\n");
      let elifGen = "";
      let elseGen = "";
      if (stmt.else) {
        const elseStmts = stmt.else.map(s => codeGenStmt(s, varEnv, classEnv)).map(f => f.join("\n")).join("\n");
        elseGen = `
        (else
          ${elseStmts}
        )
        `
      }
      if (stmt.elif) {
        const elifCondGen = codeGenExpr(stmt.elif.cond, varEnv, classEnv).join("\n");
        const elifStmts = stmt.elif.stmts.map(s => codeGenStmt(s, varEnv, classEnv)).map(f => f.join("\n")).join("\n");
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