import { globalEnv } from './platform';
import { Loader } from './Loader';

import { JS } from './plugin/JS';
import { AMD } from './plugin/AMD';
import { CJS } from './plugin/CJS';
import { Register } from './plugin/Register';
import { TS } from './plugin/TS';
import { CSS } from './plugin/CSS';
import { Text } from './plugin/Text';
import { Json } from './plugin/Json';
import { NodeBuiltin } from './plugin/NodeBuiltin';
import { NodeResolve } from './plugin/NodeResolve';

import { URL } from './URL';
import { fetch, FetchResponse } from './fetch';

export { URL, fetch, FetchResponse, Loader };

const internals = {
	URL, fetch, FetchResponse, Loader
};

/** This module, importable from code running inside. */
const systema = internals as typeof internals & { System: Loader };

export const System = new Loader({ 
	plugins: {
		resolve: NodeResolve.prototype,

		js: JS.prototype,
		amd: AMD.prototype,
		cjs: CJS.prototype,
		system: Register.prototype,
		esm: TS.prototype,
		ts: TS.prototype,
		'd.ts': TS.prototype,
		css: CSS.prototype,
		txt: Text.prototype,
		json: Json.prototype,
		node: NodeBuiltin.prototype        
	},
	registry: {
		'@empty': {},
		systema
	}
});

systema.System = System;

if(!globalEnv.System) globalEnv.System = System;
