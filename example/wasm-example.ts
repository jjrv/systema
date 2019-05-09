import * as lib from './test.asm.ts';

lib({
    input: {
        sayHello() {
            console.log('Hello from WASM');
        }
    }
}).then(a => {
    console.log(`Maths done in WASM:`, a.add(1, 3));
});

