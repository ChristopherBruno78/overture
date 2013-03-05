// -------------------------------------------------------------------------- \\
// File: RadioView.js                                                         \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, CheckboxView.js                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.RadioView

    Extends: O.AbstractControlView

    A radio-button control view. The `value` property is two-way bindable,
    representing the state of the button (`true` => selected).
*/
var RadioView = NS.Class({

    Extends: NS.AbstractControlView,

    // --- Render ---

    /**
        Property: O.RadioView#className
        Type: String
        Default: 'RadioView'

        Overrides default in <O.View#className>.
    */
    className: 'RadioView',

    draw: function ( layer ) {
        layer.appendChild(
            this._domControl = NS.Element.create( 'input', {
                type: 'radio',
                checked: this.get( 'value' )
            })
        );
        RadioView.parent.draw.call( this, layer );
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.RadioView#propertyNeedsRedraw

        Overridden to observe extra properties requiring redraw.
        See <O.View#propertyNeedsRedraw>.
    */
    propertyNeedsRedraw: NS.CheckboxView.prototype.propertyNeedsRedraw,

    /**
        Method: O.RadioView#redrawValue

        Updates the checked status of the DOM `<input type="radio">` to match
        the value property of the view.
    */
    redrawValue: NS.CheckboxView.prototype.redrawValue,

    // --- Keep state in sync with render ---

    /**
        Method: O.RadioView#activate

        Overridden to set the view as selected. See
        <O.AbstractControlView#activate>.
    */
    activate: function () {
        this.set( 'value', true );
    }.on( 'click' )
});

NS.RadioView = RadioView;

}( this.O ) );
