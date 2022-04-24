import { Binop, Expr, FunDef, Literal, Program, Stmt, Type, TypedVar, Uniop, VarInit } from './ast';

type TypeEnv = {
  vars: Map<string, Type>,
  funs: Map<string, [Type[], Type]>,
  retType: Type|undefined,
  globalOverWrite: Set<string>
}

function duplicateEnv(env: TypeEnv) : TypeEnv {
  return {vars : new Map(env.vars), funs: new Map(env.funs), retType: env.retType, globalOverWrite: new Set(env.globalOverWrite)};
}

export const inBuiltFuncs :string[] = ['pow', 'abs', 'print', 'max', 'min'];
export const exclusiveIntOps :Binop[] = [Binop.Plus, Binop.Minus, Binop.Star, Binop.DoubleDash, Binop.Percentile, Binop.GreaterOrEqual,
                                Binop.GreaterThan, Binop.LessOrEqual, Binop.LessThan];
export const exclusiveNoneOps :Binop[] =  [Binop.Is];

export function getConditionTypeFromOp(binop: Binop) : Type {
  switch (binop) {
    case Binop.Plus:
      return Type.int;
    case Binop.Minus:
      return Type.int;
    case Binop.Star:
      return Type.int;
    case Binop.DoubleDash:
      return Type.int;
    case Binop.Percentile:
      return Type.int;
    case Binop.DoubleEquals:
      return Type.bool;
    case Binop.NotEqual:
      return Type.bool;
    case Binop.LessOrEqual:
      return Type.bool;
    case Binop.GreaterOrEqual:
      return Type.bool;
    case Binop.LessThan:
      return Type.bool;
    case Binop.GreaterThan:
      return Type.bool;
    case Binop.Is:
      return Type.bool;
  }
}

