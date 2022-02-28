import { ACTIVE_IN_INPUT } from '../../application/keyboardShortcuts.js';
import { Class } from '../../core/Core.js';
import { ButtonView } from './ButtonView.js';
import { formatKeyForPlatform } from '../../application/formatKeyForPlatform.js';
import { loc } from '../../localisation/i18n.js';

const ClearSearchButtonView = Class({
    Name: 'ClearSearchButtonView',

    Extends: ButtonView,

    positioning: 'absolute',

    baseClassName: 'v-ClearSearchButton',

    tooltip: loc('Shortcut: {value1}', formatKeyForPlatform('Ctrl-/')),

    // Alternatives are for AZERTY keyboard
    shortcut: 'Ctrl-/ Ctrl-Shift-/ Ctrl-Shift-:',
    shortcutWhenInputFocused: ACTIVE_IN_INPUT,
});

export { ClearSearchButtonView };
