// -------------------------------------------------------------------------- \\
// File: ListView.js                                                          \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var byIndex = function ( a, b ) {
    return a.get( 'index' ) - b.get( 'index' );
};
var addToTable = function ( array, table ) {
    var i, l;
    for ( i = 0, l = array.length; i < l; i += 1 ) {
        table[ array[i] ] = true;
    }
    return table;
};

var ListView = NS.Class({

    Extends: NS.View,

    content: null,
    contentLength: NS.bind( 'content.length' ),

    renderInOrder: true,

    ItemView: null,
    itemHeight: 0,

    childViews: function () {
        var views = Object.values( this._rendered );
        if ( this.get( 'renderInOrder' ) ) {
            views.sort( byIndex );
        }
        return views;
    }.property(),

    init: function ( mixin ) {
        this._added = null;
        this._removed = null;
        this._currentColour = true;
        this._rendered = {};
        this._renderRange = {
            start: 0,
            end: 0x7fffffff // Max positive signed 32bit int: 2^31 - 1
        };

        this.selection = null;

        ListView.parent.init.call( this, mixin );

        var selection = this.get( 'selection' );
        if ( selection ) {
            selection.set( 'view', this );
        }
    },

    destroy: function () {
        if ( this.get( 'isRendered' ) ) {
            var content = this.get( 'content' );
            if ( content ) {
                content.removeObserverForRange(
                    this._renderRange, this, '_redraw' );
                content.off( 'query:updated', this, 'contentWasUpdated' );
            }
        }
        ListView.parent.destroy.call( this );
    },

    contentDidChange: function ( _, __, oldVal, newVal ) {
        if ( this.get( 'isRendered' ) ) {
            var range = this._renderRange;
            if ( oldVal ) {
                oldVal.removeObserverForRange( range, this, '_redraw' );
                oldVal.off( 'query:updated', this, 'contentWasUpdated' );
            }
            if ( newVal ) {
                newVal.addObserverForRange( range, this, '_redraw' );
                newVal.on( 'query:updated', this, 'contentWasUpdated' );
            }
            this._redraw();
        }
    }.observes( 'content' ),

    contentWasUpdated: function ( event ) {
        if ( this.get( 'isInDocument' ) ) {
            this._added = addToTable( event.added, this._added || {} );
            this._removed = addToTable( event.removed, this._removed || {} );
        }
    },

    layout: function () {
        var itemHeight = this.get( 'itemHeight' );
        return itemHeight ? {
             height: itemHeight * ( this.get( 'contentLength' ) || 0 )
        } : {};
    }.property( 'itemHeight', 'contentLength' ),

    draw: function ( layer ) {
        // Render any unmanaged child views first.
        ListView.parent.draw.call( this, layer );
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

    // -----------------------------------------------------------------------

    isCorrectItemView: function () {
        return true;
    },

    createItemView: function ( content, index, list, isAdded ) {
        var ItemView = this.get( 'ItemView' );
        return new ItemView({
            parentView: this,
            content: content,
            index: index,
            list: list,
            isAdded: isAdded,
            selection: this.get( 'selection' )
        });
    },

    destroyItemView: function ( view ) {
        view.destroy();
    },

    redrawLayer: function ( layer ) {
        var list = this.get( 'content' ) || [],

            // Limit to this range in the content array.
            renderRange = this._renderRange,
            renderInOrder = this.get( 'renderInOrder' ),

            start = Math.max( 0, renderRange.start ),
            end = Math.min( list.get( 'length' ), renderRange.end ),

            childViews,
            dirtyStart = start,
            dirtyEnd = end,
            lastExistingView = null,

            // Set of already rendered views.
            rendered = this._rendered,
            currentColour = this._currentColour,
            viewsToInsert = [],

            // Are they new or always been there?
            added = this._added,
            removed = this._removed,

            isInDocument = this.get( 'isInDocument' ),
            frag = layer.ownerDocument.createDocumentFragment(),

            i, l, item, id, view, isAdded, isRemoved, viewToInsert;

        // If we have to keep the DOM order the same as the list order, we'll
        // have to remove existing views from the DOM. To optimise this, we
        // check from both ends whether the views are already correct.
        if ( renderInOrder ) {
            childViews = this.get( 'childViews' );
            l = childViews.length;
            while ( dirtyEnd && l ) {
                view = childViews[ l - 1 ];
                item = list.getObjectAt( dirtyEnd - 1 );
                if ( view.get( 'content' ) !== item ||
                        !this.isCorrectItemView( view, item, dirtyEnd - 1 ) ) {
                    break;
                }
                lastExistingView = view;
                l -= 1;
                dirtyEnd -= 1;
            }
            while ( dirtyStart < dirtyEnd && dirtyStart < l ) {
                view = childViews[ dirtyStart ];
                item = list.getObjectAt( dirtyStart );
                if ( view.get( 'content' ) !== item ||
                        !this.isCorrectItemView( view, item, dirtyStart ) ) {
                    break;
                }
                dirtyStart += 1;
            }
        }

        // Get list to be rendered.
        for ( i = start, l = end; i < l; i += 1 ) {
            item = list.getObjectAt( i );
            id = item ? NS.guid( item ) : 'null:' + i;
            view = rendered[ id ];
            if ( view && !this.isCorrectItemView( view, item, i ) ) {
                view.detach( false );
                this.destroyItemView( view );
                delete rendered[ id ];
                view = null;
            }
            if ( !view ) {
                isAdded = added && item ?
                    added[ item.get( 'id' ) ] : false;
                view = this.createItemView( item, i, list, isAdded );
                if ( view ) {
                    rendered[ id ] = view;
                }
                viewToInsert = !!view;
            } else {
                viewToInsert = ( renderInOrder &&
                    i >= dirtyStart && i < dirtyEnd );
                if ( viewToInsert ) {
                    if ( isInDocument ) {
                        view.willLeaveDocument();
                    }
                    layer.removeChild( view.get( 'layer' ) );
                    if ( isInDocument ) {
                        view.didLeaveDocument();
                    }
                }
                view.set( 'index', i )
                    .set( 'list', list );
            }
            if ( view ) {
                view._ucv_gc = currentColour;
            }
            if ( viewToInsert ) {
                frag.appendChild( view.render().get( 'layer' ) );
                if ( isInDocument ) {
                    view.willEnterDocument();
                }
                viewsToInsert.push( view );
            }
        }

        // Remove ones which have gone.
        for ( id in rendered ) {
            view = rendered[ id ];
            if ( view._ucv_gc !== currentColour ) {
                isRemoved = removed && ( item = view.get( 'content' ) ) ?
                    removed[ item.get( 'id' ) ]: false;
                view.detach( isRemoved );
                this.destroyItemView( view );
                delete rendered[ id ];
            }
        }

        // Add new ones
        if ( viewsToInsert.length ) {
            if ( lastExistingView ) {
                layer.insertBefore( frag, lastExistingView.get( 'layer' ) );
            } else {
                layer.appendChild( frag );
            }
            if ( isInDocument ) {
                for ( i = 0, l = viewsToInsert.length; i < l; i += 1 ) {
                    viewsToInsert[i].didEnterDocument();
                }
            }
        }

        this._added = null;
        this._removed = null;
        this._currentColour = !currentColour;
        this.computedPropertyDidChange( 'childViews' );
    },

    // --- Can't add views by hand; just bound to content ---

    insertView: null,
    replaceView: null,
    removeView: function ( view ) {
        var isInDocument = this.get( 'isInDocument' ),
            layer = view.get( 'layer' );
        if ( isInDocument ) {
            view.willLeaveDocument();
        }
        layer.parentNode.removeChild( layer );
        if ( isInDocument ) {
            view.didLeaveDocument();
        }
        view.set( 'parentView', null );
        return this;
    }
});

NS.ListView = ListView;

}( this.O ) );
