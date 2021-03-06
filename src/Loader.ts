import { URL } from './URL';
import { ModuleType } from './Module';
import { Package } from './Package';
import { Record, DepRef, ModuleFormat } from './Record';
import { isNode, origin } from './platform';
import { fetch, FetchResponse } from './fetch';
import { LoaderConfig, getDir, SystemDeclaration } from './LoaderBase';

const emptyPromise = Promise.resolve();

export type SystemFactory = (exports?: any, module?: ModuleType) => SystemDeclaration;

export interface BuiltSpec {
	name: string;
	root: string;
	main: string;
	map: { [key: string]: string };
	files: [ string, ModuleFormat, { [importKey: string]: number }, any ][];
}

function handleExtension(loader: Loader, key: string, ref?: DepRef) {
	let format: string | undefined;
	let pos = key.lastIndexOf('/') + 1;
	let ext: string | undefined;

	// Check for recognized file extensions starting from
	// the most specific, like .d.ts followed by .ts.
	while((pos = key.indexOf('.', pos) + 1) && !format) {
		ext = key.substr(pos).toLowerCase();
		format = loader.plugins[ext] && ext;
	}

	if(!ext && !loader.registry[key] && !loader.records[key]) {
		ext = (ref && ref.defaultExt) || 'js';
		key += '.' + ext;
		format = loader.plugins[ext] && ext;
	}

	if(ref) ref.format = format;

	return(key);
}

function fetchTranslate(loader: Loader, instantiate: true, importKey: string, parent?: string): Promise<any>;
function fetchTranslate(loader: Loader, instantiate: false, importKey: string, parent?: string): Promise<Record>;
function fetchTranslate(loader: Loader, instantiate: boolean, importKey: string, parent?: string) {
	if((instantiate && loader.registry[importKey]) || loader.records[importKey]) {
		// TODO: avoid unnecessary repeated resolution and / or translation.
	}

	if(!parent && isNode) {
		// If no parent module is known,
		// in Node.js we can still use the calling file's path.

		const hook = 'prepareStackTrace';
		const prepareStackTrace = Error[hook];
		Error[hook] = (err, stack) => stack;

		parent = URL.fromLocal(
			(new Error().stack as any as NodeJS.CallSite[])[2].getFileName() || ''
		);

		Error[hook] = prepareStackTrace;
	}

	const ref: DepRef = { isImport: true, package: loader.package };
	const result = loader.resolve(importKey, parent, ref).then((resolvedKey: string) =>
		(instantiate && loader.registry[resolvedKey] && loader.registry[resolvedKey].exports) ||
		// Detect and resolve all recursive dependencies.
		loader.discoverRecursive(resolvedKey, importKey, ref, instantiate).then(
			// Instantiate after translating all detected dependencies.
			(record: Record) => Promise.all(
				record.deepDepList.map((record: Record) => loader.translate(record))
			).then(
				() => instantiate ? loader.instantiate(record) : record
			)
		)
	);

	return(result);
}

export class Loader {

	constructor(public config?: LoaderConfig) {
		config = config || {};

		this.cwd = (
			(origin && getDir(window.location.pathname)) ||
			// TODO: Convert backslashes?
			(isNode && process.cwd()) ||
			'/'
		);

		this.baseURL = config.baseURL || (origin &&
			// TODO: Make sure a slash is added always when missing. Maybe cwd is a drive letter?
			origin + this.cwd + (this.cwd == '/' ? '' : '/')
		);

		const registry = config.registry || {};

		for(let name in registry) {
			if(registry.hasOwnProperty(name)) {
				this.registry[name] = { exports: registry[name], id: name };
			}
		}

		const plugins = config.plugins || {};

		for(let name in plugins) {
			if(plugins.hasOwnProperty(name)) {
				this.plugins[name] = plugins[name];
				plugins[name].constructor.call(this);
			}
		}
	}

	/** @param key Name of module or file to import, may be a relative path.
	  * @param parent Resolved URL of a possible parent module. */

	import(importKey: string, parent?: string) {
		return(fetchTranslate(this, true, importKey, parent));
	}

	getPackage(key: string) {
		let end = key.length;

		while((end = key.lastIndexOf('/', end - 1)) >= 0) {
			const pkg = this.packageRootTbl[key.substr(0, end)];

			if(pkg && pkg instanceof Package) return(pkg);
		}
	}

	resolveSync(key: string, callerKey?: string, ref: DepRef = {}) {
		const plugin = this.plugins.resolve;
		callerKey = callerKey || this.baseURL || '';

		ref.format = void 0;
		ref.pendingPackageName = void 0;
		ref.package = void 0;

		let resolvedKey: string = (
			plugin ? plugin.resolveSync.call(this, key, callerKey, ref) :
			URL.resolve(callerKey, key)
		);

		if(!ref.format) {
			resolvedKey = handleExtension(this, resolvedKey, ref);
		}

		return(resolvedKey);
	}

