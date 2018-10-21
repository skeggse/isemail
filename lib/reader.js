'use strict';

/**
 * A simple unicode-compatible token stream with one-token lookahead.
 */
class Reader {
    /**
     * @param {string} string The string to stream.
     */
    constructor(string) {

        this._iter = string[Symbol.iterator]();
        this._next = this._iter.next.bind(this._iter);
        this._nextRune = null;
        this.index = 0;
        this.prevIndex = -1;
    }

    /**
     * The iterator protocol method, which enables the for..of syntax with a
     * Reader object. Note that this means any for..of will drain the Reader if
     * not interrupted, though this is usually the preferred behavior for
     * consumable iterators.
     */
    [Symbol.iterator]() {

        return this;
    }

    /**
     * The next method for the iterator protocol, which returns both the next
     * token and a flag indicating whether we've reached the end of the stream.
     *
     * Note that because we're dealing with unicode runes, we'll always be able
     * to infer that we're done from a falsy rune.
     *
     * @return {Object} An object containing the value and done fields, which
     *   the iterator protocol requires for iteration.
     */
    next() {

        let ret;
        let rune;

        if (this._nextRune !== null) {
            rune = this._nextRune;
            this._nextRune = null;
            ret = { value: rune || undefined, done: !rune };
        }
        else {
            ret = this._next();
            rune = ret.value;
        }

        this.prevIndex = this.index;
        this.index += rune ? rune.length : 0;
        return ret;
    }

    /**
     * Peek at the next token. Does not follow the same API as the next() method
     * as this does not need to be compatible with the iterator protocol.
     *
     * @return {string|undefined} The next rune, or undefined if we're out of
     *   runes.
     */
    peek() {

        if (this._nextRune === null) {
            this._nextRune = this._next().value;
        }

        return this._nextRune;
    }
}

module.exports = Reader;
