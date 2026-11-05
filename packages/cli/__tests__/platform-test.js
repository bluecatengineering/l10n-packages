import {chmodSync, copyFileSync, renameSync} from 'node:fs';

import {nativePath, replaceStub} from '../lib/platform';

jest.unmock('../lib/platform');

jest.mock('node:fs', () => ({chmodSync: jest.fn(), copyFileSync: jest.fn(), renameSync: jest.fn()}));

const {platform, arch} = process;

const setPlatform = (platform, arch) => {
	Object.defineProperty(process, 'platform', {value: platform});
	Object.defineProperty(process, 'arch', {value: arch});
};

const npm = {npm_config_user_agent: 'npm/11.0.0 node/v24.0.0 darwin arm64'};

afterEach(() => setPlatform(platform, arch));

describe('nativePath', () => {
	it('returns the path of the executable on macOS', () => {
		setPlatform('darwin', 'arm64');
		expect(nativePath('/pkg')).toBe('/pkg/native/darwin-arm64/l10n-cli');
		setPlatform('darwin', 'x64');
		expect(nativePath('/pkg')).toBe('/pkg/native/darwin-x64/l10n-cli');
	});

	it('returns the path of the executable on Linux', () => {
		setPlatform('linux', 'x64');
		expect(nativePath('/pkg')).toBe('/pkg/native/linux-x64/l10n-cli');
		setPlatform('linux', 'arm64');
		expect(nativePath('/pkg')).toBe('/pkg/native/linux-arm64/l10n-cli');
	});

	it('fails on unsupported platforms', () => {
		setPlatform('win32', 'x64');
		expect(() => nativePath('/pkg')).toThrow(
			'l10n-cli is not available for win32 x64, the supported platforms are: darwin-arm64, darwin-x64, linux-arm64, linux-x64'
		);
	});
});

describe('replaceStub', () => {
	it('replaces the stub with the executable', () => {
		setPlatform('darwin', 'arm64');
		expect(replaceStub('/app/node_modules/@bluecateng/l10n-cli', npm)).toBe(true);
		const dir = '/app/node_modules/@bluecateng/l10n-cli';
		expect(copyFileSync.mock.calls).toEqual([[`${dir}/native/darwin-arm64/l10n-cli`, `${dir}/bin/l10n-cli.tmp`]]);
		expect(chmodSync.mock.calls).toEqual([[`${dir}/bin/l10n-cli.tmp`, 0o755]]);
		expect(renameSync.mock.calls).toEqual([[`${dir}/bin/l10n-cli.tmp`, `${dir}/bin/l10n-cli`]]);
	});

	it('keeps the stub with other package managers', () => {
		expect(replaceStub('/app/node_modules/@bluecateng/l10n-cli', {npm_config_user_agent: 'pnpm/9.0.0'})).toBe(false);
		expect(replaceStub('/app/node_modules/@bluecateng/l10n-cli', {})).toBe(false);
		expect(copyFileSync).not.toHaveBeenCalled();
	});

	it('keeps the stub outside node_modules', () => {
		expect(replaceStub('/repo/packages/cli', npm)).toBe(false);
		expect(copyFileSync).not.toHaveBeenCalled();
	});

	it('keeps the stub if the executable can not be copied', () => {
		setPlatform('win32', 'x64');
		expect(replaceStub('/app/node_modules/@bluecateng/l10n-cli', npm)).toBe(false);
		expect(copyFileSync).not.toHaveBeenCalled();
	});
});
