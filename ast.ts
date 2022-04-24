export type Program<A> = {a?: A, varinits: VarInit<A>[], fundefs: FunDef<A>[], stmts: Stmt<A>[] }

export type VarInit<A> = {a?: A, type: TypedVar<A>, literal: Literal<A> };

export type FunDef<A> = { a?: A, name: string, params: TypedVar<A>[], ret?: Type, body: { vardefs: VarInit<A>[], stmts: Stmt<A>[] } }

export type TypedVar<A> = { a?: A, name: string, type: Type}

export type Stmt<A> =
  | { a?: A, tag: "assign", name: string, value: Expr<A> }
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

export enum Type { int = "int", bool = "bool" }

export type Literal<A> = 
  { a?: A, tag: "num", value: number}
  | { a?: A,tag: "bool", value: boolean}
  | { a?: A,tag: "none"}