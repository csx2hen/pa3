// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import * as compiler from './compiler';
import {parse} from './parser';

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if(typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args : any) : any => {
    if(args[0] === "uncaughtException") { return; }
    else { return oldProcessOn.apply(process, args); }
  };
}

export async function run(source : string, config: any) : Promise<number> {
  const wabtInterface = await wabt();
  const compiled = compiler.compile(source);
  const importObject = config.importObject;
  const myModule = wabtInterface.parseWat("test.wat", compiled.wasmSource);
  var asBinary = myModule.toBinary({});
  const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, { imports: importObject.imports, mem: { memory: memory } });
  return (wasmModule.instance.exports as any)._start();
}
