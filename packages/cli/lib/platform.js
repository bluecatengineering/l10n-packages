import {chmodSync, copyFileSync, renameSync} from 'node:fs';
import {join, sep} from 'node:path';

// the Linux executables are statically linked, so they run with both glibc and musl
export const supported = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64'];

/** Returns the path of the executable for the current platform, `dir` is the package directory. */
export const nativePath = (dir) => {
	const {platform, arch} = process;
	const name = `${platform}-${arch}`;
	if (!supported.includes(name)) {
		throw new Error(
			`l10n-cli is not available for ${platform} ${arch}, the supported platforms are: ${supported.join(', ')}`
		);
	}
	return join(dir, 'native', name, 'l10n-cli');
};

/**
 * Replaces the bin stub with the executable, so running the command does not need to start Node.
 * Returns whether the stub was replaced, if not the stub runs the executable instead.
 */
export const replaceStub = (dir, env) => {
	// other package managers may run the bin file with node, and in this repository the stub is a source file
	if (!env.npm_config_user_agent?.startsWith('npm/') || !dir.includes(`${sep}node_modules${sep}`)) {
		return false;
	}
	try {
		const stub = join(dir, 'bin', 'l10n-cli');
		const tmp = `${stub}.tmp`;
		copyFileSync(nativePath(dir), tmp);
		chmodSync(tmp, 0o755);
		renameSync(tmp, stub);
		return true;
	} catch {
		return false;
	}
};
