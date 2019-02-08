// @flow strict

// Load modules

import * as Constants from './constants';
import Diagnoses from './diagnoses';
import Parser from './parser';
import * as Utils from './utils';
import * as Validation from './validation';

// Declare internals

const internals = {};


internals.hasOwn = Object.prototype.hasOwnProperty;
internals.indexOf = Array.prototype.indexOf;
internals.defaultThreshold = 16;
internals.maxIPv6Groups = 8;


internals.regex = {
    nonASCII: /[^\x00-\x7f]/
};

internals.normalizeSupportsNul = '\0'.normalize('NFC') === '\0';


internals.normalize = function (email: string) {

    return email.normalize('NFC');
};


// $lab:coverage:off$
if (!internals.normalizeSupportsNul) {
    internals.nulNormalize = function (str: string) {

        return str.replace(/[^\0]+/, (part) => part.normalize('NFC'));
    };

    internals.normalize = function (str: string) {

        if (str.includes('\0')) {
            return internals.nulNormalize(str);
        }

        return str.normalize('NFC');
    };
}
// $lab:coverage:on$



/**
 * Check whether the given value is a positive integer in the range [0,2^31-1].
 */
internals.isPositiveInteger = function (value: number) {

    return value === (0 | value) && value >= 0;
};


internals.isIterable = Array.isArray;

/* $lab:coverage:off$ */
if (typeof Symbol !== 'undefined') {
    internals.isIterable = (value: mixed) => Array.isArray(value) || (!!value && typeof value === 'object' && typeof value[Symbol.iterator] === 'function');
}
/* $lab:coverage:on$ */


export type ValidationOptions = {|
    allowUnicode?: boolean;
    errorLevel?: number;
    excludeDiagnoses?: Utils.TableOrIterable<number>;
    minDomainAtoms?: number;
    tldWhitelist?: string | Utils.TableOrIterable<string> | null;
    tldBlacklist?: string | Utils.TableOrIterable<string> | null;
|};


// We'd rather be precise here and forbid users providing both a tldWhitelist
// and a tldBlacklist, but https://github.com/facebook/flow/issues/7458.
//
// export type ValidationOptions = {|
//     ...CommonValidationOptions;
//     tldWhitelist?: null;
//     tldBlacklist?: null;
// |} | {|
//     ...CommonValidationOptions;
//     tldWhitelist: string | Utils.TableOrIterable<string>;
//     tldBlacklist?: null;
// |} | {|
//     ...CommonValidationOptions;
//     tldWhitelist?: null;
//     tldBlacklist: string | Utils.TableOrIterable<string>;
// |};


internals.isValid = function (inputEmail: string, options: ValidationOptions = Object.freeze({})) {

    const { errorLevel = internals.defaultThreshold } = options;

    const diagnosis = internals.validate(inputEmail, {
        ...options,
        errorLevel
    });

    return diagnosis === Constants.diagnoses.valid;
};


/**
 * Check that an email address conforms to RFCs 5321, 5322, 6530 and others
 *
 * We distinguish clearly between a Mailbox as defined by RFC 5321 and an
 * addr-spec as defined by RFC 5322. Depending on the context, either can be
 * regarded as a valid email address. The RFC 5321 Mailbox specification is
 * more restrictive (comments, white space and obsolete forms are not allowed).
 *
 * @param email The email address to check. See README for specifics.
 * @param options Optional options (see above for types):
 *   errorLevel Determines the boundary between valid and invalid addresses.
 *   tldBlacklist The set of domains to consider invalid.
 *   tldWhitelist The set of domains to consider valid.
 *   allowUnicode Whether to allow non-ASCII characters, defaults to true.
 *   minDomainAtoms The minimum number of domain atoms which must be present for
 *     the address to be valid.
 *   excludeDiagnoses The diagnosic codes to ignore.
 */
internals.validate = function (inputEmail: string, options: ValidationOptions = Object.freeze({})) {

    if (typeof inputEmail !== 'string') {
        throw new TypeError('expected string email');
    }

    const email = internals.normalize(inputEmail);

    const {
        errorLevel: threshold = Constants.diagnoses.valid,

        allowUnicode = true
    } = options;

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
    const excludeDiagnoses = Utils.normalizeTableAsSet(options.excludeDiagnoses, 'excludeDiagnoses');

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
        // https://github.com/facebook/flow/issues/7457
        // https://github.com/facebook/flow/issues/7458
        // $FlowFixMe
        Validation.optionsValidation(parse, diagnoses, {
            minDomainAtoms: options.minDomainAtoms,
            tldBlacklist: options.tldBlacklist,
            tldWhitelist: options.tldWhitelist
        });
    }

    const diagnosis = diagnoses.getLegacyDiagnosis(excludeDiagnoses);
    let maxResult = diagnosis ? diagnosis.type : Constants.diagnoses.valid;

    if (maxResult < threshold) {
        maxResult = Constants.diagnoses.valid;
    }

    return maxResult;
};


export const isValid = internals.isValid;
export const validate = internals.validate;


// Export a copy of the diagnostic codes.
export const diagnoses = internals.validate.diagnoses = {
    ...Constants.diagnoses
};


export const normalize = internals.normalize;