	resolve(key: string, callerKey?: string, ref?: DepRef): Promise<string> {
		const plugin = this.plugins.resolve;
		callerKey = callerKey || this.baseURL || '';

		return(
			plugin ? plugin.resolve.call(this, key, callerKey, ref) :
			Promise.resolve(this.resolveSync(key, callerKey, ref))
		);
	}

	fetch(url: string) {
		return(fetch(url));
	}

	fetchRecord(record: Record) {
		const fetched = this.fetch(record.resolvedKey).then(
			(res: FetchResponse) => res.text()
		).then((text: string) => {
			record.sourceCode = text;
		});

		return(fetched);
	}

	/** Resolve and translate an imported dependency and its recursive dependencies.
	  *
	  * @param importKey Dependency name (module or file), may be a relative path.
	  * @param record Import record of module referencing the dependency.
	  * @param base Dependency hierarchy root to instantiate and return from
	  * original import() call. */

	discoverImport(importKey: string, record: Record, instantiate: boolean, base: Record) {
		const ref: DepRef = { isImport: true };
		const discovered = this.resolve(
			importKey,
			record.resolvedKey,
			ref
		).then((resolvedDepKey: string): Promise<Record | undefined> | undefined => {
			let result: Promise<Record> | undefined;
			const depModule = /* instantiate && */ this.registry[resolvedDepKey];

			if(depModule) {
				// Bind already registered modules as-is.
				ref.module = depModule;
			} else {
				// Bind imported name and the import record,
				// to be registered (synchronously) when required.
				ref.record = base.deepDepTbl[resolvedDepKey];

				// Avoid blocking on previously seen dependencies,
				// to break circular dependency chains.
				if(!ref.record) {
					result = this.discoverRecursive(resolvedDepKey, importKey, ref, instantiate, base);
				}
			}

			record.resolveDep(importKey, ref);
			return(result);
		}).catch((err: NodeJS.ErrnoException) => {
			err.message += '\n    importing ' + importKey + ' from ' + record.resolvedKey;
			throw(err);
		});

		return(discovered);
	}

	/** Recursively fetch and translate a file and all its dependencies.
	  *
	  * @param resolvedKey Resolved URL address to fetch.
	  * @param importKey Dependency name before resolving.
	  * @param base Dependency hierarchy root to instantiate and return from
	  * original import() call. */

	discoverRecursive(
		resolvedKey: string,
		importKey: string,
		ref: DepRef,
		instantiate: boolean,
		base?: Record
	): Promise<Record> {
		// This corresponds to code after loader.resolve in SystemJS resolveInstantiate
		// (short path for fully resolved names is in import in our case).
		let record = this.records[resolvedKey] || (
			this.records[resolvedKey] = new Record(this, resolvedKey, importKey, ref.package)
		);

		base = base || record;

		// Store import record in table and wait for it to be translated
		base.deepDepTbl[resolvedKey] = record;
		// Add new recursive dependency to list.
		base.deepDepList.push(record);

		if(!record.discovered) {
			let fetched = emptyPromise;

			record.format = ref.format as any;

			if(ref.sourceCode) {
				record.sourceCode = ref.sourceCode;
			} else {
				fetched = (
					this.plugins[record.format!].fetchRecord || this.fetchRecord
				).call(this, record);
			}

			record.discovered = fetched.then(
				() => this.discover(record)
			).catch((err: NodeJS.ErrnoException) => {
				err.message += '\n    translating ' + record.resolvedKey;
				throw(err);
			});
		}

		// Store import record in table and wait for it to be translated.
		ref.record = record;

		return(record.discovered.then(
			// Loop through all imported dependencies.
			() => Promise.all(record.depList.map(
				// Resolve and translate each dependency.
				(key: string) => this.discoverImport(key, record, instantiate, base!)
			)).then(() => base!)
		));
	}

	discover(record: Record): Promise<void> | void {
		const format = record.format;
		const plugin = this.plugins[format!];

		record.globalTbl = {
			'process': {
				'cwd': () => this.cwd,
				'env': { 'NODE_ENV': 'production' }
			}
		};

		if(plugin && plugin.discover) {
			return(
				Promise.resolve(
					plugin.discover.call(this, record)
				).then(() => {
					if(record.format != format) return(this.discover(record));
				})
			);
		}
	}

	translate(record: Record): Promise<void> | void {
		const format = record.format;
		const plugin = this.plugins[format!];

		if(plugin && plugin.translate) {
			return(
				Promise.resolve(
					plugin.translate.call(this, record)
				).then(() => {
					if(record.format != format) return(
						Promise.resolve(this.discover(record)).then(() => this.translate(record))
					);
				})
			);
		} else if(!record.moduleInternal) {
			record.moduleInternal = {
				exports: {},
				id: record.resolvedKey
			};
		}
	}

