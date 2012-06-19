// -------------------------------------------------------------------------- \\
// File: Draggable.js                                                         \\
// Module: View                                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

NS.Draggable = {
    isDraggable: true,
    isDragging: false,
    dragStarted: function ( drag ) {},
    dragMoved: function ( drag ) {},
    dragEnded: function ( drag ) {}
};

}( this.O ) );