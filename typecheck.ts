import { Binop, BOOL, CLASS, ClassDef, Expr, FunDef, Literal, NONE, NUM, Program, Stmt, Type, TypedVar, Uniop, VarDef } from './ast';

type TypeEnv = {
  vars: Map<string, Type>,
  funs: Map<string, [Type[], Type]>,
  classes: Map<string, [Map<string, Type>, Map<string, [Type[], Type]>]>
  retType: Type | undefined,
  globalOverWrite: Set<string>
}

function duplicateEnv(env: TypeEnv): TypeEnv {
  return {
    vars: new Map(env.vars),
    funs: new Map(env.funs),
    retType: env.retType,
    classes: new Map(env.classes),
    globalOverWrite: new Set(env.globalOverWrite),
  };
}

export const inBuiltFuncs: string[] = ['pow', 'abs', 'print', 'max', 'min'];
export const exclusiveIntOps: Binop[] = [Binop.Plus, Binop.Minus, Binop.Star, Binop.DoubleDash, Binop.Percentile, Binop.GreaterOrEqual,
Binop.GreaterThan, Binop.LessOrEqual, Binop.LessThan];
export const exclusiveNoneOps: Binop[] = [Binop.Is];

export function getConditionTypeFromOp(binop: Binop): Type {
  switch (binop) {
    case Binop.Plus:
      return NUM;
    case Binop.Minus:
      return NUM;
    case Binop.Star:
      return NUM;
    case Binop.DoubleDash:
      return NUM;
    case Binop.Percentile:
      return NUM;
    case Binop.DoubleEquals:
      return BOOL;
    case Binop.NotEqual:
      return BOOL;
    case Binop.LessOrEqual:
      return BOOL;
    case Binop.GreaterOrEqual:
      return BOOL;
    case Binop.LessThan:
      return BOOL;
    case Binop.GreaterThan:
      return BOOL;
    case Binop.Is:
      return BOOL;
  }
}

export function typeCheckProgram(prog: Program<null>): Program<Type> {
  const env: TypeEnv = { vars: new Map(), funs: new Map(), classes: new Map(), retType: undefined, globalOverWrite: new Set() };
  const typedVarInits: VarDef<Type>[] = [];
  const typedFunDefs: FunDef<Type>[] = [];
  const typedClassDefs: ClassDef<Type>[] = [];
  const typedStmts: Stmt<Type>[] = [];

  prog.classDefs.forEach((classDef) => {
    if (env.classes.has(classDef.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${classDef.name}`);
    }
    const fields = new Map();
    const methods = new Map();
    classDef.fields.forEach((field) => {
      if (fields.has(field.typedVar.name)) {
        throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${field.typedVar.name}`);
      }
      fields.set(field.typedVar.name, field.typedVar.type);
    });
    classDef.methods.forEach((method) => {
      if (methods.has(method.name)) {
        throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${method.name}`);
      }
      methods.set(method.name, [method.params.map((p) => p.type), method.ret]);
    });
    env.classes.set(classDef.name, [fields, methods]);
  });

  prog.varDefs.forEach((varDef) => {
    const typedVarDef = typeCheckVarDef(varDef, env);
    typedVarInits.push(typedVarDef);
    if (env.vars.has(typedVarDef.typedVar.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${typedVarDef.typedVar.name}`);
    }
    env.vars.set(typedVarDef.typedVar.name, typedVarDef.typedVar.type);
  });

  prog.funDefs.forEach((funDef) => {
    if (inBuiltFuncs.includes(funDef.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${funDef.name}`);
    }
    if (env.funs.has(funDef.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${funDef.name}`);
    }
    env.funs.set(funDef.name, [funDef.params.map(param => param.type), funDef.ret]);
  });

  prog.funDefs.forEach((funDef) => {
    const typedFunDef = typeCheckFunDef(funDef, env);
    typedFunDefs.push(typedFunDef);
  });

  prog.classDefs.forEach((classDef) => {
    const typedClassDef = typeCheckClassDef(classDef, env);
    typedClassDefs.push(typedClassDef);
  });

  prog.stmts.forEach((stmt) => {
    const typedStmt = typeCheckStmt(stmt, env, false);
    typedStmts.push(typedStmt);
  });

  let lastType = NONE;
  if (typedStmts.length > 0 && typedStmts[typedStmts.length - 1].tag === "expr") {
    lastType = typedStmts[typedStmts.length - 1].a;
  }

  return { ...prog, a: lastType, varDefs: typedVarInits, funDefs: typedFunDefs, classDefs: typedClassDefs, stmts: typedStmts };
}

