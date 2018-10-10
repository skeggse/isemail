'use strict';

// Load modules

const Constants = require('./constants');
const Diagnoses = require('./diagnoses');
const Parser = require('./parser');
const Utils = require('./utils');
const Validation = require('./validation');

// Declare internals

const internals = {
    hasOwn: Object.prototype.hasOwnProperty,
    indexOf: Array.prototype.indexOf,
    defaultThreshold: 16,
    maxIPv6Groups: 8
};


internals.regex = {
    nonASCII: /[^\x00-\x7f]/
};

internals.normalizeSupportsNul = '\0'.normalize('NFC') === '\0';


internals.normalize = function (email) {

    return email.normalize('NFC');
};


// $lab:coverage:off$
if (!internals.normalizeSupportsNul) {
    internals.nulNormalize = function (email) {

        return email.replace(/[^\0]+/, (part) => part.normalize('NFC'));
    };

    internals.normalize = function (email) {

        if (email.includes('\0')) {
            return internals.nulNormalize(email);
        }

        return email.normalize('NFC');
    };
}
// $lab:coverage:on$



/**
 * Check whether the given value is a positive integer in the range [0,2^31-1].
 *
 * @param {number} value
 * @return {boolean}
 */
internals.isPositiveInteger = function (value) {

    return value === (0 | value) && value >= 0;
};


internals.isIterable = Array.isArray;

/* $lab:coverage:off$ */
if (typeof Symbol !== 'undefined') {
    internals.isIterable = (value) => Array.isArray(value) || (!!value && typeof value === 'object' && typeof value[Symbol.iterator] === 'function');
}
/* $lab:coverage:on$ */


/**
 * Check that an email address conforms to RFCs 5321, 5322, 6530 and others
 *
 * We distinguish clearly between a Mailbox as defined by RFC 5321 and an
 * addr-spec as defined by RFC 5322. Depending on the context, either can be
 * regarded as a valid email address. The RFC 5321 Mailbox specification is
 * more restrictive (comments, white space and obsolete forms are not allowed).
 *
 * @param {string} email The email address to check. See README for specifics.
 * @param {Object} options The (optional) options:
 *   {*} errorLevel Determines the boundary between valid and invalid
 *     addresses.
 *   {*} tldBlacklist The set of domains to consider invalid.
 *   {*} tldWhitelist The set of domains to consider valid.
 *   {*} allowUnicode Whether to allow non-ASCII characters, defaults to true.
 *   {*} minDomainAtoms The minimum number of domain atoms which must be present
 *     for the address to be valid.
 * @param {function(number|boolean)} callback The (optional) callback handler.
 * @return {*}
 */
exports.validate = internals.validate = function (email, options = {}, callback = null) {

    if (typeof email !== 'string') {
        throw new TypeError('expected string email');
    }

    email = internals.normalize(email);

    // The callback function is deprecated.
    // $lab:coverage:off$
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (typeof callback !== 'function') {
        callback = null;
    }
    // $lab:coverage:on$

    const {
        errorLevel = false,

        allowUnicode = true
    } = options;

    let diagnose;
    let threshold;

    // Support either a number or a boolean to control whether we report a true-
    // false classification of validity or report a fine-grained error code for
    // diagnostics.
    if (typeof errorLevel === 'number') {
        diagnose = true;
        threshold = errorLevel;
    }
    else {
        diagnose = !!errorLevel;
        threshold = Constants.diagnoses.valid;
    }

    if (options.tldWhitelist) {
        if (typeof options.tldWhitelist === 'string') {
            options.tldWhitelist = [options.tldWhitelist];
        }
        else if (typeof options.tldWhitelist !== 'object') {
            throw new TypeError('expected array or object tldWhitelist');
        }
    }

    if (options.tldBlacklist) {
        if (typeof options.tldBlacklist === 'string') {
            options.tldBlacklist = [options.tldBlacklist];
        }
        else if (typeof options.tldBlacklist !== 'object') {
            throw new TypeError('expected array or object tldBlacklist');
        }
    }

    if (options.minDomainAtoms && !internals.isPositiveInteger(options.minDomainAtoms)) {
        throw new TypeError('expected positive integer minDomainAtoms');
    }

    // Normalize the set of excluded diagnoses.
    if (options.excludeDiagnoses) {
        if (!internals.isIterable(options.excludeDiagnoses)) {
            throw new TypeError('expected iterable excludeDiagnoses');
        }

        // This won't catch cross-realm Sets pre-Node 10, but it will cast the
        // value to an in-realm Set representation.
        if (!Utils.isSet(options.excludeDiagnoses)) {
            options.excludeDiagnoses = new Set(options.excludeDiagnoses);
        }
    }

    const diagnoses = new Diagnoses();
    const parser = new Parser(email, diagnoses);

    if (!allowUnicode) {
        const match = internals.regex.nonASCII.exec(email);
        if (match) {
            diagnoses.diagnose(Constants.diagnoses.undesiredNonAscii, match.index);
        }
    }

    // Actually parse the email address, and collect the errors in the diagnoses
    // object.
    const parse = parser.parse();

    // If the email address prompted no fatal errors, consider other possible
    // fatal errors based on the configuration.
    if (parse) {
        Validation.optionsValidation(parse, diagnoses, options);
    }

    const diagnosis = diagnoses.getLegacyDiagnosis(options.excludeDiagnoses || new Set());
    let maxResult = diagnosis ? diagnosis.type : Constants.diagnoses.valid;

    if (maxResult < threshold) {
        maxResult = Constants.diagnoses.valid;
    }

    const finishResult = diagnose ? maxResult : maxResult < internals.defaultThreshold;

    // $lab:coverage:off$
    if (callback) {
        callback(finishResult);
    }
    // $lab:coverage:on$

    return finishResult;
};


// Export a copy of the diagnostic codes.
exports.diagnoses = internals.validate.diagnoses = Object.assign({}, Constants.diagnoses);


exports.normalize = internals.normalize;


exports.internals = internals;
