// -------------------------------------------------------------------------- \\
// File: SwitchView.js                                                        \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

var View = NS.View;
var Element = NS.Element;

var forEachView = function ( views, method, args ) {
    var l = views ? views.length : 0,
        view;
    while ( l-- ) {
        view = views[l];
        if ( view instanceof View && !view.isDestroyed ) {
            if ( args ) {
                view[ method ].apply( view, args );
            } else {
                view[ method ]();
            }
        }
    }
};

var SwitchView = NS.Class({

    Extends: View,

    init: function ( mixin ) {
        this.views = [];
        this.subViews = [];

        SwitchView.parent.init.call( this, mixin );

        this.isRendered = true;

        var views = this.get( 'views' ),
            l = views.length,
            view;
        while ( l-- ) {
            view = views[l];
            if ( view && !( view instanceof Array ) ) {
                views[l] = [ view ];
            }
        }
    },

    destroy: function () {
        var views = this.get( 'views' ),
            l = views.length;
        while ( l-- ) {
            forEachView( views[l], 'destroy' );
        }
        views = this.get( 'subViews' );
        l = views.length;
        while ( l-- ) {
            forEachView( views[l], 'destroy' );
        }
        SwitchView.parent.destroy.call( this );
    },

    // ---

    layer: function () {
        return document.createComment( 'SwitchView ' + this.get( 'id' ) );
    }.property(),

    willEnterDocument: function () {
        this.resumeBindings();
        this.redraw( true );
        return this;
    },

    didEnterDocument: function () {
        if ( this.get( 'index' ) !== this._index ) {
            this.switchNeedsRedraw();
        }
        return this.set( 'isInDocument', true );
    },

    willLeaveDocument: function () {
        return this.set( 'isInDocument', false );
    },

    didLeaveDocument: function () {
        return this.suspendBindings();
    },

    // ---

    _index: 0,
    index: 0,

    redraw: function ( willEnterDocument ) {
        if ( !this.isDestroyed && this.get( 'index' ) !== this._index ) {
            var parentView = this.get( 'parentView' ),
                view, l, node;
            if ( parentView ) {
                view = this._remove( parentView );
                if ( willEnterDocument ) {
                    l = view ? view.length : 0;
                    while ( l-- ) {
                        node = view[l];
                        if ( node instanceof View ) {
                            node.didLeaveDocument();
                        }
                    }
                }
                view = this._add();
                if ( willEnterDocument ) {
                    l = view ? view.length : 0;
                    while ( l-- ) {
                        node = view[l];
                        if ( node instanceof View ) {
                            node.willEnterDocument();
                        }
                    }
                }
            }
        }
    },

    switchNeedsRedraw: function () {
        if ( this.get( 'isInDocument' ) ) {
            NS.RunLoop.queueFn( 'render', this.redraw, this );
        }
    }.observes( 'index' ),

    parentViewDidChange: function ( _, __, oldParent, newParent ) {
        if ( oldParent ) {
            this._remove( oldParent );
        }
        if ( newParent ) {
            if ( newParent.get( 'isRendered' ) ) {
                // We need to wait until we've been inserted to know where our
                // DOM marker has been place, and so where to insert the real
                // view(s).
                newParent.addObserverForKey( 'childViews', this, '_add' );
            } else {
                // If not rendered, just add our views in the right place in the
                // parent's childView list. They'll be rendered in the right
                // spot.
                this._add();
            }
        }
    }.observes( 'parentView' ),

    _add: function ( object, key ) {
        if ( object ) {
            object.removeObserverForKey( key, this, '_add' );
        }
        var index = this.get( 'index' ),
            view = this.get( 'views' )[ index ],
            subView = this.get( 'subViews' )[ index ],
            parent = this.get( 'parentView' ),
            isInDocument = this.get( 'isInDocument' ),
            position = this.get( 'layer' ),
            layer = position.parentNode,
            l = view ? view.length : 0,
            node, before;

        if ( subView ) {
            forEachView( subView, 'set', [ 'parentView', parent ] );
            if ( isInDocument ) {
                forEachView( subView, 'willEnterDocument' );
            }
        }
        while ( l-- ) {
            node = view[l];
            if ( node instanceof View ) {
                parent.insertView( node, this, 'after' );
            } else {
                if ( typeof node !== 'object' ) {
                    node = view[l] = document.createTextNode( node );
                }
                before = position.nextSibling;
                if ( before ) {
                    layer.insertBefore( node, before );
                } else {
                    layer.appendChild( node );
                }
            }
        }
        if ( subView ) {
            if ( isInDocument ) {
                forEachView( subView, 'didEnterDocument' );
            }
            parent.set( 'childViews',
                parent.get( 'childViews' ).concat( subView ) );
        }
        this._index = index;
        return view;
    },

    _remove: function ( parent ) {
        var oldIndex = this._index,
            view = this.get( 'views' )[ oldIndex ],
            subView = this.get( 'subViews' )[ oldIndex ],
            isInDocument = this.get( 'isInDocument' ),
            l = view ? view.length : 0,
            node;

        if ( isInDocument && subView ) {
            forEachView( subView, 'willLeaveDocument' );
        }
        while ( l-- ) {
            node = view[l];
            if ( node instanceof View ) {
                parent.removeView( node );
            } else {
                node.parentNode.removeChild( node );
            }
        }
        if ( subView ) {
            if ( isInDocument ) {
                forEachView( subView, 'didLeaveDocument' );
            }
            forEachView( subView, 'set', [ 'parentView', null ] );
            parent.set( 'childViews',
                parent.get( 'childViews' ).filter( function ( view ) {
                    return subView.indexOf( view ) === -1;
                })
            );
        }
        this._index = -1;
        return view;
    },

    // ---

    /*
        If views are inside el() methods, they will call this method. Collect
        them up, then pass them as subViews when show() or otherwise() is
        called.
    */
    insertView: function ( view, parentNode ) {
        this.childViews.push( view );
        var oldParent = view.get( 'parentView' );
        if ( oldParent ) {
            oldParent.removeView( view );
        }
        parentNode.appendChild( view.render().get( 'layer' ) );
        return this;
    },

    _addCondition: function ( view, index ) {
        view = view ?
            view instanceof Array ?
                view :
                [ view ] :
            null;
        this.views[ index ] = view;
        var subView = this.childViews;
        if ( subView.length ) {
            this.subViews[ index ] = subView;
            this.childViews = [];
        }
        return this;
    },

    show: function ( view ) {
        return this._addCondition( view, 0 );
    },

    otherwise: function ( view ) {
        return this._addCondition( view, 1 );
    },

    end: function () {
        Element.forView( this._oldView );
        this._oldView = null;
        return this;
    }
});

NS.SwitchView = SwitchView;

var pickViewWhen = function ( bool ) {
    return bool ? 0 : 1;
};
var pickViewUnless = function ( bool ) {
    return bool ? 1 : 0;
};

var createView = function ( object, property, transform ) {
    var switchView = new SwitchView({
        index: NS.bind( property, object, transform )
    });
    switchView._oldView = Element.forView( switchView );
    return switchView;
};

Element.when = function ( object, property ) {
    return createView( object, property, pickViewWhen );
};
Element.unless = function ( object, property ) {
    return createView( object, property, pickViewUnless );
};

}( this.O ) );
