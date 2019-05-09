import * as asc from 'assemblyscript/cli/asc';
import { System } from '../src';
import { Record } from '../src/Record';

export class AssemblyScript extends System {

	instantiate(record: Record) {
		if (record.compiled) {
			return record.compiled;
		}

		const { binary, text, stdout, stderr } = asc.compileString(record.sourceCode);

		return async function (opts = {}) {
			const { instance } = await (global as any).WebAssembly.instantiate(binary, opts);
			return instance.exports;
		}
	}

}
