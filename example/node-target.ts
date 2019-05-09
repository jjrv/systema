import * as lib from './test.asm.ts';
import * as fibonacci from 'fibonacci';

lib({
    input: {
        sayHello() {
            console.log('Hello from WASM');
        }
    }
}).then(a => {
    console.log(`Maths done in WASM:`, a.add(1, 3));
});

console.log(fibonacci.iterate(3000));
