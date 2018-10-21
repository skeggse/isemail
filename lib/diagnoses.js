'use strict';

// Load modules

const Constants = require('./constants');

/**
 * Diagnosis stores a diagnosis-index pair.
 */
class Diagnosis {
    /**
     * @param {number} type The diagnostic code.
     * @param {number} index The index of the diagnosis.
     */
    constructor(type, index) {

        this.type = type;
        this.index = index;
    }
}


/**
 * Diagnoses tracks a set of diagnostic codes for a string, along with their
 * positions in the string.
 */
class Diagnoses {
    constructor() {

        this._diagnoses = [];
        this._worstDiagnosis = null;
    }

    /**
     * Report the given diagnosis at the given index.
     *
     * @param {number} type The diagnosis to report.
     * @param {number} index The
     */
    diagnose(type, index) {

        const diagnosis = new Diagnosis(type, index);

        if (this._worstDiagnosis === null || type > this._worstDiagnosis.type) {
            this._worstDiagnosis = diagnosis;
        }

        this._diagnoses.push(diagnosis);
    }

    /**
     * Check whether the given diagnosis has been reported.
     *
     * @param {number} queryType The diagnosis to query.
     * @return {boolean} Whether the diagnosis has been reported.
     */
    hasDiagnosis(queryType) {

        return this._diagnoses.some(({ type }) => type === queryType);
    }

    /**
     * Get the worst diagnosis encountered.
     *
     * @param {Set<number>=} exclusions The set of diagnoses to exclude per the
     *   configuration.
     * @return {?Diagnosis} The worst diagnosis.
     */
    getWorstDiagnosis(exclusions = new Set()) {

        // Use the precomputed worst diagnosis if it's not excluded.
        if (!this._worstDiagnosis || !exclusions.has(this._worstDiagnosis.type)) {
            return this._worstDiagnosis;
        }

        // Otherwise, find the worst non-excluded diagnosis.
        return this._diagnoses.reduce((worst, diagnosis) => {

            if (exclusions.has(diagnosis.type) || (worst && diagnosis.type <= worst.type)) {
                return worst;
            }

            return diagnosis;
        }, null);
    }

    /**
     * For compatibility with existing versions of isemail, this function gets
     * the first fatal diagnosis, or the worst non-fatal diagnosis.
     *
     * @param {Set<number>} exclusions The set of diagnoses to exclude per the
     *   configuration.
     * @return {?Diagnosis} The backwards-compatible diagnosis.
     */
    getLegacyDiagnosis(exclusions) {

        const firstFatalDiagnosis = this._diagnoses.find(({ type }) => type >= Constants.categories.rfc5322 && !exclusions.has(type));

        if (firstFatalDiagnosis) {
            return firstFatalDiagnosis;
        }

        return this.getWorstDiagnosis(exclusions);
    }
}


module.exports = Diagnoses;
