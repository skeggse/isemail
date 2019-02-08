// @flow strict

// Load modules

import Punycode from 'punycode/'; // Load the userland punycode module over the core Node module.

import * as Constants from './constants';
import type Diagnoses from './diagnoses';
import type { ParsedAddress } from './parser';
import * as Utils from './utils';

// Declare internals

const internals = {};


/**
 * Convert the given domain atom to its canonical form using Nameprep and string
 * lowercasing. Domain atoms that are all-ASCII will not undergo any changes via
 * Nameprep, and domain atoms that have already been canonicalized will not be
 * altered.
 *
 * @param atom The atom to canonicalize.
 * @return The canonicalized atom.
 */
internals.canonicalizeAtom = function (atom: string): string {

    return Punycode.toASCII(atom).toLowerCase();
};


/**
 * Check whether any of the values in the given iterable, when passed through
 * the iteratee function, are equal to the given value.
 *
 * @param iterable The iterable to check.
 * @param iteratee The iteratee that maps each item from the iterable.
 * @param value The reference value.
 * @return Whether the given value matches any of the items in the iterable per
 *   the iteratee.
 */
internals.includesMapped = function<T, V> (iterable: Iterable<T>, iteratee: (T) => V, value: V): boolean {

    for (const item of iterable) {
        if (value === iteratee(item)) {
            return true;
        }
    }

    return false;
};


type DomainValidationOptions = {|
    tldWhitelist: Utils.TableOrIterable<string>;
    tldBlacklist?: null;
|} | {|
    tldWhitelist?: null;
    tldBlacklist: Utils.TableOrIterable<string>;
|};


/**
 * Check whether the given top-level domain atom is valid based on the
 * configured blacklist/whitelist.
 *
 * @param tldAtom The atom to check.
 * @param options
 *   tldBlacklist The set of domains to consider invalid.
 *   tldWhitelist The set of domains to consider valid.
 * @return Whether the given domain atom is valid per the blacklist/ whitelist.
 */
internals.validDomain = function (tldAtom: string, options: DomainValidationOptions) {

    // Nameprep handles case-sensitive unicode stuff, but doesn't touch
    // uppercase ASCII characters.
    const canonicalTldAtom = internals.canonicalizeAtom(tldAtom);

    if (options.tldBlacklist) {
        return !internals.includesMapped(
            Utils.normalizeTable(options.tldBlacklist),
            internals.canonicalizeAtom, canonicalTldAtom);
    }

    return internals.includesMapped(
        Utils.normalizeTable(options.tldWhitelist),
        internals.canonicalizeAtom, canonicalTldAtom);
};


type CommonValidationOptions = {|
    minDomainAtoms?: number;
|};

export type ValidationOptions = {|
    ...CommonValidationOptions;
    tldWhitelist?: Utils.TableOrIterable<string>;
    tldBlacklist?: null;
|} | {|
    ...CommonValidationOptions;
    tldWhitelist?: null;
    tldBlacklist?: Utils.TableOrIterable<string>;
|};


/**
 * Validate the parsed email address per the configured options, and report
 * infractions to the Diagnoses instance.
 *
 * @param parse The parsed data.
 * @param diagnoses The Diagnoses instance that tracks reported errors.
 * @param options The configured options that control the kinds of validation we
 *   perform here.
 */
export const optionsValidation = function (parse: ParsedAddress, diagnoses: Diagnoses, options: ValidationOptions) {

    const { minDomainAtoms, tldWhitelist, tldBlacklist } = options;

    if (minDomainAtoms && parse.domainParts.length < minDomainAtoms && !(parse.domainParts.length === 1 && parse.domainParts[0][0] === '[')) {
        diagnoses.diagnose(Constants.diagnoses.errDomainTooShort);
    }

    if (tldWhitelist || tldBlacklist) {
        // $FlowFixMe: https://github.com/facebook/flow/issues/7457
        const domainOptions: DomainValidationOptions = { tldWhitelist, tldBlacklist };
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
        else if (!internals.validDomain(lastAtom, domainOptions)) {
            // TODO: Fix the index reporting because we don't know whether
            // there was CFWS at the end.
            diagnoses.diagnose(Constants.diagnoses.errUnknownTLD);
        }
    }
};
