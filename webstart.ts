import {run} from './runner';


function webStart() {
  document.addEventListener("DOMContentLoaded", function() {
    function display(arg : string) {
      const elt = document.createElement("pre");
      document.getElementById("printlog").appendChild(elt);
      elt.innerText = arg;
    }
    var importObject = {
      imports: {
        print: (arg : any) => {
          display(String(arg));
          return arg;
        },
        abs: Math.abs,
        max: Math.max,
        min: Math.min,
        pow: Math.pow,
        print_num: (arg : any) => {
          display(String(arg));
          return arg;
        },
        print_bool: (arg : any) => {
          if(arg === 0) { display("False"); }
          else { display("True"); }
          return arg;
        },
        print_none: (arg: any) => {
          display("None");
          return arg;
        },
        runtime_check: (arg: any) => {
          if (arg === 0) {
            throw new Error("RUNTIME ERROR: the obj is null")
          }
          return arg;
        }
      },
    };

    function renderResult(result : any) : void {
      if(result === undefined) { console.log("skip"); return; }
      // const elt = document.createElement("pre");
      const elt = document.getElementById("lastexpr");
      elt.innerText = String(result);
    }

    function renderError(result : any) : void {
      const elt = document.getElementById("errors");
      // document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      let errorString = String(result);
      if (errorString.includes("undefined local variable")) {
        errorString = "ReferenceError " + errorString;
      }
      elt.innerText = errorString;
    }

    document.getElementById("run").addEventListener("click", function(e) {
      const source = document.getElementById("user-code") as HTMLTextAreaElement;
      document.getElementById("errors").innerHTML = "";
      document.getElementById("lastexpr").innerHTML = "";
      document.getElementById("printlog").innerHTML = "";
      run(source.value, {importObject}).then((r) => { renderResult(r); console.log ("run finished") })
          .catch((e) => { renderError(e); console.log("run failed", e) });;
    });
  });
}

webStart();
