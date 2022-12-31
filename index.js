'use strict';

const util = require('node:util');
const { setTimeout } = require('node:timers');

function call(fn)
{
    try { fn(); }
    catch (error) { console.error(error); }
}

class PromiseError extends Error
{
    constructor(message, ...args)
    {
        super(util.format(message, ...args.map(x => util.inspect(x))));
    }
}

class PromiseTimeout extends PromiseError
{
    constructor(timeout)
    {
        super('Promise timed out after %s ms', timeout);
    }
}

/**
 * Promise object with extended functionality.
 * The Promise object represents the eventual completion (or failure) of an asynchronous operation and its resulting value.
 */
class PromiseEx extends Promise
{
    /** @type {'pending'|'fulfilled'|'rejected'} */
    state = 'pending';

    /**
     * Create a PromiseEx object.
     * @param {Function} callback `Function(resolveFn, rejectFn)`.
     * @param {Object} options Options.
     * @param {Number} options.timeout Rejects with {@link PromiseTimeout} once the timeout expires.
     * @param {Function} options.onEvent Function called when the promise resolves, rejects or expires.
     * @param {Function} options.onSettled Function called when the promise is fulfilled or rejected.
     * @param {Function} options.onResolve Function called when the promise is fulfilled.
     * @param {Function} options.onReject Function called when the promise is rejected.
     * @param {Function} options.onTimeout Function called when the promise has expired.
     * @param {Array} options.args List of arguments that receive the events.
     */
    constructor(callback, options)
    {
        if (typeof(callback) !== 'function' && options === undefined) {
            options = callback;
            callback = undefined;
        }

        const obj = {};
        super((resolve, reject) => Object.assign(obj, {resolve, reject}));

        if (options?.timeout)
            this._timer = setTimeout(() => {
                this.#emit('onTimeout', options.timeout, options);
                this.reject(new PromiseTimeout(options.timeout));
            }, options.timeout);

        this.resolve = (value) => {
            if (this.state === 'pending')
            {
                obj.resolve(value);
                this.#settled('fulfilled', 'onResolve', value, options);
            }
        };

        this.reject = (error) => {
            if (this.state === 'pending')
            {
                obj.reject(error);
                this.#settled('rejected', 'onReject', error, options);
            }
        };

        if (callback !== undefined)
        {
            (async () => {
                try {
                    await callback.call(this, this.resolve, this.reject);
                } catch (error) {
                    this.reject(error);
                }
            })();
        }
    }

    static resolve(x, options)
    {
        if (typeof(x?.then) !== 'function')
            return super.resolve(x);
        return new this(x.then.bind(x), options);
    }

    static sleep = require('node:util').promisify(setTimeout);

    #emit(event, value, options)
    {
        call(() => options?.[event]?.call(this, value, ...options?.args??[]));
        call(() => options?.onEvent?.call(this, value, ...options?.args??[]));
    }

    #settled(state, event, value, options)
    {
        this.state = state;

        this.#emit(event, value, options);

        call(() => options?.onSettled?.call(this, value, ...options?.args??[]));

        this.resolve = () => undefined;
        this.reject = () => undefined;

        clearTimeout(this._timer);
        delete this._timer;
    }
}

/**
 * Control the concurrency of an async function.
 */
class PromiseSync
{
    promise = Promise.resolve();

    /**
     * Execute a function and block until it returns, resolves or rejects.
     * The `callback` is executed after the previous callback has returned.
     * @param {Function} callback `Function(resolve,reject)` to execute.
     * @param {Boolean} resolveOnReturn Whether to resolve when `callback` returns.
     * @return Returns the resolved value or the result of `callback`.
     */
    run(callback, resolveOnReturn)
    {
        return this.#execute(callback, resolveOnReturn);
    }

    /**
     * Try to execute a function and block until it returns, resolves or rejects.
     * The `callback` is executed after the previous callback has returned.
     * @param {Function} callback `Function(resolve,reject)` to execute.
     * @param {Boolean} resolveOnReturn Whether to resolve when `callback` returns.
     * @return Returns the resolved value or the result of `callback`.
     * @remarks Any errors are ignored and set as resolved.
     */
    try(callback, resolveOnReturn)
    {
        return this.#execute(callback, resolveOnReturn, true);
    }

    #execute(callback, resolveOnReturn, resolveOnError)
    {
        if (typeof(callback) !== 'function')
            throw new PromiseError('Invalid callback function: %s', callback);
        return new Promise((resolve, reject) => {
            const reject2 = resolveOnError ? resolve : reject;
            this.promise = this.promise.then(() => {
                return new Promise(async (_resolve) => {
                    try {
                        const retval = await callback(
                            (value) => _resolve(resolve(value)),
                            (value) => _resolve(reject(value))
                        );
                        if (resolveOnReturn) _resolve(resolve(retval));
                    } catch (error) {
                        _resolve(reject2(error));
                    }
                });
            });
        });
    }

    /**
     * Wrap an async function to prevent multiple simultaneous invocations.
     * @param {Function} fn The async function to wrap.
     * @param {Function?} callback Function to be called before blocking.
     * @param {Function?} check Function to check the previous result and determine whether to continue executing `fn`.
     * @return {Function} Returns an async function.
     */
    static wrap(fn, callback, check)
    {
        let promise = Promise.resolve();
        let cache = { result: undefined };
        return async (...args) => {
            if (callback) await callback(...args);
            return promise = promise.then(async () => {
                if (cache && (!check || await check(cache.result)))
                    // eslint-disable-next-line require-atomic-updates
                    return cache.result = await fn(...args);
                // eslint-disable-next-line require-atomic-updates
                cache = undefined;
            });
        };
    }
}

module.exports = {
    PromiseError,
    PromiseTimeout,
    PromiseEx,
    PromiseSync
};
