import * as asc from '../node_modules/assemblyscript/dist/asc.js';

export class AssemblyScript extends System {

	instantiate(record) {
		if (record.compiled) {
			return record.compiled;
		}

		const { binary, text, stdout, stderr } = asc.compileString(record.sourceCode);

		return async function (opts = {}) {
			const { instance } = await WebAssembly.instantiate(binary, opts);
			return instance.exports;
		}
	}

}
