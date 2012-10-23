// -------------------------------------------------------------------------- \\
// File: UnorderedCollectionView.js                                           \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

var UnorderedCollectionView = NS.Class({

    Extends: NS.View,

    // Range in list to render.
    _renderRange: {
        start: 0,
        end: 0x7fffffff // Max positive signed 32bit int: 2^31 - 1
    },

    _needsUpdate: false,
    _currentColour: true,

    selectionController: null,
    content: null,
    ItemView: null,

    itemHeight: 100,
    contentLength: NS.bind( 'content.length' ),

    childViews: function () {
        return Object.values( this._rendered );
    }.property(),

    init: function ( options ) {
        UnorderedCollectionView.parent.init.call( this, options );
        this._rendered = {};
        var selectionController = this.get( 'selectionController' );
        if ( selectionController ) {
            selectionController.set( 'view', this );
        }
    },

    destroy: function () {
        if ( this.get( 'isRendered' ) ) {
            var content = this.get( 'content' );
            if ( content ) {
                content.removeObserverForRange(
                    this._renderRange, this, '_redraw' );
                content.detach( 'query:updated', this, 'contentWasUpdated' );
            }
        }
        UnorderedCollectionView.parent.destroy.call( this );
    },

    contentDidChange: function ( _, __, oldVal, newVal ) {
        if ( this.get( 'isRendered' ) ) {
            var range = this._renderRange;
            if ( oldVal ) {
                oldVal.removeObserverForRange( range, this, '_redraw' );
                oldVal.detach( 'query:updated', this, 'contentWasUpdated' );
            }
            if ( newVal ) {
                newVal.addObserverForRange( range, this, '_redraw' );
                newVal.on( 'query:updated', this, 'contentWasUpdated' );
            }
            this._redraw();
        }
    }.observes( 'content' ),

    contentWasUpdated: function ( event ) {},

    layout: function () {
        return {
             top: 0,
             left: 0,
             right: 0,
             height: this.get( 'itemHeight' ) *
                 ( this.get( 'contentLength' ) || 0 )
        };
    }.property( 'itemHeight', 'contentLength' ),

    draw: function ( layer ) {
        // Render any unmanaged child views first.
        UnorderedCollectionView.parent.draw.call( this, layer );
        var content = this.get( 'content' );
        if ( content ) {
            content.addObserverForRange( this._renderRange, this, '_redraw' );
            content.on( 'query:updated', this, 'contentWasUpdated' );
            this.redrawLayer( layer );
        }
    },

    _redraw: function () {
        this.propertyNeedsRedraw( this, 'layer' );
    },

    createItemView: function ( content, index, list ) {
        var ItemView = this.get( 'ItemView' );
        return new ItemView({
            parentView: this,
            content: content,
            index: index,
            list: list,
            selectionController: this.get( 'selectionController' )
        });
    },
    destroyItemView: function ( view ) {
        view.destroy();
    },

    redrawLayer: function ( layer ) {
        var list = this.get( 'content' ) || [],

            // Limit to this range in the content array.
            renderRange = this._renderRange,
            start = Math.max( 0, renderRange.start ),
            end = Math.min( list.get( 'length' ), renderRange.end ),

            // Set of already rendered views.
            rendered = this._rendered,
            currentColour = this._currentColour,
            added = [],

            isInDocument = this.get( 'isInDocument' ),
            frag = layer.ownerDocument.createDocumentFragment(),
            i, l, item, id, view;

        // Get list to be rendered.
        for ( i = start, l = end; i < l; i += 1 ) {
            item = list.getObjectAt( i );
            id = item ? NS.guid( item ) : 'null:' + i;
            view = rendered[ id ];

            if ( view ) {
                view.set( 'index', i )
                    .set( 'list', list );
            } else {
                view = this.createItemView( item, i, list );
                frag.appendChild( view.render().get( 'layer' ) );
                if ( isInDocument ) {
                    view.willAppendLayerToDocument();
                    added.push( view );
                }
                rendered[ id ] = view;
            }
            view._ucv_gc = currentColour;
        }

        // Remove ones which have gone.
        for ( id in rendered ) {
            view = rendered[ id ];
            if ( view._ucv_gc !== currentColour ) {
                if ( isInDocument ) {
                    view.willRemoveLayerFromDocument();
                }
                layer.removeChild( view.get( 'layer' ) );
                if ( isInDocument ) {
                    view.didRemoveLayerFromDocument();
                }
                view.set( 'parentView', null );
                this.destroyItemView( view );
                delete rendered[ id ];
            }
        }

        // Add new ones
        layer.appendChild( frag );
        for ( i = 0, l = added.length; i < l; i += 1 ) {
            added[i].didAppendLayerToDocument();
        }

        this.computedPropertyDidChange( 'childViews' );
        this._needsUpdate = false;
        this._currentColour = !currentColour;
    },

    // --- Can't add views by hand; just bound to content ---

    insertView: null,
    replaceView: null,
    removeView: null
});

NS.UnorderedCollectionView = UnorderedCollectionView;

}( this.O ) );
