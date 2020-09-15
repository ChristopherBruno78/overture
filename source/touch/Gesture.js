import GestureManager from './GestureManager.js';

export default class Gesture {
    constructor(mixin) {
        Object.assign(this, mixin);
        GestureManager.register(this);
    }
    destroy() {
        GestureManager.deregister(this);
    }
    cancel() {}
    start() {}
    move() {}
    end() {}
}
