import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import { Binop, Expr, FunDef, Literal, Program, Stmt, Type, TypedVar, Uniop, VarInit } from "./ast";
import { stringifyTree } from "./treeprinter";

export function getBoolean(s: string) : boolean {
  switch (s) {
    case "True":
      return true;
    case "False":
      return false;
    default:
      throw new Error("Parse error: invalid boolean type");
  }
}

export function traverseUniOp(c: TreeCursor, s: string) : Uniop {
  switch (s.substring(c.from, c.to)) {
    case "-":
      return Uniop.Minus
    case "not":
      return Uniop.Not
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseBinOp(c: TreeCursor, s: string) : Binop {
  switch (s.substring(c.from, c.to)) {
    case "+":
      return Binop.Plus
    case "-":
      return Binop.Minus
    case "*":
      return Binop.Star
    case "//":
      return Binop.DoubleDash
    case "%":
      return Binop.Percentile
    case "==":
      return Binop.DoubleEquals
    case "!=":
      return Binop.NotEqual
    case "<=":
      return Binop.LessOrEqual
    case ">=":
      return Binop.GreaterOrEqual
    case "<":
      return Binop.LessThan
    case ">":
      return Binop.GreaterThan
    case "is":
      return Binop.Is
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseExpr(c : TreeCursor, s : string) : Expr<null> {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "literal",
        literal: <Literal<null>>{tag: "num", value: Number(s.substring(c.from, c.to))}
      }
    case "Boolean":
      return {
        tag: "literal",
        literal: <Literal<null>>{tag: "bool", value: getBoolean(s.substring(c.from, c.to))}
      }
    case "None":
      return {
        tag: "literal",
        literal: <Literal<null>>{tag: "none"}
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }
    case "CallExpression":
      c.firstChild();
      const callName = s.substring(c.from, c.to);
      const argList :Expr<null>[] = [];
      c.nextSibling(); // arg list
      c.firstChild();
      while (c.node.type.name != ')') {
        c.nextSibling(); // skip ( or ,
        if (c.node.type.name == ')') break;
        argList.push(traverseExpr(c, s));
        c.nextSibling();
      }
      c.parent();
      c.parent();
      return {
        tag: "call",
        name: callName,
        args: argList
      }
    case "UnaryExpression":
      c.firstChild();
      const uniOp = traverseUniOp(c, s);
      c.nextSibling();
      const uniExpr = traverseExpr(c, s);
      c.parent();
      return {
        tag: "uniexpr",
        op: uniOp,
        expr: uniExpr
      };
    case "BinaryExpression":
      c.firstChild(); // go into binary expression
      const left = traverseExpr(c, s);
      c.nextSibling();
      const binOp = traverseBinOp(c, s);
      c.nextSibling();
      const right = traverseExpr(c, s);
      c.parent();
      return {
        tag: "binexpr",
        op: binOp,
        left: left,
        right: right
      };
    case "ParenthesizedExpression":
      c.firstChild();
      c.nextSibling();
      const bracketExpr = traverseExpr(c, s);
      c.parent();
      return {tag: "brackets", expr: bracketExpr};
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseWhileStmt(c: TreeCursor, s: string) : Stmt<null> {
  c.nextSibling(); // cond
  const cond = traverseExpr(c, s);
  const stmts :Stmt<null>[] = [];
  let hasStatement = false;
  c.nextSibling(); // body
  c.firstChild(); // :
  while (c.nextSibling()) {
    hasStatement = true;
    stmts.push(traverseStmt(c, s));
  }
  c.parent();
  if (!hasStatement) {
    throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
  return {tag: "while", stmts: stmts, cond: cond};
}

export function traverseIfStmt(c: TreeCursor, s: string) : Stmt<null> {
  c.nextSibling(); //cond
  const ifCond = traverseExpr(c, s);
  const ifStmts :Stmt<null>[] = [];
  let hasIfStmt = false;
  let elifStmt : { cond: Expr<null>, stmts: Stmt<null>[] } | undefined = undefined;
  let elseStmt : Stmt<null>[] | undefined = undefined;
  c.nextSibling(); //body
  c.firstChild(); // :
  while (c.nextSibling()) {
    hasIfStmt = true;
    ifStmts.push(traverseStmt(c, s));
  }
  if (!hasIfStmt) {
    throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
  c.parent();
  if (c.nextSibling()) {
    if (c.type.name === "elif") {
      c.nextSibling(); // cond
      const elifCond = traverseExpr(c, s);
      const elifStmts :Stmt<null>[] = [];
      let hasElifStmt = false;
      c.nextSibling(); //body
      c.firstChild(); // :
      while (c.nextSibling()) {
        hasElifStmt = true;
        elifStmts.push(traverseStmt(c, s));
      }
      if (!hasElifStmt) {
        throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
      }
      elifStmt = {cond: elifCond, stmts: elifStmts};
      c.parent();
      c.nextSibling();
    }
    if (c.type.name === "else") {
      const elseStmts :Stmt<null>[] = [];
      let hasElseStmt = false;
      c.nextSibling(); //body
      c.firstChild(); // :
      while (c.nextSibling()) {
        hasElseStmt = true;
        elseStmts.push(traverseStmt(c, s));
      }
      if (!hasElseStmt) {
        throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
      }
      c.parent();
      elseStmt = elseStmts;
    }
  }

  return {"tag": "if", cond: ifCond, stmts: ifStmts, else: elseStmt, elif: elifStmt};
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt<null> {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "assign",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    case "PassStatement":
      return { tag: "pass" }
    case "ReturnStatement":
      let returnExpr :Expr<null>|undefined = undefined;
      c.firstChild(); // return
      c.nextSibling(); // return expr
      if (c.type.name !== "⚠") {
        returnExpr = traverseExpr(c, s);
      }
      c.parent();
      return { tag: "return", ret: returnExpr};
    case "WhileStatement":
      c.firstChild();
      const whileStmt = traverseWhileStmt(c, s);
      c.parent();
      return whileStmt;
    case "IfStatement":
      c.firstChild();
      const ifStmt = traverseIfStmt(c, s);
      c.parent();
      return ifStmt;
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseType(c: TreeCursor, s: string): Type {
  switch (s.substring(c.from, c.to)) {
    case "int":
      return Type.int;
    case "bool":
      return Type.bool;
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseLiteral(c: TreeCursor, s: string): Literal<null> {
  switch (s.substring(c.from, c.to)) {
    case "True":
      return {tag: "bool", value: true};
    case "False":
      return {tag: "bool", value: false};
    case "None":
      return {tag: "none"};
    default:
      const num = Number(s.substring(c.from, c.to));
      if (!isNaN(num)) return {tag: "num", value: num};
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseFunc(c: TreeCursor, s: string): FunDef<null> {
  c.nextSibling(); // def
  const name :string = s.substring(c.from, c.to);
  const paramList :TypedVar<null>[] = [];
  let ret :Type|undefined = undefined;

  c.nextSibling(); // paramList
  c.firstChild();
  while (c.type.name != ')') {
    c.nextSibling(); // skip ( or ,
    if (c.type.name === ')') break;
    paramList.push(traverseTypedVar(c, s));
    c.nextSibling();
  }
  c.parent();

  const bodyVarDefs: VarInit<null>[] = [];
  const bodyStmts: Stmt<null>[] = [];
  c.nextSibling(); // body or return
  if (c.node.type.name === "TypeDef") { // return
    c.firstChild();
    c.nextSibling();
    ret = traverseType(c, s);
    c.parent();
    c.nextSibling();
  }
  c.firstChild(); //:
  c.nextSibling();
  let stmtStarted = false;
  do {
    c.firstChild(); // vardef name
    c.nextSibling(); // typedef
    if (c.node.type.name === "TypeDef") {
      if (stmtStarted) {
        throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
      }
      c.parent();
      c.firstChild();
      bodyVarDefs.push(traverseVarDef(c, s));
      c.parent();
    } else {
      stmtStarted = true;
      c.parent();
      // c.firstChild();
      bodyStmts.push(traverseStmt(c, s));
    }
  } while (c.nextSibling() && c.node.type.name !== "⚠")
  if (!stmtStarted) { // atleast one statement
    throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
  c.parent(); // body

  return <FunDef<null>>{name, params: paramList, body: {stmts: bodyStmts, vardefs: bodyVarDefs}, ret};
}

export function traverseTypedVar(c: TreeCursor, s: string): TypedVar<null> {
  const name :string = s.substring(c.from, c.to);
  c.nextSibling(); // typedef
  c.firstChild(); // ":"
  c.nextSibling(); // vardef type
  const type = traverseType(c, s);
  c.parent();
  return <TypedVar<null>>{name, type};
}

export function traverseVarDef(c: TreeCursor, s: string): VarInit<null> {
  const typedVar = traverseTypedVar(c, s);
  c.nextSibling(); // assignment
  c.nextSibling(); // literal
  const literal = traverseLiteral(c, s);
  return <VarInit<null>>{type: typedVar, literal: literal};
}

export function traverseProgram(c: TreeCursor, s: string): Program<null> {
  const varinits :VarInit<null>[] = [];
  const fundefs :FunDef<null>[] = [];
  const stmts :Stmt<null>[] = [];
  let stmtStarted = false;
  do {
    switch (c.node.type.name) {
      case "AssignStatement":
        c.firstChild(); // vardef name
        c.nextSibling(); // typedef
        if (c.type.name === "TypeDef") {
          if (stmtStarted) {
            throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
          }
          c.parent();
          c.firstChild();
          varinits.push(traverseVarDef(c, s));
          c.parent();
        } else {
          stmtStarted = true;
          c.parent();
          stmts.push(traverseStmt(c, s));
        }
        break;
      case "FunctionDefinition":
        if (stmtStarted) {
          throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
        }
        c.firstChild(); // vardef name
        fundefs.push(traverseFunc(c, s));
        c.parent();
        break;
      default:
        stmtStarted = true;
        stmts.push(traverseStmt(c, s));
        break;
    }
  } while (c.nextSibling())

  return <Program<null>>{varinits: varinits, fundefs: fundefs, stmts: stmts};
}

export function traverse(c : TreeCursor, s : string) : Program<null> {
  switch(c.node.type.name) {
    case "Script":
      c.firstChild();
      const program = traverseProgram(c, s);
      c.parent();
      return program;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}

export function parse(source : string) : Program<null> {
  const t = parser.parse(source);
  console.log(stringifyTree(t.cursor(), source, 1));
  return traverse(t.cursor(), source);
}
