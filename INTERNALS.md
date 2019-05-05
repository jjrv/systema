# systema internals

## The import process

The loader is based on plugins for different "file formats" which can also
change the input file or its format information. Format changes send the input
to another plugin. The initial format is determined by the file extension.

For example the generic JavaScript (JS) plugin detects the type of module
loader the code expects and sets its format to CommonJS, TypeScript etc.
accordingly. Another plugin specific to that format then continues the import
process.

The TypeScript plugin transpiles code to JavaScript, which gets sent back to
the generic JS plugin to detect which plugin is appropriate for the transpiled
result. The TypeScript compiler can be configured to produce AMD, CommonJS or
`System.register` modules, all of which are supported.

Importing a new file works in stages:

1. `resolve` converts relative URLs to absolute and simulates the Node.js module
   resolution algorithm. It also finds, parses and caches `package.json` files.
2. `fetch` retrieves the file over HTTP(S), from the local file system or its
   internal cache which it also manages.
3. `discover` parses the file to detect its format and list its dependencies.
    - If format information changes, discover runs again using another plugin.
    - All dependencies are resolved, fetched and their dependencies discovered
      recursively, before continuing to the next stage.
4. `transpile` changes the file to make it more suitable for passing through
   `eval()`. It can change the format information, which sends the file back
   to the discovery stage using a different plugin. Often several plugins will
   need to transpile the same file.
5. `instantiate` calls or parses the file to produce an object with its exported
   variables. All imported dependencies are instantiated recursively first, to
   get any imported variables from their exports.

Discover and transpile are separate stages, because the TypeScript transpiler
runs synchronously and expects all dependencies to be available. They need to
be discovered and asynchronously fetched first.

The exact roles of different stages are not set in stone. For example the
generic JS plugin also removes hashbang headers and eliminates dead code
conditioned on `process.env.NODE_ENV` already during discovery instead of
transpiling, for two reasons:

- JavaScript parsing is expensive and necessary for both format detection in
  discovery, and dead code removal. We can do both at once.
- Changing format information sends the file to another plugin, which may not
  like the parts that were supposed to be removed.

Similarly the AMD and `System.register` plugins run `eval()` already during
discovery. A single file may define multiple such modules and their
dependencies, which would otherwise need more complicated parsing to discover.
It should have no side effects other than defining modules and no synchronous
imports, making it safe to run at any point.

## Bundling

During bundling, code is transformed in exactly the same way as during import.
Transpile functions in plugins wrap code in a function for passing to `eval()`
and the same function source code gets emitted into bundles, together with
metadata about their URL, format and dependencies.
