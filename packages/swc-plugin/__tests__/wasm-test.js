import {join} from 'path';
import {tmpdir} from 'os';

import {transformSync} from '@swc/core';

jest.unmock('@swc/core');

// requires the plugin to be built first with "npm run prepack"
const plugin = join(__dirname, '..', 'l10n_swc_plugin.wasm');

const transform = (code, options) =>
	transformSync(code, {
		filename: join(process.cwd(), 'src/a.js'),
		isModule: true,
		jsc: {
			target: 'es2022',
			parser: {syntax: 'ecmascript'},
			experimental: {cacheRoot: join(tmpdir(), 'l10n-swc-plugin'), plugins: [[plugin, options]]},
		},
	}).code;

describe('wasm plugin', () => {
	it('compiles the macros using @swc/core', () => {
		expect(
			transform(
				"import {t, plural} from '@bluecateng/l10n.macro';\n" +
					"export const a = (n, name) => t`Hello ${name}, ${plural(n, {one: 'one item', other: '# items'})}`;",
				{module: 'src/l10n', hashLength: 3}
			)
		).toBe(
			'import _l10n from "./l10n";\n' +
				'export const a = (n, name)=>/*#__PURE__*/ _l10n("fb9", {\n' +
				'        name,\n' +
				'        n\n' +
				'    }) /*l10n: Hello {name}, {n, plural, one {one item} other {# items}}*/ ;\n'
		);
	});

	it('reports invalid usages', () => {
		expect(() => transform("import {t} from '@bluecateng/l10n.macro';\nt();", {module: 'src/l10n'})).toThrow(
			'This macro requires one argument'
		);
	});
});