export function assignableTo(s: Type, t: Type): boolean {
  if (s === t) return true;
  if (s.tag === "class") return t.tag === "class" && t.name === s.name;
  if (s === NONE) return t.tag === "class";
  return false;
}

export function typeCheckVarDef(varDef: VarDef<null>, env: TypeEnv): VarDef<Type> {
  const typedVar = typeCheckTypedVar(varDef.typedVar, env);
  const typedLiteral = typeCheckLiteral(varDef.literal);
  if (!assignableTo(typedLiteral.a, typedVar.a))
    throw new Error(`TYPE ERROR: expected type ${typedVar.a}, got ${typedLiteral.a}`);
  return { ...varDef, a: typedVar.type, typedVar: typedVar, literal: typedLiteral };
}

export function typeCheckTypedVar(typedVar: TypedVar<null>, env: TypeEnv): TypedVar<Type> {
  if (typedVar.type.tag === "class" && !env.classes.has(typedVar.type.name)) {
    throw new Error(`TYPE ERROR: unknown class ${typedVar.type.name}`);
  }
  return { ...typedVar, a: typedVar.type };
}

export function typeCheckFunDef(fun: FunDef<null>, env: TypeEnv): FunDef<Type> {
  const localEnv = duplicateEnv(env);
  const typedParams: TypedVar<Type>[] = [];
  const typedVarDefs: VarDef<Type>[] = [];
  const localMap: Set<string> = new Set();

  // add params to env
  fun.params.forEach(param => {
    const typedParam = typeCheckTypedVar(param, localEnv);
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
  fun.body.varDefs.forEach(vardef => {
    const typedVarDef = typeCheckVarDef(vardef, localEnv);
    typedVarDefs.push(typedVarDef);
    if (localMap.has(typedVarDef.typedVar.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${typedVarDef.typedVar.name}`);
    }
    localMap.add(typedVarDef.typedVar.name);
    localEnv.globalOverWrite.add(typedVarDef.typedVar.name);
    localEnv.vars.set(typedVarDef.typedVar.name, typedVarDef.typedVar.type);
  });

  // add fun type to env
  // localEnv.funs.set(fun.name, [fun.params.map(param => param.type), fun.ret]);

  // add ret type
  if (fun.ret !== undefined) {
    localEnv.retType = fun.ret;
  }

  // make sure every path has the expected return type
  const typedStmts: Stmt<Type>[] = [];
  let returnCame = false;
  fun.body.stmts.forEach((stmt) => {
    if (stmt.tag === "return") {
      returnCame = true;
    }
    typedStmts.push(typeCheckStmt(stmt, localEnv));
  });
  // if (!returnCame) {
  //   throw new Error("TYPE ERROR: funtion must have a return statement");
  // }
  return { ...fun, a: fun.ret, params: typedParams, body: { varDefs: typedVarDefs, stmts: typedStmts } };
}

export function typeCheckClassDef(cls: ClassDef<null>, env: TypeEnv): ClassDef<Type> {
  const localEnv = duplicateEnv(env);
  const typedVarDefs: VarDef<Type>[] = [];
  const typedFunDefs: FunDef<Type>[] = [];
  const localMap: Set<string> = new Set();

  cls.fields.forEach(field => {
    const typedVarDef = typeCheckVarDef(field, localEnv);
    typedVarDefs.push(typedVarDef);
    if (localMap.has(typedVarDef.typedVar.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${typedVarDef.typedVar.name}`);
    }
    localMap.add(typedVarDef.typedVar.name);
    localEnv.globalOverWrite.add(typedVarDef.typedVar.name);
    localEnv.vars.set(typedVarDef.typedVar.name, typedVarDef.typedVar.type);
  });

  cls.methods.forEach(method => {
    const typedFunDef = typeCheckFunDef(method, env);
    typedFunDefs.push(typedFunDef);
    if (localMap.has(typedFunDef.name)) {
      throw new Error(`TYPE ERROR: duplicate declaration of identifier in same scope ${typedFunDef.name}`);
    }
    localMap.add(typedFunDef.name);
    localEnv.funs.set(typedFunDef.name, [typedFunDef.params.map((p) => p.type), typedFunDef.ret]);
  });

  return { ...cls, a: CLASS(cls.name), fields: typedVarDefs, methods: typedFunDefs };
}

export function typeCheckStmt(stmt: Stmt<null>, env: TypeEnv, checkGlobalAssign: boolean = true): Stmt<Type> {
  switch (stmt.tag) {
    case "assign":
      if (!env.vars.has(stmt.name))
        throw new Error(`TYPE ERROR: not a variable ${stmt.name}`);
      if (checkGlobalAssign && !env.globalOverWrite.has(stmt.name))
        throw new Error(`TYPE ERROR: cannot assign to variable that is explicity not declared in this scope ${stmt.name}`);
      const typedValue = typeCheckExpr(stmt.value, env);
      if (!assignableTo(typedValue.a, env.vars.get(stmt.name)))
        throw new Error(`TYPE ERROR: expected type ${env.vars.get(stmt.name)}, got ${typedValue.a}`);
      return { ...stmt, value: typedValue };
    case "assignfield":
      const fieldObj = typeCheckExpr(stmt.obj, env);
      const fieldVal = typeCheckExpr(stmt.value, env);
      if (fieldObj.a.tag !== "class") {
        throw new Error(`TYPE ERROR: expected type class, got ${fieldObj.a.tag}`);
      }
      if (!env.classes.has(fieldObj.a.name)) {
        throw new Error(`TYPE ERROR: unknown class ${fieldObj.a.name}`);
      }
      if (!env.classes.get(fieldObj.a.name)[0].has(stmt.name)) {
        throw new Error(`TYPE ERROR: cannot find field ${fieldObj.a.name} in class ${fieldObj.a.name}`);
      }
      if (!assignableTo(fieldVal.a, env.classes.get(fieldObj.a.name)[0].get(stmt.name))) {
        throw new Error(`TYPE ERROR: expected type ${env.classes.get(fieldObj.a.name)[0].get(stmt.name)}, got ${fieldVal.a}`);
      }
      return { ...stmt, obj: fieldObj, value: fieldVal };
    case "return":
      if (stmt.ret === undefined) {
        if (env.retType !== undefined) {
          throw new Error(`TYPE ERROR: expected type none, got ${env.retType}`);
        }
        return { ...stmt };
      } else {
        const typedRet = typeCheckExpr(stmt.ret, env);
        if (!assignableTo(typedRet.a, env.retType))
          throw new Error(`TYPE ERROR: expected type ${env.retType}, got ${typedRet.a}`);
        return { ...stmt, ret: typedRet, a: typedRet.a };
      }
    case "if":
      const typedCondIf = typeCheckExpr(stmt.cond, env);
      if (typedCondIf.a !== BOOL) {
        throw new Error(`TYPE ERROR: conditional expression cannot be of type ${typedCondIf.a}`);
      }
      const typedStmts: Stmt<Type>[] = [];
      stmt.stmts.forEach((stmt) => {
        typedStmts.push(typeCheckStmt(stmt, env, checkGlobalAssign));
      });
      checkReturn(typedStmts, env);
      let typedElif: { cond: Expr<Type>, stmts: Stmt<Type>[] } | undefined = undefined;
      let typedElse: Stmt<Type>[] | undefined = undefined;

      if (stmt.elif) {
        const typedElifCond = typeCheckExpr(stmt.elif.cond, env);
        if (typedElifCond.a !== BOOL) {
          throw new Error(`TYPE ERROR: conditional expression cannot be of type ${typedElifCond.a}`);
        }
        const typedElifStmts: Stmt<Type>[] = [];
        stmt.elif.stmts.forEach((stmt) => {
          typedElifStmts.push(typeCheckStmt(stmt, env, checkGlobalAssign));
        });
        checkReturn(typedElifStmts, env);
        typedElif = { cond: typedElifCond, stmts: typedElifStmts };
      }
      if (stmt.else) {
        typedElse = [];
        stmt.else.forEach((stmt) => {
          typedElse.push(typeCheckStmt(stmt, env, checkGlobalAssign));
        });
        checkReturn(typedElse, env);
      } else {
        throw new Error(`TYPE ERROR: if must have else`);
      }

      return { ...stmt, cond: typedCondIf, stmts: typedStmts, elif: typedElif, else: typedElse };
    case "while":
      const typedCondWhile = typeCheckExpr(stmt.cond, env);
      if (typedCondWhile.a !== BOOL) {
        throw new Error(`TYPE ERROR: conditional expression cannot be of type ${typedCondWhile.a}`);
      }
      const typedStmtsWhile: Stmt<Type>[] = [];
      stmt.stmts.forEach((stmt) => {
        typedStmtsWhile.push(typeCheckStmt(stmt, env, checkGlobalAssign));
      });
      return { ...stmt, cond: typedCondWhile, stmts: typedStmtsWhile };
    case "pass":
      return stmt;
    case "expr":
      const typedExpr = typeCheckExpr(stmt.expr, env);
      return { ...stmt, expr: typedExpr, a: typedExpr.a };
    default:
      throw new Error("TYPE ERROR: invalid expression");
  }
}

function checkReturn(stmts: Stmt<Type>[], env: TypeEnv) {
  if (env.retType !== undefined) {
    if (stmts.length === 0 || stmts[stmts.length - 1].tag !== "return"){
      throw new Error("TYPE ERROR: missing return");
    } else if (!assignableTo(stmts[stmts.length - 1].a, env.retType)) {
      throw new Error(`TYPE ERROR: expected return type ${env.retType}, got ${stmts[stmts.length - 1].a}`);
    }
  }
}

export function typeCheckExpr(expr: Expr<null>, env: TypeEnv): Expr<Type> {
  switch (expr.tag) {
    case "id":
      if (!env.vars.has(expr.name)) {
        throw new Error(`TYPE ERROR: not a variable ${expr.name}`);
      }
      const idType = env.vars.get(expr.name);
      return { ...expr, a: idType }
    case "builtin1":
      const arg = typeCheckExpr(expr.arg, env);
      return { ...expr, arg: arg, a: arg.a };
    case "builtin2":
      const arg1 = typeCheckExpr(expr.arg1, env);
      const arg2 = typeCheckExpr(expr.arg2, env);
      if (arg1.a !== NUM)
        throw new Error("TYPE ERROR: left must be int");
      if (arg2.a !== NUM)
        throw new Error("TYPE ERROR: right must be int");
      return { ...expr, arg1: arg1, arg2: arg2, a: NUM }
    case "uniexpr":
      const uniOpType = getUniOpType(expr.op);
      const uniExpr = typeCheckExpr(expr.expr, env);
      if (uniOpType !== uniExpr.a) {
        throw new Error(`TYPE ERROR: cannot apply ${uniOpType} on type ${uniExpr.a}`);
      }
      return { ...expr, a: uniOpType, expr: uniExpr };
    case "binexpr":
      const left = typeCheckExpr(expr.left, env);
      const right = typeCheckExpr(expr.right, env);
      if (exclusiveIntOps.includes(expr.op)) {
        if (left.a !== NUM)
          throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        if (right.a !== NUM)
          throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        return { ...expr, left: left, right: right, a: getConditionTypeFromOp(expr.op) };
      } else if (exclusiveNoneOps.includes(expr.op)) {
        if (left.a.tag !== "none" && left.a.tag != "class")
          throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        if (right.a.tag !== "none" && right.a.tag != "class")
          throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
        return { ...expr, left: left, right: right, a: getConditionTypeFromOp(expr.op) };
      }
      else if (left.a !== undefined && left.a === right.a) {
        return { ...expr, left: left, right: right, a: getConditionTypeFromOp(expr.op) };
      } else {
        throw new Error(`TYPE ERROR: cannot apply ${expr.op} on types ${left.a} and ${right.a}`);
      }

    case "brackets":
      const bracketExpr = typeCheckExpr(expr.expr, env);
      return { ...expr, expr: bracketExpr, a: bracketExpr.a };
    case "call":
      if (env.classes.has(expr.name)) {
        const args = env.classes.get(expr.name)[1].get("__init__")[0];
        const typedArgs: Expr<Type>[] = [];
        expr.args.forEach((arg, idx) => {
          const typedArg = typeCheckExpr(arg, env);
          if (!assignableTo(typedArg.a, args[idx + 1])) {
            throw new Error(`TYPE ERROR: arg type mismatch`);
          }
          typedArgs.push(typedArg);
        });
        return { ...expr, a: CLASS(expr.name), args: typedArgs };
      }
      if (!inBuiltFuncs.includes(expr.name) && !env.funs.has(expr.name)) {
        throw new Error(`TYPE ERROR: not a function ${expr.name}`);
      }
      if (inBuiltFuncs.includes(expr.name)) {
        const typedArgsInBuilt: Expr<Type>[] = [];
        expr.args.forEach((arg, idx) => {
          const typedArg = typeCheckExpr(arg, env);
          typedArgsInBuilt.push(typedArg);
        });
        switch (expr.name) {
          case "print":
            if (typedArgsInBuilt.length !== 1) {
              throw new Error(`TYPE ERROR: expected 1 arguments got ${typedArgsInBuilt.length}`);
            }
            return { ...expr, args: typedArgsInBuilt, a: NONE };
          case "abs":
            if (typedArgsInBuilt.length !== 1) {
              throw new Error(`TYPE ERROR: expected 1 arguments got ${typedArgsInBuilt.length}`);
            }
            if (typedArgsInBuilt[0].a != NUM) {
              throw new Error(`TYPE ERROR: expected type int, got type ${typedArgsInBuilt[0].a} in parameter 0`);
            }
            return { ...expr, args: typedArgsInBuilt, a: NUM };
          case "min":
          case "pow":
          case "max":
            if (typedArgsInBuilt.length !== 2) {
              throw new Error(`TYPE ERROR: expected 2 arguments got ${typedArgsInBuilt.length}`);
            }
            if (typedArgsInBuilt[0].a != NUM) {
              throw new Error(`TYPE ERROR: expected type int, got type ${typedArgsInBuilt[0].a} in parameter 0`);
            }
            if (typedArgsInBuilt[1].a != NUM) {
              throw new Error(`TYPE ERROR: expected type int, got type ${typedArgsInBuilt[0].a} in parameter 1`);
            }
            return { ...expr, args: typedArgsInBuilt, a: NUM };
        }
        return { ...expr, args: typedArgsInBuilt, a: typedArgsInBuilt[0].a };
      }
      const func = env.funs.get(expr.name);
      if (func[0].length !== expr.args.length) {
        throw new Error(`TYPE ERROR: expected ${func[0].length} arguments got ${expr.args.length}`);
      }
      const typedArgs: Expr<Type>[] = [];
      expr.args.forEach((arg, idx) => {
        const typedArg = typeCheckExpr(arg, env);
        typedArgs.push(typedArg);
        if (typedArg.a !== func[0][idx]) {
          throw new Error(`TYPE ERROR: expected type ${func[0][idx]}, got type ${typedArg.a} in parameter ${idx}`);
        }
      });
      return { ...expr, args: typedArgs, a: func[1] };
    case "literal":
      const lit = typeCheckLiteral(expr.literal)
      return { ...expr, a: lit.a }
    case "getfield":
      const getFieldObj = typeCheckExpr(expr.obj, env);
      if (getFieldObj.a.tag === "class") {
        if (env.classes.has(getFieldObj.a.name)) {
          if (env.classes.get(getFieldObj.a.name)[0].has(expr.name)) {
            return { ...expr, a: env.classes.get(getFieldObj.a.name)[0].get(expr.name), obj: getFieldObj };
          } else {
            throw new Error(`TYPE ERROR: cannot find field ${expr.name} in class ${getFieldObj.a.name}`);
          }
        } else {
          throw new Error(`TYPE ERROR: unknown class ${getFieldObj.a.name}`);
        }
      } else {
        throw new Error(`TYPE ERROR: expected class, got type ${getFieldObj.a.tag}`);
      }
    case "callmethod":
      const callMethodObj = typeCheckExpr(expr.obj, env);
      if (callMethodObj.a.tag === "class") {
        if (env.classes.has(callMethodObj.a.name)) {
          if (env.classes.get(callMethodObj.a.name)[1].has(expr.name)) {
            const args = env.classes.get(callMethodObj.a.name)[1].get(expr.name)[0];
            const ret = env.classes.get(callMethodObj.a.name)[1].get(expr.name)[1];
            const typedArgs: Expr<Type>[] = [];
            expr.args.forEach((arg, idx) => {
              const typedArg = typeCheckExpr(arg, env);
              if (!assignableTo(typedArg.a, args[idx + 1])) {
                throw new Error(`TYPE ERROR: arg type mismatch`);
              }
              typedArgs.push(typedArg);
            });
            return { ...expr, a: ret, obj: callMethodObj, args: typedArgs };
          } else {
            throw new Error(`TYPE ERROR: cannot find method ${expr.name} in class ${callMethodObj.a.name}`);
          }
        } else {
          throw new Error(`TYPE ERROR: unknown class ${callMethodObj.a.name}`);
        }
      } else {
        throw new Error(`TYPE ERROR: expected class, got type ${callMethodObj.a.tag}`);
      }
    default:
      throw new Error("TYPE ERROR: tag not handled in expr");
  }
}

export function typeCheckLiteral(literal: Literal<null>): Literal<Type> {
  switch (literal.tag) {
    case "num":
      return { ...literal, a: NUM }
    case "bool":
      return { ...literal, a: BOOL }
    case "none":
      return { ...literal, a: NONE }
  }
}

export function getUniOpType(uniop: Uniop): Type {
  switch (uniop) {
    case Uniop.Not:
      return BOOL;
    case Uniop.Minus:
      return NUM;
    default:
      throw new Error("TYPE ERROR: uniop type does not exist");
  }
}