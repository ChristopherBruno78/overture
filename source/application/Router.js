/*global document, window, history, location */

import { Class, mixin } from '../core/Core';
import Obj from '../foundation/Object';
import '../foundation/ObservableProps';  // For Function#observes
import '../foundation/RunLoop';  // For Function#invokeInRunLoop, #queue

/**
    Module: Application

    The Application module contains classes for managing an HTML5 application.
*/

const hasOwnProperty = Object.prototype.hasOwnProperty;

let doRouting;

const _globalQueryStringPart = function () {
    // We don’t actually *depend* on a stable order here, but it’s desirable.
    // The specs don’t quite guarantee us that, but all current browsers provide
    // it. See https://stackoverflow.com/q/30076219/30919039 for details.
    const { knownGlobalQueryParams } = this;
    let returnValue = '';
    for ( const property in knownGlobalQueryParams ) {
        if ( hasOwnProperty.call( knownGlobalQueryParams, property ) ) {
            const value = this.get( property );
            if ( value !== null ) {
                if ( returnValue ) {
                    returnValue += '&';
                }
                returnValue += knownGlobalQueryParams[ property ] + '=' +
                    encodeURIComponent( value );
            }
        }
    }
    return returnValue;
};

/**
    Class: O.Router

    Extends: O.Object

    This class adds the ability to manage the URL in the browser window,
    updating it when your application state changes and vice versa.

    One thing to be careful of: using the hash (you know, `<h2 id=foo>` with `<a
    href=#foo>` elsewhere) is unreliable; it will generally work, but navigation
    back/forwards won’t jump to the right place automatically like it would in a
    normal document. Also, modifying <O.Router#routes> will cause the route
    handler to be evaluated again, which, depending on how you do things, will
    probably clobber the hash.
*/
const Router = Class({

    Extends: Obj,

    /**
        Property: O.Router#title
        Type: String

        The last title for the page window.
    */
    title: document.title,

    /**
        Property: O.Router#baseUrl
        Type: String
        Default: the origin, plus a trailing slash.

        The path to the base of the URL space that maps to application state.
        There’s also a different default for the file: scheme, using the hash,
        but realise that it may have issues if you have links that use the hash,
        or if you try loading the page without “#/” added on the end.
    */
    baseUrl: location.protocol === 'file:' ?
        location.href.replace(/#.*/, '') + '#/' :
        location.protocol + '//' + location.host + '/',

    /**
        Property: O.Router#knownGlobalQueryParams
        Type: {[String]: String}
        Default: {}

        An object containing any query string parameters that are known to be
        global, and not part of router state; for example, a debug flag.

        This should be set at construction time (it’s read-only after that) to
        an object with one entry per global query string parameter.

        • The key will be used as the property name in this Router object (it is
          thereby observable), and MUST NOT contain "."; take care to avoid
          collisions with other properties on the router.
        • The value will be the name of the query string item, and MUST contain
          only URL-safe characters, and definitely no ampersands.

        (The distinction between key and value is made to avoid collisions
        between object or router properties and query string parameters;
        otherwise, an array would have been suitable.)

        Although this knownGlobalQueryParams property is read-only after
        construction, the properties it causes to exist may be modified,
        and the URL will be updated when that happens. But beware: any links
        generated will be not be updated unless they depend on… something.
        Hmm, I wonder then whether we need an observable property that
        encompasses baseUrl and _globalQueryStringPart. Probably, in theory, but
        in practice I doubt much would use it. ☹ TODO.

        Example:

            knownGlobalQueryParams: {
                debug: 'debug',
                titleParam: 'title',
            },

        This will cause the Router to have two observable properties `debug` and
        `titleParam`, which will have values like these:

            ======================================== =========== ===============
            URL                                      this.debug  this.titleParam
            ======================================== =========== ===============
            https://www.example.com/                 null        null
            https://www.example.com/?debug=1         "1"         null
            https://www.example.com/?debug=0&title=  "0"         ""
            https://www.example.com/?title=foo%3Dbar null        "foo=bar"
            ======================================== =========== ===============
    */
    knownGlobalQueryParams: {},

    // Constructor replaces this with a property with the correct dependencies.
    _globalQueryStringPart: '',

    /**
        Property: O.Router#encodedState
        Type: String

        The encoded version of your application's current state. Whenever this
        changes, the URL will automatically be updated to match, therefore it
        should not contain any characters which are illegal in URLS. It may be a
        computed property with dependencies or set manually when state changes.
    */
    encodedState: '',

    /**
        Property: O.Router#replaceState
        Type: Boolean
        Default: false

        If set to true, the next change of encodedState will cause the current
        history entry to be relaced, rather than appending a new history entry.
        The property will then automatically be set back to false. Set this to
        true if you decode an invalid URL path to ensure it doesn't remain in
        the browser history.
    */
    replaceState: false,

    /**
        Property: O.Router#routes
        Type: Array

        A collection of regular expressions for matching against URLs and
        functions for decoding the state from the match. Entries will be tried
        in order. Each entry should be an object with two properties:

        url    - {RegExp} The regular expression to execute on the encoded
                 state.
        handle - {Function} The handler for decoding the state if the regular
                 expression matches. This will be given the full encoded state
                 as the first parameter, followed by any capturing groups in the
                 regular expression.

        Handlers SHOULD be idempotent.
    */
    routes: [],

    // eslint-disable-next-line object-shorthand
    init: function ( mixin_, win ) {
        Router.parent.constructor.call( this, mixin_ );

        mixin( this, {
            _globalQueryStringPart: function () {
                return _globalQueryStringPart.call( this );
            }.property( ...Object.keys( this.knownGlobalQueryParams ) ),
        });

        if ( !win ) {
            win = window;
        }
        this._win = win;
        this.doRouting();
        win.addEventListener( 'popstate', this, false );
    },

    /**
        Method (private): O.Router#_setTitle

        Sets the window title. Called automatically whenever the
        <O.Router#title> property changes.
    */
    _setTitle: function () {
        document.title = this.get( 'title' );
    }.observes( 'title' ),

    /**
        Method: O.Router#doRouting

        Reruns the routing. This method is called automatically when
        <O.Router#routes> changes. This is designed so that, for example, you
        can block routes when login is required.

        (This method would more naturally be called “route”, the verb, but that
        may lead to confusion with the noun “route”, referring to the current
        route. Hence the clumsy name doRouting.)
    */
    doRouting: doRouting = function () {
        const baseUrl = this.baseUrl;
        const href = this._win.location.href;
        if ( !href.startsWith( baseUrl ) ) {
            const error = new Error( 'Bad Router.baseUrl' );
            error.details = { href, baseUrl };
            throw error;
        }
        this.restoreEncodedState( href.slice( baseUrl.length ) );
    }.observes( 'routes' ),

    /**
        Method: O.Router#handleEvent

        Called automatically whenever the URL changes. Will compare to the last
        set value and if different, invoke <O.Router#restoreEncodedState> with
        the new URL.
    */
    handleEvent: doRouting.invokeInRunLoop(),

    /**
        Method: O.Router#restoreEncodedState

        Iterates throught the <O.Router#routes> until it finds a match, then
        uses that to decode the state. Called automatically whenever the URL
        changes, via <O.Router#doRouting>.

        Parameters:
            encodedState - {String} The encodedState to restore state from.

        Returns:
            {O.Router} Returns self.
    */
    restoreEncodedState ( encodedState ) {
        this.beginPropertyChanges();

        // Firstly, parse the query string and set the global params on this.
        const queryStringStart = encodedState.indexOf( '?' );
        let queryString;
        let encodedStateSansQueryString;
        if ( queryStringStart  !== -1 ) {
            // Parse the query string
            queryString = encodedState.slice( queryStringStart + 1 )
                .split( '&' )
                .map( entry => entry.split( '=', 2 ).map( decodeURIComponent ) )
                .reduce( ( obj, [ name, value ]) => {
                    obj[ name ] = value;
                    return obj;
                }, {} );

            // Consume global query string parameters, applying them to `this`.
            const { knownGlobalQueryParams } = this;
            for ( const property in knownGlobalQueryParams ) {
                if ( hasOwnProperty.call( knownGlobalQueryParams, property ) ) {
                    const name = knownGlobalQueryParams[ property ];
                    if ( hasOwnProperty.call( queryString, name ) ) {
                        this.set( property, queryString[ name ] );
                    } else {
                        this.set( property, null );
                    }
                }
            }

            encodedStateSansQueryString =
                encodedState.slice( 0, queryStringStart );
        } else {
            queryString = {};
            encodedStateSansQueryString = encodedState;
        }

        // Then on to the actual routing.
        const routes = this.get( 'routes' );
        for ( let i = 0, l = routes.length; i < l; i += 1 ) {
            const route = routes[i];
            const match = route.url.exec( encodedStateSansQueryString );
            if ( match ) {
                route.handle.apply( this, match );
                break;
            }
        }

        this.endPropertyChanges();
        return this;
    },

    /**
        Method (private): O.Router#_encodeStateToUrl

        Sets the current URL to match the <O.Router#encodedState> property.
        This method is called automatically once, at the end of the run loop,
        whenever this property changes.
    */
    _encodeStateToUrl: function () {
        const state = this.get( 'encodedState' );
        const replaceState = this.get( 'replaceState' );
        const win = this._win;
        const url = this.getUrlForEncodedState( state );
        const currentHref = win.location.href;
        if ( currentHref === url || ( currentHref.startsWith( url ) &&
                currentHref.charAt( url.length ) === '#' ) ) {
            // At the same path (possibly with an added hash); nothing to do.
            return;
        }
        const history = win.history;
        const title = this.get( 'title' );
        if ( replaceState ) {
            history.replaceState( null, title, url );
            this.set( 'replaceState', false );
        } else {
            history.pushState( null, title, url );
        }
    }.queue( 'after' ).observes( 'encodedState', '_globalQueryStringPart' ),

    getUrlForEncodedState ( state ) {
        let url = this.get( 'baseUrl' ) + state;
        const globalQueryStringPart = this.get( '_globalQueryStringPart' );
        if ( globalQueryStringPart ) {
            url += ( url.includes( '?' ) ? '&' : '?' ) + globalQueryStringPart;
        }
        return url;
    },
});

export default Router;
