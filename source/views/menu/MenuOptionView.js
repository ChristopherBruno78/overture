import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { cancel, invokeAfterDelay } from '../../foundation/RunLoop.js';
import { canPointer } from '../../ua/UA.js';
import { PopOverView } from '../panels/PopOverView.js';
import { View } from '../View.js';

import /* { property, on, observes } from */ '../../foundation/Decorators.js';

const MenuOptionView = Class({
    Name: 'MenuOptionView',

    Extends: View,

    destroy() {
        this.removeView(this.get('childViews')[0]);
        MenuOptionView.parent.destroy.call(this);
    },

    isFocused: false,

    layerTag: 'li',

    className: function () {
        return (
            'v-MenuOption' +
            (this.get('content').get('button').get('isLastOfSection') &&
            this.get('index') < this.getFromPath('list.length') - 1
                ? ' v-MenuOption--lastOfSection'
                : '') +
            (this.get('isFocused') ? ' is-focused' : '')
        );
    }.property('isFocused'),

    draw(/* layer */) {
        const button = this.get('content').get('button');
        const title = button.get('sectionTitle');
        return [title ? el('h2.v-MenuOption-title', [title]) : null, button];
    },

    _focusTimeout: null,

    takeFocus() {
        if (this.get('isInDocument')) {
            this.get('controller').focus(this.get('content')).expandFocused();
        }
    },

    mousemove: function () {
        if (!this.get('isFocused') && !this._focusTimeout) {
            const popOverView = this.getParent(PopOverView);
            if (popOverView && popOverView.hasSubView()) {
                this._focusTimeout = invokeAfterDelay(this.takeFocus, 75, this);
            } else {
                this.takeFocus();
            }
        }
    }.on(canPointer ? 'pointermove' : 'mousemove'),

    mouseout: function () {
        if (this._focusTimeout) {
            cancel(this._focusTimeout);
            this._focusTimeout = null;
        }
        if (
            this.get('isFocused') &&
            !this.get('childViews')[0].get('isActive')
        ) {
            this.get('controller').focus(null);
        }
    }.on(canPointer ? 'pointerout' : 'mouseout'),
});

export { MenuOptionView };
