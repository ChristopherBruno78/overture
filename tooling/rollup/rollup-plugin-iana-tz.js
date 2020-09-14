import { createFilter } from '@rollup/pluginutils';
import compile from '../tz/compile-tz.js';

export default function ianaTZ(options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        transform(code, id) {
            if (!filter(id)) {
                return;
            }
            return compile(id, code);
        },
    };
}
