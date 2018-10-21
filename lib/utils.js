'use strict';

// Load modules

const Util = require('util');

// $lab:coverage:off$
const isSet = (value) => value instanceof Set;

const isMap = (value) => value instanceof Map;

// Node 10 introduced isSet and isMap, which are useful for cross-realm type
// checking.
exports.isSet = Util.types && Util.types.isSet || isSet;

exports.isMap = Util.types && Util.types.isMap || isMap;
// $lab:coverage:on$
