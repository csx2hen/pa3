import { compile } from './compiler';
import { parse } from './parser';
import { typeCheckProgram } from './typecheck';

const py_1 = `
class Rat(object):
  n : int = 456
  d : int = 789
  def new(self : Rat, n : int, d : int) -> Rat:
    self.n = n
    self.d = d
    return self
  def mul(self : Rat, other : Rat) -> Rat:
    return Rat().new(self.n * other.n, self.d * other.d)

r1 : Rat = None
r2 : Rat = None
r1 = Rat().new(4,5)
r2 = Rat()
r2.n = 3
r2.d = 2
print(r1.mul(r2).mul(r2).n)
`

const py_2 = `
class C(object):
    x : int = 0

print(not (C() is None))`

// const parsed = parse(py_1);
// const typed = typeCheckProgram(parsed);
const compiled = compile(py_2)
// console.log(JSON.stringify(typed, null, 2))
// console.log(typed.a)