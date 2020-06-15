import { isApple } from '../ua/UA';

/**
    Function: O.toPlatformKey

    Remap a key combination to it's platform specific counterpart.

    Parameters:
        key - {String} The key combination to remap

    Returns:
        {String} The corresponding key mapped for the user's platform.
*/
export default function toPlatformKey ( key ) {
    if ( key.contains( 'Cmd-' ) ) {
        key = key.replace( 'Cmd-', isApple ? 'Meta-' : 'Ctrl-' );
        if ( !isApple &&
                key.contains( 'Shift-' ) &&
                key.charAt( key.length - 2 ) === '-' ) {
            // The shift modifier is applied to the key returned (so it is
            // uppercase) if the Ctrl key is pressed, but not if Meta is
            // pressed
            key = key.slice( 0, -1 ) + key.slice( -1 ).toUpperCase();
        }
    }
    return key;
}

