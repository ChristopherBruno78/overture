// -------------------------------------------------------------------------- \\
// File: SelectView.js                                                        \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var SelectView = NS.Class({

    Extends: NS.AbstractControlView,

    options: [],

    // --- Render ---

    className: 'SelectView',

    _render: function ( layer ) {
        var control = this._domControl =
            this._renderSelect( this.get( 'options' ) );
        SelectView.parent._render.call( this, layer );
        layer.appendChild( control );
    },

    _renderSelect: function ( options ) {
        var selected = this.get( 'value' ),
            el = NS.Element.create,
            select = el( 'select', { disabled: this.get( 'disabled' ) },
                options.map( function ( option, i ) {
                    return el( 'option', {
                        text: option.text,
                        value: i,
                        selected: option.value === selected,
                        disabled: !!option.isDisabled
                    });
                })
            );
        return select;
    },

    // --- Keep state in sync with render ---

    syncBackValue: function ( event ) {
        var i = this._domControl.selectedIndex;
        this.set( 'value', this.get( 'options' ).getObjectAt( i ).value );
    }.on( 'change' ),

    // --- Keep render in sync with state ---

    syncOptions: function () {
        if ( this.get( 'isRendered' ) ) {
            var select = this._renderSelect( this.get( 'options' ) );
            this.get( 'layer' ).replaceChild( select, this._domControl );
            this._domControl = select;
        }
    }.observes( 'options' ),

    syncValue: function () {
        if ( this.get( 'isRendered' ) ) {
            var value = this.get( 'value' ),
                options = this.get( 'options' ),
                l = options.length;

            while ( l-- ) {
                if ( options[l].value === value ) {
                    this._domControl.value = l + '';
                    return;
                }
            }
        }
    }.observes( 'value' )
});

NS.SelectView = SelectView;

}( this.O ) );
