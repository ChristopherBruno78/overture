// Yeah, core is importing something from localisation. Boundaries like “core”
// and “localisation” aren’t solid boundaries these days, anyway. Deal with it.
// It’s not a circular import. Everyone’s happy.
import { compare } from '../localisation/i18n.js';

/**
    Function: O.sortByProperties

    Creates a comparison function which takes two objects and returns -1/0/1 to
    indicate whether the first object is before or after the other. Comparison
    is made by considering each of the properties in the array in turn on the
    two objects until the objects have non-equal values for a property. Strings
    will be compared case-insensitively.

    Parameters:
        properties - {String[]} The properties to sort the objects by, in
                     order of precedence. Can also supply just a String for one
                     property.

    Returns:
        {Function} This function may be passed to the Array#sort method to
        sort the array of objects by the properties specified.
*/
const sortByProperties = function (properties) {
    if (!(properties instanceof Array)) {
        properties = [properties];
    }
    const l = properties.length;

    return function (a, b) {
        const hasGet = !!a.get;
        for (let i = 0; i < l; i += 1) {
            const prop = properties[i];
            const aVal = hasGet ? a.get(prop) : a[prop];
            const bVal = hasGet ? b.get(prop) : b[prop];
            const type = typeof aVal;

            // Must be the same type
            if (type === typeof bVal) {
                if (type === 'boolean' && aVal !== bVal) {
                    return aVal ? -1 : 1;
                }
                if (type === 'string') {
                    return compare(aVal, bVal);
                }
                if (aVal < bVal) {
                    return -1;
                }
                if (aVal > bVal) {
                    return 1;
                }
            }
        }
        return 0;
    };
};

export { sortByProperties };
