# Node.js PromiseEx

Provides extended promise functionality and utilities.

## Installation

```
npm install https://github.com/flipeador/node.js-promise-ex
```

## Examples

<details>
<summary><h5>Promise object with extended functionality</h5></summary>

`PromiseEx` allows to set a **timeout** and add **events** for when the promise resolves, rejects or expires.

```js
const { PromiseEx } = require('@flipeador/node.js-promise-ex');

function onEvent(value)
{
    switch (this.state)
    {
        case 'fulfilled':
            console.log('The promise has been resolved with:', value);
            break;
        case 'rejected':
            console.log('The promise has been rejected with:', value.message);
            break;
        default: // timeout
            // By default, when a promise expires, it is rejected with PromiseTimeout error.
            // This behavior can be changed by calling this#resolve or this#reject before returning.
            //this.resolve('I don\'t want an error!');
            console.log(`The promise has expired after ${value} ms`);
            break;
    }
}

(async () => {
    const promise = new PromiseEx((resolve, reject) => {
        // never explicitly resolves nor rejects
    }, { timeout: 1000, onEvent });

    try {
        await promise; // throws after 1000 ms
    } catch (error) {
        console.log(error); // PromiseTimeout [Error]
    }

    console.log('Promise state:', promise.state); // 'rejected'
})();
```

```
The promise has expired after 1000 ms
The promise has been rejected with: Promise timed out after 1000 ms
PromiseTimeout [Error]: Promise timed out after 1000 ms
    ...
Promise state: rejected
```

</details>

<details>
<summary><h5>Omit callback function and set arguments</h5></summary>

When `PromiseEx` is instantiated, properties `resolve` and `reject` are set. This allows the callback function to be omitted.

In addition, a list of arguments can be specified in the options.

```js
const { PromiseEx } = require('@flipeador/node.js-promise-ex');

(async () => {
    const promise = new PromiseEx({
        onResolve(value, hello, world) {
            this.result = `${hello} ${world}${value}`; // (1)
        },
        args: ['Hello', 'World']
    });
    promise.resolve('!'); // (2)
    console.log('Resolve:', await promise); // (2)
    console.log('Result:', promise.result); // (1)
})();
```

```js
Resolve: !
Result: Hello World!
```

</details>

<details>
<summary><h5>Subtle difference between Promise and PromiseEx</h5></summary>

`PromiseEx` supports async callback functions, this means that any unhandled error is catched and rejected instead of triggering an [unhandled promise rejection](https://nodejs.org/api/process.html#event-unhandledrejection).

```js
const process = require('node:process');
const { PromiseEx } = require('@flipeador/node.js-promise-ex');

/**
 * Emitted whenever a Promise is rejected and no error handler is attached to the promise.
 */
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled promise rejection:', promise);
});

(async () => {
    try {
        await new PromiseEx(async () => {
            throw new Error('My Error!'); // --> (1)
        });
    } catch (error) { // <-- (1)
        console.log('Rejected:', error);
    }

    console.log('-'.repeat(50));

    try {
        await new Promise(async () => {
            throw new Error('My Error!'); // unhandled promise rejection
        });
    } catch (error) {
        console.log('Rejected:', error);
    }
})();
```

```
Rejected: Error: My Error!
    ...
--------------------------------------------------
Unhandled promise rejection: Promise {
  <rejected> Error: My Error!
      ...
}
```

</details>

<details>
<summary><h5>Control the concurrency of an async function</h5></summary>

```js
const { PromiseEx, PromiseSync } = require('@flipeador/node.js-promise-ex');

const psync = new PromiseSync();

async function asyncFn(index)
{
    console.log(await new Promise(async (resolve) => {
        await PromiseEx.sleep(index & 1 ? 100 : 50);
        resolve(`asyncFn: Index #${index}`);
    }));
}

async function asyncSyncFn(index)
{
    console.log(await psync.run(async (resolve) => {
        await PromiseEx.sleep(index & 1 ? 100 : 50);
        resolve(`asyncSyncFn: Index #${index}`);
    }));
}

(async () => {
    for (let i = 1; i <= 5; ++i)
        asyncFn(i);

    await PromiseEx.sleep(1000); console.log('-'.repeat(50));

    for (let i = 1; i <= 5; ++i)
        asyncSyncFn(i);

    await PromiseEx.sleep(1000); console.log('-'.repeat(50));

    const asyncSyncFn2 = PromiseSync.wrap(asyncFn);
    for (let i = 1; i <= 5; ++i)
        asyncSyncFn2(`${i} (PromiseSync.wrap)`);
})();
```

```
asyncFn: Index #2
asyncFn: Index #4
asyncFn: Index #1
asyncFn: Index #3
asyncFn: Index #5
--------------------------------------------------
asyncSyncFn: Index #1
asyncSyncFn: Index #2
asyncSyncFn: Index #3
asyncSyncFn: Index #4
asyncSyncFn: Index #5
--------------------------------------------------
asyncFn: Index #1 (PromiseSync.wrap)
asyncFn: Index #2 (PromiseSync.wrap)
asyncFn: Index #3 (PromiseSync.wrap)
asyncFn: Index #4 (PromiseSync.wrap)
asyncFn: Index #5 (PromiseSync.wrap)
```

</details>

## License

This project is licensed under the **GNU General Public License v3.0**. See the [license file](LICENSE) for details.
