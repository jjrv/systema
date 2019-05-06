# systema

[![npm version](https://img.shields.io/npm/v/systema.svg)](https://www.npmjs.com/package/systema)
[![dependency status](https://david-dm.org/jjrv/systema.svg)](https://david-dm.org/jjrv/systema)
[![install size](https://img.shields.io/bundlephobia/min/systema.svg)](https://bundlephobia.com/result?p=systema)
[![license](https://img.shields.io/npm/l/systema.svg)](https://raw.githubusercontent.com/jjrv/systema/master/LICENSE)

`systema` is a zero-configuration module loader for browsers and Node.js.
It allows modern JavaScript and TypeScript development without requiring other tooling, even Node.js.

**SYSTEMA IS NOT READY. NOT EVERYTHING BELOW IS TRUE.**

You can write in ES6 or TypeScript, import any npm packages and run the code in browsers without installing anything.
Code can be transpiled, minified and bundled for publication directly in the browser.

`systema` supports importing CommonJS, AMD, ES6, TypeScript, JSON, plain text and CSS.

On top of everything `systema` is small, about 24kb minified. It has no dependencies.
TypeScript and PostCSS compilers are downloaded from a CDN during development if needed.

## Usage

In browsers:

```HTML
<script src="https://cdn.jsdelivr.net/npm/systema"></script>
<script>

System.import('./App.ts');

</script>
```

In Node.js:

```JavaScript
require('systema');

System.import('./App.ts');
```

From `package.json` section `scripts`:

`systema ./App.ts`

If installed globally using `npm`, `systema` can effectively replace `npx`.

# License

[The MIT License](https://raw.githubusercontent.com/charto/systema/master/LICENSE)

Please don't distribute until ready, unless the author disappears.

Copyright (c) 2018- BusFaster Ltd
