export type Program<A> = { a?: A, varDefs: VarDef<A>[], funDefs: FunDef<A>[], classDefs: ClassDef<A>[], stmts: Stmt<A>[] }

export type VarDef<A> = { a?: A, type: TypedVar<A>, literal: Literal<A> }

export type FunDef<A> = { a?: A, name: string, params: TypedVar<A>[], ret?: Type, body: { varDefs: VarDef<A>[], stmts: Stmt<A>[] } }

export type TypedVar<A> = { a?: A, name: string, type: Type }

export type ClassDef<A> = { a?: A, name: string, fields: VarDef<A>[], methods: FunDef<A>[] }

export type Stmt<A> =
  | { a?: A, tag: "assign", name: string, value: Expr<A> }
  | { a?: A, tag: "assignfield", obj: Expr<A>, name: string, value: Expr<A> }
  | { a?: A, tag: "return", ret?: Expr<A> }
  | { a?: A, tag: "pass" }
  | { a?: A, tag: "expr", expr: Expr<A> }
  | { a?: A, tag: "if", cond: Expr<A>, stmts: Stmt<A>[], elif?: { cond: Expr<A>, stmts: Stmt<A>[] }, else?: Stmt<A>[] }
  | { a?: A, tag: "while", cond: Expr<A>, stmts: Stmt<A>[] }

export type Expr<A> =
  | { a?: A, tag: "id", name: string }
  | { a?: A, tag: "builtin1", name: string, arg: Expr<A> }
  | { a?: A, tag: "builtin2", name: string, arg1: Expr<A>, arg2: Expr<A> }
  | { a?: A, tag: "binexpr", op: Binop, left: Expr<A>, right: Expr<A> }
  | { a?: A, tag: "uniexpr", op: Uniop, expr: Expr<A> }
  | { a?: A, tag: "brackets", expr: Expr<A> }
  | { a?: A, tag: "call", name: string, args: Expr<A>[] }
  | { a?: A, tag: "literal", literal: Literal<A> }
  | { a?: A, tag: "construct", name: string }
  | { a?: A, tag: "getfield", obj: Expr<A>, name: string}
  | { a?: A, tag: "callmethod", obj: Expr<A>, name: string, args: Expr<A>[] }

export enum Uniop {
  Not = "not",
  Minus = "-"
}

export enum Binop {
  Plus = "+",
  Minus = "-",
  Star = "*",
  DoubleDash = "//",
  Percentile = "%",
  DoubleEquals = "==",
  NotEqual = "!=",
  LessOrEqual = "<=",
  GreaterOrEqual = ">=",
  LessThan = "<",
  GreaterThan = ">",
  Is = "is",
}

export type Type =
  | { tag: "number" }
  | { tag: "bool" }
  | { tag: "none" }
  | { tag: "class", name: string }

export const NUM: Type = { tag: "number" }
export const BOOL: Type = { tag: "bool" }
export const NONE: Type = { tag: "none" }
export function CLASS(name: string): Type {
  return { tag: "class", name }
}

export type Literal<A> =
  | { a?: A, tag: "num", value: number }
  | { a?: A, tag: "bool", value: boolean }
  | { a?: A, tag: "none" }