	instantiate(record: Record) {
		if(record.isInstantiated) {
			return(record.moduleInternal.exports);
		}

		record.isInstantiated = true;

		if(record.loadError) {
			throw(record.loadError);
		}

		try {
			const exportsOld = record.moduleInternal.exports;
			const exportsNew = this.plugins[record.format!].instantiate.call(this, record);
			this.registry[record.resolvedKey] = record.moduleInternal;

			if(exportsNew != exportsOld) {
				// TODO: for circular deps, the previous exports may be in use!
				// Should define getters and setters to share members
				// or at least copy them over...
			}

			return(exportsNew);
		} catch(err) {
			err.message += '\n    instantiating ' + record.resolvedKey;
			throw(err);
		}
	}

	register(deps: string[], factory: SystemFactory) {
		let record = this.latestRecord;

		if(record) {
			for(let dep of deps) {
				record.depNumList.push(record.addDep(dep) + 3);
			}

			record.factory = factory;
		}
	}

	wrap(record: Record) {}

	build(importKey: string, parent?: string) {
		return(fetchTranslate(this, false, importKey, parent).then((record: Record) => {
			const pkgTbl: { [name: string]: { package: Package, records: Record[] } } = {};
			const pkgList: string[] = [];

			for(let dep of record.deepDepList) {
				const pkg = dep.pkg || this.package;
				let spec = pkgTbl[pkg.name];

				if(!spec) {
					spec = { package: pkg, records: [] };
					pkgTbl[pkg.name] = spec;
					pkgList.push(pkg.name);
				}

				spec.records.push(dep);
			}

			pkgList.sort();
			let num = 0;

			for(let name of pkgList) {
				for(let dep of pkgTbl[name].records.sort((a: Record, b: Record) =>
					+(a.resolvedKey < b.resolvedKey) - +(a.resolvedKey > b.resolvedKey)
				)) {
					dep.num = num++;
				}
			}

			const str = JSON.stringify;

			return('System.built(1,[{\n\t' + pkgList.map((name: string) => {
				const spec = pkgTbl[name];
				const pkg = spec.package;
				return([
					'name: ' + str(pkg.name),
					'root: ' + str(pkg.root),
					'main: ' + str(pkg.main),
					'map: ' + str(pkg.map),
					'files: [\n\t\t[\n' + spec.records.map((record: Record) => {
						const plugin = this.plugins[record.format!];
						let code = 'null';

						if(plugin && plugin.wrap) {
							code = plugin.wrap.call(this, record);
						}

						const deps: string[] = [];

						for(let depName of record.depList.slice(0).sort()) {
							const dep = record.depTbl[depName].record;
							if(dep) deps.push(str(depName) + ': ' + dep.num);
						}

						return('\t\t\t/* ' + pkg.name + ': ' + record.num! + ' */\n\t\t\t' + [
							str(URL.relative(pkg.root + '/', record.resolvedKey)),
							str(record.format),
							'{' + deps.join(', ') + '}',
							code
						].join(', '));
					}).join('\n\t\t], [\n') + '\n\t\t]\n\t]'
				].join(',\n\t'));
			}).join('\n}, {\n\t') + '\n}]);');
		}));
	}

	built(version: number, specList: BuiltSpec[]) {
		const recordList: Record[] = [];
		const depsList: { [importKey: string]: number }[] = [];
		let num = 0;

		for(let pkgSpec of specList) {
			const pkg = new Package(pkgSpec.name, pkgSpec.root);
			pkg.main = pkgSpec.main;
			pkg.map = pkgSpec.map;

			this.packageNameTbl[pkg.name] = pkg;
			this.packageConfTbl[pkg.root] = pkg;
			this.packageRootTbl[pkg.root] = pkg;

			for(let [ key, format, deps, compiled ] of pkgSpec.files) {
				const resolvedKey = URL.resolve(pkg.root + '/', key);
				const record = new Record(this, resolvedKey);

				record.format = format;
				record.compiled = compiled;
				record.discovered = emptyPromise;

				this.records[resolvedKey] = record;
				recordList[num] = record;
				depsList[num++] = deps;
			}
		}

		num = 0;

		for(let record of recordList) {
			const deps = depsList[num++];

			for(let key in deps) {
				if(deps.hasOwnProperty(key)) {
					record.addDep(key);
					record.resolveDep(key, { record: recordList[deps[key]] });
				}
			}

			this.translate(record);
		}
	}

	package = new Package('_', '');
	packageNameTbl: { [name: string]: Package | false | Promise<Package | false> } = {};
	packageConfTbl: { [resolvedRoot: string]: Package | false | Promise<Package | false> } = {};
	/** Map resolved keys to containing packages (keys not corresponding to a package root
	  * resolve to the same result as their parent directory does). */
	packageRootTbl: { [resolvedRoot: string]: Package | false | Promise<Package | false> } = {};
	repoTbl: { [resolvedPath: string]: true } = {}

	registry: { [resolvedKey: string]: ModuleType } = {};

	/** Pending imports. */
	records: { [resolvedKey: string]: Record } = {};
	latestRecord?: Record;

	cwd: string;
	baseURL?: string;

	plugins: { [name: string]: Loader } = {};

}
