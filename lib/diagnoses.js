// @flow strict

// Load modules

import * as Constants from './constants';

/**
 * Diagnosis stores a diagnosis-index pair.
 */
class Diagnosis {
    type: number;
    index: number | null;

    /**
     * @param type The diagnostic code.
     * @param index The index of the diagnosis.
     */
    constructor(type: number, index: number | null) {

        this.type = type;
        this.index = index;
    }
}


/**
 * Diagnoses tracks a set of diagnostic codes for a string, along with their
 * positions in the string.
 */
export default class Diagnoses {
    _diagnoses: Diagnosis[];
    _worstDiagnosis: Diagnosis | null;

    constructor() {

        this._diagnoses = [];
        this._worstDiagnosis = null;
    }

    /**
     * Report the given diagnosis at the given index.
     *
     * @param type The diagnosis to report.
     * @param index The string offset in the input where the diagnosis occurs,
     *   if applicable.
     */
    diagnose(type: number, index: number | null = null) {

        const diagnosis = new Diagnosis(type, index);

        if (this._worstDiagnosis === null || type > this._worstDiagnosis.type) {
            this._worstDiagnosis = diagnosis;
        }

        this._diagnoses.push(diagnosis);
    }

    /**
     * Check whether the given diagnosis has been reported.
     *
     * @param queryType The diagnosis to query.
     * @return Whether the diagnosis has been reported.
     */
    hasDiagnosis(queryType: number): boolean {

        return this._diagnoses.some(({ type }) => type === queryType);
    }

    /**
     * Get the worst diagnosis encountered.
     *
     * @param exclusions The set of diagnoses to exclude per the configuration.
     * @return The worst diagnosis.
     */
    getWorstDiagnosis(exclusions: Set<number> = new Set()): Diagnosis | null {

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
     * @param exclusions The set of diagnoses to exclude per the configuration.
     * @return The backwards-compatible diagnosis.
     */
    getLegacyDiagnosis(exclusions: Set<number>): Diagnosis | null {

        const firstFatalDiagnosis = this._diagnoses.find(({ type }) => type >= Constants.categories.rfc5322 && !exclusions.has(type));

        if (firstFatalDiagnosis) {
            return firstFatalDiagnosis;
        }

        return this.getWorstDiagnosis(exclusions);
    }
}
