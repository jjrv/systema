import { System } from '../src';
import { AssemblyScript } from './AssemblyScript-node';

const loader = new System({
    plugins: {
        'asm.ts': { instantiate: AssemblyScript.prototype.instantiate },
    }
});

loader.import('./node-target.ts');