export function typeCheckProgram(prog: Program<null>) : Program<Type> {
  const env :TypeEnv = {vars: new Map(), funs: new Map(), retType: undefined, globalOverWrite: new Set()};
  const typedVarInits :VarInit<Type>[] = [];
  const typedFunDefs :FunDef<Type>[] = [];
  const typedStmts :Stmt<Type>[] = [];

  prog.varinits.forEach((varinit) => {
    const typedVarInit = typeCheckVarInit(varinit);
    typedVarInits.push(typedVarInit);
    if (env.vars.has(typedVarInit.type.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${typedVarInit.type.name}`);
    }
    env.vars.set(typedVarInit.type.name, typedVarInit.type.type);
  });

  prog.fundefs.forEach((fundef) => {
    if (inBuiltFuncs.includes(fundef.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${fundef.name}`);
    }
    if (env.funs.has(fundef.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${fundef.name}`);
    }
    env.funs.set(fundef.name, [fundef.params.map(param => param.type), fundef.ret]);
  });

  prog.fundefs.forEach((fundef) => {
    const typedFunDef = typeCheckFunDefs(fundef, env);
    typedFunDefs.push(typedFunDef);
    //env.funs.set(typedFunDef.name, [fundef.params.map(param => param.type), fundef.ret]);
  });

  prog.stmts.forEach((stmt) => {
    const typedStmt = typeCheckStmt(stmt, env, false);
    typedStmts.push(typedStmt);
  });

  return {...prog, varinits: typedVarInits, fundefs: typedFunDefs, stmts: typedStmts};
}

export function typeCheckVarInit(init: VarInit<null>) : VarInit<Type> {
  const typedVar = typeCheckTypedVar(init.type);
  const typedLiteral = typeCheckLiteral(init.literal);
  if (typedLiteral.a !== typedVar.a)
      throw new Error(`TYPE ERROR: expected type ${typedVar.a}, got ${typedLiteral.a}`);
  return {type: typedVar, a: typedVar.type, literal: typedLiteral};
}

export function typeCheckTypedVar(typedVar: TypedVar<null>) : TypedVar<Type> {
  return {...typedVar, a: typedVar.type};
}

export function typeCheckFunDefs(fun: FunDef<null>, env: TypeEnv) : FunDef<Type> {
  const localEnv = duplicateEnv(env);
  const typedParams: TypedVar<Type>[] = [];
  const typedVarInits: VarInit<Type>[] = [];
  const localMap: Set<string> = new Set();

  // add params to env
  fun.params.forEach(param => {
    const typedParam = typeCheckTypedVar(param);
    typedParams.push(typedParam);
    if (localMap.has(typedParam.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${typedParam.name}`);
    }
    localMap.add(typedParam.name);
    localEnv.globalOverWrite.add(typedParam.name);
    localEnv.vars.set(typedParam.name, typedParam.type);
  });

  // add inits to env
  // check inits
  fun.body.vardefs.forEach(vardef => {
    const typedVarDef = typeCheckVarInit(vardef);
    typedVarInits.push(typedVarDef);
    if (localMap.has(typedVarDef.type.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${typedVarDef.type.name}`);
    }
    localMap.add(typedVarDef.type.name);
    localEnv.globalOverWrite.add(typedVarDef.type.name);
    localEnv.vars.set(typedVarDef.type.name, typedVarDef.type.type);
  });

  // add fun type to env
  // localEnv.funs.set(fun.name, [fun.params.map(param => param.type), fun.ret]);

  // add ret type
  if (fun.ret !== undefined) {
    localEnv.retType = fun.ret;
  }

  // make sure every path has the expected return type
  const typedStmts :Stmt<Type>[] = [];
  let returnCame = false;
  fun.body.stmts.forEach((stmt) => {
    if (stmt.tag === "return") {
      returnCame = true;
    }
    typedStmts.push(typeCheckStmt(stmt, localEnv));
  });
  if (!returnCame) {
    throw new Error("TYPE ERROR: funtion must have a return statement");
  }
  return {...fun, a: fun.ret, params: typedParams, body: {vardefs: typedVarInits, stmts: typedStmts}};
}

export function typeCheckStmt(stmt: Stmt<null>, env: TypeEnv, checkGlobalAssign: boolean = true) : Stmt<Type> {
  switch (stmt.tag) {
    case "assign":
      if (!env.vars.has(stmt.name))
        throw new Error(`TYPE ERROR: not a variable ${stmt.name}`);
      if (checkGlobalAssign && !env.globalOverWrite.has(stmt.name))
        throw new Error(`TYPE ERROR: cannot assign to variable that is explicity not declared in this scope ${stmt.name}`);
      const typedValue = typeCheckExpr(stmt.value, env);
      if (typedValue.a !== env.vars.get(stmt.name))
        throw new Error(`TYPE ERROR: expected type ${env.vars.get(stmt.name)}, got ${typedValue.a}`);
      return stmt;
    case "return":
      if (stmt.ret === undefined) {
        if(env.retType !== undefined) {
          throw new Error(`TYPE ERROR: expected type none, got ${env.retType}`);
        }
        return {...stmt};
      } else {
        const typedRet = typeCheckExpr(stmt.ret, env);
        if (env.retType !== typedRet.a)
          throw new Error(`TYPE ERROR: expected type ${env.retType}, got ${typedRet.a}`);
        return {...stmt, ret: typedRet, a: typedRet.a};
      }
    case "if":
      const typedCondIf = typeCheckExpr(stmt.cond, env);
      if (typedCondIf.a !== Type.bool) {
        throw new Error(`TYPE ERROR: conditional expression cannot be of type ${typedCondIf.a}`);
      }
      const typedStmts :Stmt<Type>[] = [];
      stmt.stmts.forEach((stmt) => {
        typedStmts.push(typeCheckStmt(stmt, env, checkGlobalAssign));
      });
      let typedElif :{ cond: Expr<Type>, stmts: Stmt<Type>[] }|undefined = undefined;
      let typedElse :Stmt<Type>[]|undefined = undefined;

      if (stmt.elif) {
        const typedElifCond = typeCheckExpr(stmt.elif.cond, env);
        if (typedElifCond.a !== Type.bool) {
          throw new Error(`TYPE ERROR: conditional expression cannot be of type ${typedElifCond.a}`);
        }
        const typedElifStmts :Stmt<Type>[] = [];
        stmt.elif.stmts.forEach((stmt) => {
          typedElifStmts.push(typeCheckStmt(stmt, env, checkGlobalAssign));
        });
        typedElif = {cond: typedElifCond, stmts: typedElifStmts};
      }
      if (stmt.else) {
        typedElse = [];
        stmt.else.forEach((stmt) => {
          typedElse.push(typeCheckStmt(stmt, env));
        });
      }

      return {...stmt, cond: typedCondIf, stmts: typedStmts, elif: typedElif, else: typedElse};
    case "while":
      const typedCondWhile = typeCheckExpr(stmt.cond, env);
      if (typedCondWhile.a !== Type.bool) {
        throw new Error(`TYPE ERROR: conditional expression cannot be of type ${typedCondWhile.a}`);
      }
      const typedStmtsWhile :Stmt<Type>[] = [];
      stmt.stmts.forEach((stmt) => {
        typedStmtsWhile.push(typeCheckStmt(stmt, env));
      });
      return {...stmt, cond: typedCondWhile, stmts: typedStmtsWhile};
    case "pass":
      return stmt;
    case "expr":
      const typedExpr = typeCheckExpr(stmt.expr, env);
      return {...stmt, expr: typedExpr, a: typedExpr.a };
    default:
      throw new Error("TYPE ERROR: invalid expression");
  }
}

export function typeCheckExpr(expr: Expr<null>, env: TypeEnv) : Expr<Type> {
  switch(expr.tag) {
    case "id":
      if (!env.vars.has(expr.name)) {
        throw new Error(`TYPE ERROR: not a variable ${expr.name}`);
      }
      const idType = env.vars.get(expr.name);
      return { ...expr, a: idType}
    case "builtin1":
      const arg  = typeCheckExpr(expr.arg, env);
      return {...expr, arg: arg, a: arg.a};
    case "builtin2":
      const arg1 = typeCheckExpr(expr.arg1, env);
      const arg2 = typeCheckExpr(expr.arg2, env);
      if (arg1.a !== Type.int)
        throw new Error("TYPE ERROR: left must be int");
      if (arg2.a !== Type.int)
        throw new Error("TYPE ERROR: right must be int");
      return {...expr, arg1: arg1, arg2: arg2, a: Type.int }
    case "uniexpr":
      const uniOpType = getUniOpType(expr.op);
      const uniExpr = typeCheckExpr(expr.expr, env);
      if (uniOpType !== uniExpr.a) {
        throw new Error(`TYPE ERROR: cannot apply ${uniOpType} on type ${uniExpr.a}`);
      }
      return {...expr, a: uniOpType, expr: uniExpr};
    case "binexpr":
      const left = typeCheckExpr(expr.left, env);
      const right = typeCheckExpr(expr.right, env);
      if (exclusiveIntOps.includes(expr.op)) {
        if (left.a !== Type.int)
        throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        if (right.a !== Type.int)
          throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        return {...expr, left: left, right: right, a: getConditionTypeFromOp(expr.op) };
      } else if (exclusiveNoneOps.includes(expr.op)) {
        if (left.a !== undefined)
          throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        if (right.a !== undefined)
          throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        return {...expr, left: left, right: right, a: getConditionTypeFromOp(expr.op) };
      } 
      else if (left.a !== undefined && left.a === right.a) {
        return {...expr, left: left, right: right, a: getConditionTypeFromOp(expr.op) };
      } else {
        throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
      }
      
    case "brackets":
      const bracketExpr = typeCheckExpr(expr.expr, env);
      return {...expr, expr: bracketExpr, a: bracketExpr.a};
    case "call":
      if (!inBuiltFuncs.includes(expr.name) && !env.funs.has(expr.name)) {
        throw new Error(`TYPE ERROR: not a function ${expr.name}`);
      }
      if (inBuiltFuncs.includes(expr.name)) {
        const typedArgsInBuilt :Expr<Type>[] = [];
        expr.args.forEach((arg, idx) => {
          const typedArg = typeCheckExpr(arg, env);
          typedArgsInBuilt.push(typedArg);
        });
        switch (expr.name) {
          case "print":
            if (typedArgsInBuilt.length !== 1) {
              throw new Error(`TYPE ERROR: expected 1 arguments got ${typedArgsInBuilt.length}`);
            }
            return {...expr, args: typedArgsInBuilt};
          case "abs":
            if (typedArgsInBuilt.length !== 1) {
              throw new Error(`TYPE ERROR: expected 1 arguments got ${typedArgsInBuilt.length}`);
            }
            if (typedArgsInBuilt[0].a != Type.int) {
              throw new Error(`TYPE ERROR: expected type int, got type ${typedArgsInBuilt[0].a} in parameter 0`);
            }
            return {...expr, args: typedArgsInBuilt, a: Type.int};
          case "min":
          case "pow":
          case "max":
            if (typedArgsInBuilt.length !== 2) {
              throw new Error(`TYPE ERROR: expected 2 arguments got ${typedArgsInBuilt.length}`);
            }
            if (typedArgsInBuilt[0].a != Type.int) {
              throw new Error(`TYPE ERROR: expected type int, got type ${typedArgsInBuilt[0].a} in parameter 0`);
            }
            if (typedArgsInBuilt[1].a != Type.int) {
              throw new Error(`TYPE ERROR: expected type int, got type ${typedArgsInBuilt[0].a} in parameter 1`);
            }
            return {...expr, args: typedArgsInBuilt, a: Type.int};
        }
        return {...expr, args: typedArgsInBuilt, a: typedArgsInBuilt[0].a};
      }
      const func = env.funs.get(expr.name);
      if (func[0].length !== expr.args.length) {
        throw new Error(`TYPE ERROR: expected ${func[0].length} arguments got ${expr.args.length}`);
      }
      const typedArgs :Expr<Type>[] = [];
      expr.args.forEach((arg, idx) => {
        const typedArg = typeCheckExpr(arg, env);
        typedArgs.push(typedArg);
        if (typedArg.a !== func[0][idx]) {
          throw new Error(`TYPE ERROR: expected type ${func[0][idx]}, got type ${typedArg.a} in parameter ${idx}`);
        }
      });
      return {...expr, args: typedArgs, a: func[1]};
    case "literal":
      const lit = typeCheckLiteral(expr.literal)
      return {...expr, a: lit.a }
    default:
      throw new Error("TYPE ERROR: tag not handled in expr");
  }
}
export function typeCheckLiteral(literal: Literal<null>) : Literal<Type> {
  switch (literal.tag) {
    case "num":
      return {...literal, a: Type.int }
    case "bool":
      return {...literal, a: Type.bool }
    case "none":
      return {...literal }
  }
}

export function getUniOpType(uniop: Uniop) : Type {
  switch (uniop) {
    case Uniop.Not:
      return Type.bool;
    case Uniop.Minus:
      return Type.int;
    default:
      throw new Error("Uniop type does not exist");
  }
}