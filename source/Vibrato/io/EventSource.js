// -------------------------------------------------------------------------- \\
// File: EventSource.js                                                       \\
// Module: IO                                                                 \\
// Requires: Core, Foundation, XHR.js                                         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS, global ) {

var CONNECTING = 0;
var OPEN = 1;
var CLOSED = 2;

/**
    Class: O.EventSource
    
    Extends: O.Object
    
    Subscribe to push events on the server using this wrapper around the W3C
    EventSource object: <http://dev.w3.org/html5/eventsource/>
    
    Events are sent using a text/event-stream content type; see the linked spec
    for details. The event source object will fire events as they arrive.
*/
var EventSource = global.EventSource ? O.Class({
    
    Extends: NS.Object,
    
    /**
        Property: O.EventSource#readyState
        Type: Number
        
        A number describing the ready state of the event source, corresponding
        to those in the W3C spec:
        
        0 - CONNECTING
        1 - OPEN
        2 - CLOSED
    */
    readyState: CLOSED,
    
    /**
        Property: O.EventSource#url
        Type: String
        
        The url to connect to in order to receive events
    */
    url: '',
    
    /**
        Constructor: O.EventSource
        
        Parameters:
            options - {Object} (optional) Any properties in this object will be
                      added to the new O.EventSource instance before
                      initialisation (so you can pass it getter/setter functions
                      or observing methods).
    */
    init: function () {
        EventSource.parent.init.apply( this, arguments );
        this._eventTypes = [ 'open', 'message', 'error' ];
        this.open();
    },
    
    on: function ( type ) {
        var types = this._eventTypes,
            eventSource = this._eventSource;
        if ( types.indexOf( type ) === -1 ) {
            types.push( type );
            if ( eventSource ) {
                eventSource.addEventListener( type, this, false );
            }
        }
        EventSource.parent.on.apply( this, arguments );
    },
    
    handleEvent: function ( event ) {
        this.set( 'readyState', this._eventSource.readyState );
        this.fire( event.type, event );
    }.invokeInRunLoop(),
    
    /**
        Method (private): O.EventSource#_check
        
        Checks the computer hasn't been asleep. If it has, it restarts the
        connection.
    */
    _check: function () {
        var now = Date.now();
        if ( now - this._then > 67500 ) {
            this.fire( 'restart' );
            this.close().open();
        } else {
            this._then = now;
            this._tick =
                NS.RunLoop.invokeAfterDelay( this._check, 60000, this );
        }
    },
    /**
        Method (private): O.EventSource#_startStopCheck
        
        Sets up the timer to check if the computer has been asleep.
    */
    _startStopCheck: function () {
        var tick = this._tick;
        if ( this.get( 'readyState' ) !== CLOSED ) {
            if ( !tick ) {
                this._then = Date.now();
                this._check();
            }
        } else {
            if ( tick ) {
                O.RunLoop.cancel( tick );
                this._tick = null;
            }
        }
    }.observes( 'readyState' ),
    
    /**
        Method: O.EventSource#open
        
        If there is no current connection to the event source server,
        establishes a new connection.
        
        Returns:
            {O.EventSource} Returns self.
    */
    open: function () {
        if ( this.get( 'readyState' ) === CLOSED ) {
            var eventSource = this._eventSource =
                new global.EventSource( this.get( 'url' ) );
            
            this._eventTypes.forEach( function ( type ) {
                eventSource.addEventListener( type, this, false );
            }, this );
            
            this.set( 'readyState', eventSource.readyState );
        }
        return this;
    },
    
    /**
        Method: O.EventSource#close
        
        Close the connection to the event source server, if not already closed.
        
        Returns:
            {O.EventSource} Returns self.
    */
    close: function () {
        if ( this.get( 'readyState' ) !== CLOSED ) {
            this._eventSource.close();
            this._eventSource = null;
            this.set( 'readyState', CLOSED );
        }
        return this;
    }
}) : O.Class({
    
    Extends: NS.Object,
    
    readyState: CONNECTING,
    
    init: function () {
        EventSource.parent.init.apply( this, arguments );
        this._xhr = new NS.XHR( this );
        this.open();
    },
    open: function () {
        var headers = {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
        };
        if ( this._lastEventId ) {
            headers[ 'Last-Event-ID' ] = this._lastEventId;
        }
        if ( this._poll ) {
            headers[ 'X-Nginx-PushStream-Mode' ] = 'long-polling';
        }
        
        this.set( 'readyState', CONNECTING );
        this._data = '';
        this._eventName = '';
        this._processedIndex = 0;
        this._lastNewLineIndex = 0;
        this._xhr.send( 'GET', this.get( 'url' ), null, headers );
        return this;
    },
    close: function () {
        if ( this.get( 'readyState' ) !== CLOSED ) {
            this._xhr.abort();
            this.set( 'readyState', CLOSED );
        }
        return this;
    },
    
    _reconnectAfter: 30000,
    _lastEventId: '',
    _poll: !!global.ie,
    
    // --- io ---
    loading: function ( xhr ) {
        // Must start with text/event-stream (i.e. indexOf must === 0)
        // If it doesn't, fail the connection.
        if ( xhr.getResponseType().indexOf( 'text/event-stream' ) ) {
            this._failConnection();
        } else {
            this._openConnection();
            this._processData( xhr.getResponse() );
        }
    }.invokeInRunLoop(),
    success: function ( xhr ) {
        this._openConnection();
        this._processData( xhr.getResponse() + '\n\n' );
        this._reconnect();
    }.invokeInRunLoop(),
    failure: function ( xhr ) {
        this._failConnection();
    }.invokeInRunLoop(),
    // -- end io ---
    
    _openConnection: function () {
        if ( this.get( 'readyState' ) === CONNECTING ) {
            this.set( 'readyState', OPEN );
            this.fire( 'open' );
        }
    },
    _failConnection: function () {
        this.close();
        this.fire( 'error' );
    },
    _reconnect: function () {
        if ( this._poll ) {
            this.open();
        } else {
            NS.RunLoop.invokeAfterDelay(
                this.open, this._reconnectAfter, this );
        }
    },
    _processData: function ( text ) {
        // Look for a new line character since the last processed
        var lastIndex = this._lastNewLineIndex,
            newLine = /\u000d\u000a?|\u000a/g,
            match;
        
        // One leading U+FEFF BYTE ORDER MARK character must be ignored if any
        // are present.
        if ( !lastIndex && text.charAt( 0 ) === '\ufeff' ) {
            lastIndex = 1;
        }
        newLine.lastIndex = this._processedIndex;
        while ( match = newLine.exec( text ) ) {
            this._processLine( text.slice( lastIndex, match.index ) );
            lastIndex = newLine.lastIndex;
        }
        this._lastNewLineIndex = lastIndex;
        this._processedIndex = text.length;
    },
    _processLine: function ( line ) {
        // Blank line, dispatch event
        if ( /^\s*$/.test( line ) ) {
            this._dispatchEvent();
        } else {
            var colon = line.indexOf( ':' ),
                field = line,
                value = '';
            // Line starts with colon -> ignore.
            if ( !colon ) {
                return;
            }
            // Line contains colon:
            if ( colon > 0 ) {
                field = line.slice( 0, colon );
                value = line.slice( line.charAt( colon + 1 ) === ' ' ?
                    colon + 2 : colon + 1 );
            }
            switch ( field ) {
                case 'event':
                    this._eventName = value;
                    break;
                case 'data':
                    this._data += value + '\u000a';
                    break;
                case 'id':
                    this._lastEventId = value;
                    break;
                case 'retry':
                    if ( /^\d+$/.test( value ) ) {
                        this._reconnectAfter = parseInt( value, 10 );
                    }
                    break;
            }
        }
    },
    _dispatchEvent: function () {
        var data = this._data,
            type = this._eventName;
        if ( data ) {
            if ( data.slice( -1 ) === '\u000a' ) {
                data = data.slice( 0, -1 );
            }
            this.fire( type || 'message', {
                data: data,
                // origin: '',
                lastEventId: this._lastEventId
            });
        }
        this._data = '';
        this._eventName = '';
    }
});

/**
    Constant: O.EventSource.CONNECTING
    Type: Number
    
    <O.EventSource#readyState> when establishing a connection to the server.
*/
/**
    Constant: O.EventSource.OPEN
    Type: Number
    
    <O.EventSource#readyState> when a connection is open and receiving events.
*/
/**
    Constant: O.EventSource.CLOSED
    Type: Number
    
    <O.EventSource#readyState> when there is no connection and it is not being
    reestablished.
*/
EventSource.extend({
    CONNECTING: CONNECTING,
    OPEN: OPEN,
    CLOSED: CLOSED
});

NS.EventSource = EventSource;

}( O, this ) );
