/*global document */

import { create as el } from './Element';

/**
    Namespace: O.Stylesheet

    The O.Stylesheet namespace contains helper functions for dealing with CSS
    stylesheets.
*/
export default {
    /**
        Function: O.Stylesheet.create

        Injects CSS into the document by creating a new stylesheet and appending
        it to the document.

        Parameters:
            id  - {String} The id to give the node in the document.
            css - {String} The CSS to insert into the stylesheet.

        Returns:
            {Element} The <style> node that was created.
    */
    create ( id, css ) {
        const style = el( 'style', {
            type: 'text/css',
            id,
            text: css,
        });
        document.head.appendChild( style );
        return style;
    },
};
