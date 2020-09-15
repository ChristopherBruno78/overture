import ComputedProps from './ComputedProps.js';
import BoundProps from './BoundProps.js';
import ObservableProps from './ObservableProps.js';
import EventTarget from './EventTarget.js';
import {
    meta,
    mixin,
    OBJECT_INITIALISED,
    OBJECT_DESTROYED,
} from '../core/Core.js';

/**
    Class: O.Object

    Includes: O.ComputedProps, O.BoundProps, O.ObservableProps, O.EventTarget

    This is the root class for almost every object in the rest of the library.
    It adds support for computed properties, bound properties, observable
    properties and subscribing/firing events.
*/
/**
    Constructor: O.Object

    Parameters:
        ...mixins - {Object} (optional) Each argument passed will be treated
                    as an object, with any properties in that object added
                    to the new O.Object instance before initialisation (so
                    you can pass it getter/setter functions or observing
                    methods).
*/
const Obj = function (/* ...mixins */) {
    for (let i = 0, l = arguments.length; i < l; i += 1) {
        mixin(this, arguments[i]);
    }
    const metadata = meta(this);
    const inits = metadata.inits;
    for (const method in inits) {
        if (inits[method]) {
            this['init' + method]();
        }
    }
    metadata.lifestage = OBJECT_INITIALISED;
};
const ObjPrototype = Obj.prototype;
ObjPrototype.constructor = Obj;
ObjPrototype.init = Obj;

mixin(ObjPrototype, ComputedProps);
mixin(ObjPrototype, BoundProps);
mixin(ObjPrototype, ObservableProps);
mixin(ObjPrototype, EventTarget);

/**
    Method: O.Object#destroy

    Removes any connections to other objects (e.g. path observers and
    bindings) so the object will be available for garbage collection.
*/
mixin(ObjPrototype, {
    constructor: Obj,

    destroy() {
        const metadata = meta(this);
        const inits = metadata.inits;
        for (const method in inits) {
            if (inits[method]) {
                this['destroy' + method]();
            }
        }
        metadata.lifestage = OBJECT_DESTROYED;
    },
});

export default Obj;
