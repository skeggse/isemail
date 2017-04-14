'use strict';

/** Highest positive signed 32-bit float value */
const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

/** Bootstring parameters */
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128; // 0x80
const delimiter = '-'; // '\x2D'

const adapt = function (delta, numPoints, firstTime) {

    let k = 0;
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for (/* no initialization */; delta > (base - tMin) * tMax >> 1; k += base) {
        delta = Math.floor(delta / (base - tMin));
    }
    return Math.floor(k + ((base - tMin) + 1) * delta / (delta + skew));
};

const ucs2decode = function (string) {

    const output = [];
    let counter = 0;
    const length = string.length;
    while (counter < length) {
        const value = string.charCodeAt(counter++);
        if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
            // It's a high surrogate, and there is a next character.
            const extra = string.charCodeAt(counter++);
            if ((extra & 0xFC00) === 0xDC00) { // Low surrogate.
                output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
            }
            else {
                // It's an unmatched surrogate; only append this code unit, in case the
                // next code unit is the high surrogate of a surrogate pair.
                output.push(value);
                counter--;
            }
        }
        else {
            output.push(value);
        }
    }
    return output;
};

const digitToBasic = function (digit, flag) {
    //  0..25 map to ASCII a..z or A..Z
    // 26..35 map to ASCII 0..9
    return digit + 22 + 75 * (digit < 26) - ((flag !== 0) << 5);
};

const encode = function (input) {

    const output = [];

    // Convert the input in UCS-2 to an array of Unicode code points.
    input = ucs2decode(input);

    // Cache the length.
    const inputLength = input.length;

    // Initialize the state.
    let n = initialN;
    let delta = 0;
    let bias = initialBias;

    // Handle the basic code points.
    for (const currentValue of input) {
        if (currentValue < 0x80) {
            output.push(String.fromCharCode(currentValue));
        }
    }

    const basicLength = output.length;
    let handledCPCount = basicLength;

    // `handledCPCount` is the number of code points that have been handled;
    // `basicLength` is the number of basic code points.

    // Finish the basic string with a delimiter unless it's empty.
    if (basicLength) {
        output.push(delimiter);
    }

    // Main encoding loop:
    while (handledCPCount < inputLength) {

        // All non-basic code points < n have been handled already. Find the next
        // larger one:
        let m = maxInt;
        for (const currentValue of input) {
            if (currentValue >= n && currentValue < m) {
                m = currentValue;
            }
        }

        // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
        // but guard against overflow.
        const handledCPCountPlusOne = handledCPCount + 1;

        delta += (m - n) * handledCPCountPlusOne;
        n = m;

        for (const currentValue of input) {
            if (currentValue < n) {
                ++delta;
            }
            if (currentValue === n) {
                // Represent delta as a generalized variable-length integer.
                let q = delta;
                for (let i = base; /* no condition */; i += base) {
                    const t = i <= bias ? tMin : (i >= bias + tMax ? tMax : i - bias);
                    if (q < t) {
                        break;
                    }
                    const qMinusT = q - t;
                    const baseMinusT = base - t;
                    output.push(
                        String.fromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
                    );
                    q = Math.floor(qMinusT / baseMinusT);
                }

                output.push(String.fromCharCode(digitToBasic(q, 0)));
                bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
                delta = 0;
                ++handledCPCount;
            }
        }

        ++delta;
        ++n;

    }
    return output.join('');
};

module.exports = function (domain) {

    return encode(domain).length;
};
