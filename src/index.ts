import { globalEnv } from './platform';
import { Loader } from './Loader';
import { LoaderConfig } from './LoaderBase';

import { URL } from './URL';
import { fetch, FetchResponse } from './fetch';

export { LoaderConfig };
export { URL, fetch, FetchResponse, Loader };

/** This module, importable from code running inside. */
const globalSystem = globalEnv.System;

// TODO: Merge with default config and pass to Loader.constructor.
// const config: LoaderConfig = (globalSystem && globalSystem.systemaConfig) || {};

export { Loader as System };
if (!globalSystem) globalEnv.System = Loader;
