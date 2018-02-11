(function () {
  function transpile(input) {
    // modified transpileModule function to show type errors
    const transpileOptions = {};
    const options = transpileOptions.compilerOptions ? fixupCompilerOptions(transpileOptions.compilerOptions, []) : ts.getDefaultCompilerOptions();

    // transpileModule does not write anything to disk so there is no need to verify that there are no conflicts between input and output paths.
    options.suppressOutputPathCheck = true;

    // Filename can be non-ts file.
    options.allowNonTsExtensions = true;

    // We are not returning a sourceFile for lib file when asked by the program,
    // so pass --noLib to avoid reporting a file not found error.
    options.noLib = true;

    // Clear out other settings that would not be used in transpiling this module
    options.lib = undefined;
    options.types = true;
    options.noEmit = undefined;
    options.noEmitOnError = undefined;
    options.paths = undefined;
    options.rootDirs = undefined;
    options.declaration = undefined;
    options.declarationDir = undefined;
    options.out = undefined;
    options.outFile = undefined;

    // We are not doing a full typecheck, we are not resolving the whole context,
    // so pass --noResolve to avoid reporting missing file errors.
    options.noResolve = true;

    // if jsx is specified then treat file as .tsx
    const inputFileName = transpileOptions.fileName || (options.jsx ? "module.tsx" : "module.ts");
    const sourceFile = ts.createSourceFile(inputFileName, input, options.target);
    if (transpileOptions.moduleName) {
      sourceFile.moduleName = transpileOptions.moduleName;
    }

    if (transpileOptions.renamedDependencies) {
      sourceFile.renamedDependencies = createMapFromTemplate(transpileOptions.renamedDependencies);
    }

    const newLine = ts.getNewLineCharacter(options);

    // Output
    let outputText;

    // Create a compilerHost object to allow the compiler to read and write files
    const compilerHost = {
      getSourceFile: (fileName) => fileName === ts.normalizePath(inputFileName) ? sourceFile : undefined,
      writeFile: (name, text) => {
        if (!ts.fileExtensionIs(name, ".map")) {
          ts.Debug.assertEqual(outputText, undefined, "Unexpected multiple outputs, file:", name);
          outputText = text;
        }
      },
      getDefaultLibFileName: () => "lib.d.ts",
      useCaseSensitiveFileNames: () => false,
      getCanonicalFileName: fileName => fileName,
      getCurrentDirectory: () => "",
      getNewLine: () => newLine,
      fileExists: (fileName) => fileName === inputFileName,
      readFile: () => "",
      directoryExists: () => true,
      getDirectories: () => []
    };

    const program = ts.createProgram([inputFileName], options, compilerHost);

    // Emit
    const emitResult = program.emit(/*targetSourceFile*/ undefined, /*writeFile*/ undefined, /*cancellationToken*/ undefined, /*emitOnlyDtsFiles*/ undefined, transpileOptions.transformers);

    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    let errors = allDiagnostics.filter(d => d.file).map(d => ({
      message: d.messageText
    }));


    ts.Debug.assert(outputText !== undefined, "Output generation failed");

    return { outputText, errors };
  }


    //Keep track of the number of scripts to be pulled, and fire the compiler
    //after the number of loaded reaches the total
    var scripts = {
        total: 0, //total number of scripts to be loaded
        loaded: 0, //current number of loaded scripts
        data: [], //file data
        name: [] //file name
    };

    //Function loads each script and pushes its content into scripts.data
    var load = function (url) {
        var xhr = window.ActiveXObject ? new window.ActiveXObject('Microsoft.XMLHTTP') : new window.XMLHttpRequest();;
        xhr.open('GET', url, true);
        if ('overrideMimeType' in xhr) xhr.overrideMimeType('text/plain');
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 0 || xhr.status === 200) {
                scripts.loaded++;
                scripts.data.push(xhr.responseText);
                scripts.name.push(url);
                if (scripts.loaded === scripts.total) compile();
                return xhr.responseText;
            } else {
                console.log('Could not load ' + url);
            } //end if
        }; //end xhr.onreadystatechange()
        return xhr.send(null);
    };

    //Compiles each of the scripts found within scripts.data
    var compile = function () {
        if (scripts.data.length == 0 || scripts.data.length != scripts.name.length) return; //no reason to compile when there are no scripts
        var elem, source = '',
            body = document.getElementsByTagName('body')[0];
        scripts.total = 0; //clear the 'queue' incase the xhr response was super quick and happened before the initializer finished
        var hashCode = function (s) {
            var hsh = 0,
                chr, i;
            if (s.length == 0) {
                return hsh;
            }
            for (i = 0; i < s.length; i++) {
                chr = s.charCodeAt(i);
                hsh = (hsh << 5) - hsh + chr;
                hsh = hsh & hsh; //Convert to 32bit integer
            }
            return hsh;
        };
        if (window.sessionStorage && sessionStorage.getItem('typescript' + hashCode(scripts.data.join('')))) {
            source = sessionStorage.getItem('typescript' + hashCode(scripts.data.join('')));
        } else {
            (function () {
                var filename;
                for (num = 0; num < scripts.data.length; num++) {
                    filename = scripts.name[num] = scripts.name[num].slice(scripts.name[num].lastIndexOf('/') + 1);
                    var src = scripts.data[num];
                    var compiled = transpile(src);
                    source += compiled.outputText;
                    compiled.errors.forEach(e => console.error(e.message));
                }
            })();
        }
        elem = document.createElement('script');
        elem.type = 'text/javascript';
        elem.innerHTML = '//Compiled TypeScript\n\n' + source;
        body.appendChild(elem);
    };

    (function () {
        //Polyfill for older browsers
        if (!window.console) window.console = {
            log: function () {}
        };
        var script = document.getElementsByTagName('script');
        var i, src = [];
        for (i = 0; i < script.length; i++) {
            if (script[i].type == 'text/typescript') {
                if (script[i].src) {
                    scripts.total++
                    load(script[i].src);
                } else {
                    scripts.data.push(script[i].innerHTML);
                    scripts.name.push('innerHTML'+scripts.total);
                    scripts.total++;
                    scripts.loaded++;
                }
            }
        }
        if (scripts.loaded === scripts.total) compile(); //only fires if all scripts are innerHTML, else this is fired on XHR response
    })();
})();
