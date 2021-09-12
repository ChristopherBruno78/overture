import { Class, meta } from '../../core/Core.js';
import { ObservableArray } from '../../foundation/ObservableArray.js';
import { RecordAttribute } from './attr.js';
import { Record } from './Record.js';

import '../../core/Array.js'; // For Array#erase

/**
    Method: O.Record#notifyRecordArray

    Parameters:
        _       - Unused
        propKey - The propKey that changed on the

    If true, any changes to the record will not be committed to the source.
*/
Record.prototype.notifyRecordArray = function (_, propKey) {
    const recordArray = this['_' + propKey + 'RecordArray'];
    const isInCache = propKey in meta(this).cache;
    // If it's already been updated due to a fetch to the property,
    // the array will be in the cache. Don't waste time calling again.
    if (recordArray && !isInCache) {
        recordArray.updateFromRecord();
    }
};

const mapToTrue = function (result, key) {
    result[key] = true;
    return result;
};

// ---

const ARRAY_PROPERTY = '[]';

const ToManyRecordArray = Class({
    Name: 'ToManyRecordArray',

    Extends: ObservableArray,

    init: function (record, propKey, Type) {
        this.record = record;
        this.propKey = propKey;
        this.Type = Type;
        this.store = record.get('store');

        this._updatingStore = false;

        ToManyRecordArray.parent.constructor.call(this);
    },

    toJSON() {
        return this._array.slice();
    },

    updateFromRecord() {
        if (!this._updatingStore) {
            const record = this.get('record');
            const propKey = this.get('propKey');
            let list = record[propKey].getRaw(record, propKey);
            if (!list) {
                list = [];
            } else if (record[propKey].Type === Object) {
                list = Object.keys(list);
                list.sort();
            } else {
                list = list.slice();
            }
            ToManyRecordArray.parent[ARRAY_PROPERTY].call(this, list);
        }
    },

    updateRecord() {
        const record = this.get('record');
        const propKey = this.get('propKey');
        const attr = record[propKey];
        let value = this._array;
        this._updatingStore = true;
        if (!value.length && attr.isNullable) {
            value = null;
        } else if (attr.Type === Object) {
            value = value.reduce(mapToTrue, {});
        } else {
            value = value.slice();
        }
        record[propKey].setRaw(record, propKey, value);
        this._updatingStore = false;
    },

    [ARRAY_PROPERTY]: function (array) {
        if (array) {
            ToManyRecordArray.parent[ARRAY_PROPERTY].call(
                this,
                array.map((x) => x.get('storeKey')),
            );
            this.updateRecord();
        } else {
            array = this.map((x) => x);
        }
        return array;
    }.property(),

    getObjectAt(index) {
        const storeKey = ToManyRecordArray.parent.getObjectAt.call(this, index);
        return storeKey
            ? this.get('store').getRecordFromStoreKey(storeKey)
            : null;
    },

    setObjectAt(index, value) {
        this.replaceObjectsAt(index, 1, [value]);
        return this;
    },

    replaceObjectsAt(index, numberRemoved, newItems) {
        newItems = newItems ? Array.from(newItems) : [];
        const store = this.get('store');
        const oldItems = ToManyRecordArray.parent.replaceObjectsAt
            .call(
                this,
                index,
                numberRemoved,
                newItems.map((x) => x.get('storeKey')),
            )
            .map((storeKey) => store.getRecordFromStoreKey(storeKey));
        this.updateRecord();
        return oldItems;
    },

    add(record) {
        const index = this._array.indexOf(record.get('storeKey'));
        if (index === -1) {
            this.replaceObjectsAt(this.get('length'), 0, [record]);
        }
        return this;
    },

    remove(record) {
        const index = this._array.indexOf(record.get('storeKey'));
        if (index > -1) {
            this.replaceObjectsAt(index, 1);
        }
        return this;
    },
});

// ---

const notifyRecordArrayObserver = {
    object: null,
    method: 'notifyRecordArray',
};

class ToManyAttribute extends RecordAttribute {
    __setupProperty__(metadata, propKey, object) {
        super.__setupProperty__(metadata, propKey, object);
        metadata.addObserver(propKey, notifyRecordArrayObserver);
    }

    __teardownProperty__(metadata, propKey, object) {
        super.__teardownProperty__(metadata, propKey, object);
        metadata.removeObserver(propKey, notifyRecordArrayObserver);
    }

    call(record, propValue, propKey) {
        const arrayKey = '_' + propKey + 'RecordArray';
        let recordArray = record[arrayKey];
        if (!recordArray) {
            recordArray = record[arrayKey] = new ToManyRecordArray(
                record,
                propKey,
                this.recordType,
            );
        }
        // Race condition: another observer may fetch this before
        // our notifyRecordArray method has been called.
        recordArray.updateFromRecord();
        if (propValue !== undefined) {
            recordArray.replaceObjectsAt(
                0,
                recordArray.get('length'),
                propValue.map((x) => x),
            );
        }
        return recordArray;
    }

    getRaw(record, propKey) {
        return super.call(record, undefined, propKey);
    }

    setRaw(record, propKey, data) {
        return super.call(record, data, propKey);
    }
}

ToManyAttribute.prototype.Type = Array;
ToManyAttribute.prototype.recordType = null;

const toMany = function (mixin) {
    return new ToManyAttribute(mixin);
};

export { toMany, ToManyAttribute };
