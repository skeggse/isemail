'use strict';

// Load modules

const Punycode = require('punycode/'); // Load the userland punycode module over the core Node module.

const Constants = require('./constants');
const Utils = require('./utils');

// Declare internals

const internals = {};


/**
 * Normalize the given lookup "table" to an iterator. Outputs items in arrays
 * and sets, keys from maps (regardless of the corresponding value), and own
 * enumerable keys from all other objects (intended to be plain objects).
 *
 * @param {*} table The table to convert.
 * @returns {Iterable<*>} The converted table.
 */
internals.normalizeTable = function (table) {

    if (Utils.isSet(table) || Array.isArray(table)) {
        return table;
    }

    if (Utils.isMap(table)) {
        return table.keys();
    }

    return Object.keys(table);
};


/**
 * Convert the given domain atom to its canonical form using Nameprep and string
 * lowercasing. Domain atoms that are all-ASCII will not undergo any changes via
 * Nameprep, and domain atoms that have already been canonicalized will not be
 * altered.
 *
 * @param {string} atom The atom to canonicalize.
 * @returns {string} The canonicalized atom.
 */
internals.canonicalizeAtom = function (atom) {

    return Punycode.toASCII(atom).toLowerCase();
};


/**
 * Check whether any of the values in the given iterable, when passed through
 * the iteratee function, are equal to the given value.
 *
 * @param {Iterable<*>} iterable The iterable to check.
 * @param {function(*): *} iteratee The iteratee that receives each item from
 *   the iterable.
 * @param {*} value The reference value.
 * @returns {boolean} Whether the given value matches any of the items in the
 *   iterable per the iteratee.
 */
internals.includesMapped = function (iterable, iteratee, value) {

    for (const item of iterable) {
        if (value === iteratee(item)) {
            return true;
        }
    }

    return false;
};


/**
 * Check whether the given top-level domain atom is valid based on the
 * configured blacklist/whitelist.
 *
 * @param {string} tldAtom The atom to check.
 * @param {Object} options
 *   {*} tldBlacklist The set of domains to consider invalid.
 *   {*} tldWhitelist The set of domains to consider valid.
 * @returns {boolean} Whether the given domain atom is valid per the blacklist/
 *   whitelist.
 */
internals.validDomain = function (tldAtom, options) {

    // Nameprep handles case-sensitive unicode stuff, but doesn't touch
    // uppercase ASCII characters.
    const canonicalTldAtom = internals.canonicalizeAtom(tldAtom);

    if (options.tldBlacklist) {
        return !internals.includesMapped(
            internals.normalizeTable(options.tldBlacklist),
            internals.canonicalizeAtom, canonicalTldAtom);
    }

    return internals.includesMapped(
        internals.normalizeTable(options.tldWhitelist),
        internals.canonicalizeAtom, canonicalTldAtom);
};


/**
 * Validate the parsed email address per the configured options, and report
 * infractions to the Diagnoses instance.
 *
 * @param {Object} parse The parsed data.
 * @param {Diagnoses} diagnoses The Diagnoses instance that tracks reported
 *   errors.
 * @param {Object} options The configured options that control the kinds of
 *   validation we perform here.
 */
exports.optionsValidation = function (parse, diagnoses, options) {

    const { minDomainAtoms, tldWhitelist, tldBlacklist } = options;

    if (minDomainAtoms && parse.domainParts.length < minDomainAtoms && !(parse.domainParts.length === 1 && parse.domainParts[0][0] === '[')) {
        diagnoses.diagnose(Constants.diagnoses.errDomainTooShort);
    }

    if (tldWhitelist || tldBlacklist) {
        const lastAtom = parse.domainParts[parse.domainParts.length - 1];

        if (!parse.domainParts.length) {
            // If the configuration specifies only an allowed list of TLDs,
            // then a lack of a TLD is implicitly invalid. If the
            // configuration specifies a forbidden list of TLDs, then a lack
            // of a TLD is only invalid because it fails due to the
            // unrelated errNoDomain fatal error.
            if (!tldBlacklist) {
                // TODO: Fix the index reporting because we don't know
                // whether there was CFWS at the end.
                diagnoses.diagnose(Constants.diagnoses.errUnknownTLD);
            }
        }
        else if (!internals.validDomain(lastAtom, options)) {
            // TODO: Fix the index reporting because we don't know whether
            // there was CFWS at the end.
            diagnoses.diagnose(Constants.diagnoses.errUnknownTLD);
        }
    }
};
