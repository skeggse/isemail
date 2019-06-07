// @flow strict

// Load modules

import Util from 'util';

// Declare internals

const internals = {};


internals.isIterable = Array.isArray;

// Node 10 introduced isSet and isMap, which are useful for cross-realm type
// checking.
internals.typesUtils = (Util: any).types;

/* $lab:coverage:off$ */
internals.isSet = (value: mixed) => value instanceof Set;
internals.isMap = (value: mixed) => value instanceof Map;

if (typeof Symbol !== 'undefined') {
    internals.isIterable = (value: mixed) => Array.isArray(value) || (!!value && typeof value === 'object' && typeof value[Symbol.iterator] === 'function');
}

// TODO: Remove unnecessary code after https://github.com/hapijs/lab/issues/904
internals.isSetNativeOrCompat = (internals.typesUtils && internals.typesUtils.isSet) || internals.isSet;
internals.isMapNativeOrCompat = (internals.typesUtils && internals.typesUtils.isMap) || internals.isMap;
/* $lab:coverage:on$ */

export const isSet: (mixed) => boolean = internals.isSetNativeOrCompat;
export const isMap: (mixed) => boolean = internals.isMapNativeOrCompat;


export const isIterable = internals.isIterable;

export type Table<T> = T[] | Set<T> | Map<T, mixed> | {[T]: mixed};

export type TableOrIterable<T> = {[T]: mixed} | Iterable<T>;

/**
 * Normalize the given lookup "table" to an iterator. Outputs items in arrays
 * and sets, keys from maps (regardless of the corresponding value), and own
 * enumerable keys from all other objects (intended to be plain objects).
 *
 * @param table The table to convert.
 * @return The converted table.
 */
export const normalizeTable = function<T> (table: TableOrIterable<T>): Iterable<T> {

    if (isSet(table) || Array.isArray(table)) {
        const tableAsSetOrArray: T[] | Set<T> = (table: any);
        return tableAsSetOrArray;
    }

    if (isMap(table)) {
        const tableAsMap: Map<T, mixed> = (table: any);
        return tableAsMap.keys();
    }

    if (isIterable(table)) {
        const tableAsIterable: Iterable<T> = (table: any);
        return tableAsIterable;
    }

    const tableAsObject: {[T]: mixed} = (table: any);
    return Object.keys(tableAsObject);
};


/**
 * Normalize the given Table (many common kinds of iterables) to a Set.
 */
export const normalizeTableAsSet = function<T> (table: ?TableOrIterable<T>, tableName: string): Set<T> {

    if (!table) {
        return new Set();
    }

    if (!internals.isIterable(table)) {
        throw new TypeError(`expected iterable ${tableName}`);
    }

    // This won't catch cross-realm Sets pre-Node 10, but the new Set below will
    // cast the value to an in-realm Set representation.
    if (isSet(table)) {
        return ((table: any): Set<T>);
    }

    return new Set(normalizeTable(table));
};
