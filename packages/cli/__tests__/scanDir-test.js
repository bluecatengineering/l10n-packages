import {readdir} from 'node:fs/promises';

import scanDir from '../src/scanDir';
import parseJS from '../src/parseJS';

jest.unmock('../src/scanDir');

jest.mock('node:fs/promises', () => ({readdir: jest.fn()}));
jest.mock('@babel/traverse', () => ({default: jest.fn()}));

describe('scanDir', () => {
	it('calls parseJS while scanning directories recursively', () => {
		const isDirectory = jest.fn();
		const isFile = jest.fn();
		readdir
			.mockResolvedValueOnce([
				{name: 'd0', isDirectory},
				{name: 'f0.js', isDirectory, isFile},
			])
			.mockResolvedValueOnce([
				{name: 'f1.x', isDirectory, isFile},
				{name: 'f2.js', isDirectory, isFile},
				{name: 'o3.js', isDirectory, isFile},
			]);
		isDirectory
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(false);
		isFile.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
		return scanDir('strings', '/foo', /\.jsx?$/).then(() => {
			expect(parseJS.mock.calls).toEqual([
				['strings', '/foo/f0.js'],
				['strings', '/foo/d0/f2.js'],
			]);
		});
	});

	it('fails if readdir fails', () => {
		readdir.mockRejectedValue(new Error('Test error'));
		return expect(scanDir()).rejects.toThrow('Test error');
	});

	it('fails if parseJS fails', () => {
		const isDirectory = jest.fn().mockReturnValueOnce(false);
		const isFile = jest.fn().mockReturnValueOnce(true);
		readdir.mockResolvedValueOnce([{name: 'f0.js', isDirectory, isFile}]);
		parseJS.mockRejectedValue(new Error('Test error'));
		return expect(scanDir('strings', '/foo', /\.jsx?$/)).rejects.toThrow('Test error');
	});
});
