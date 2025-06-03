import {readdir} from 'node:fs/promises';

import scanDir from '../src/scanDir';
import parseJS from '../src/parseJS';

jest.unmock('../src/scanDir');

jest.mock('node:fs/promises', () => ({readdir: jest.fn()}));
jest.mock('@babel/traverse', () => ({default: jest.fn()}));

describe('scanDir', () => {
	it('calls parseJS while scanning directories recursively', () => {
		const isFile = jest.fn();
		readdir.mockResolvedValueOnce([
			{name: 'd0', parentPath: '/foo', isFile},
			{name: 'f0.js', parentPath: '/foo', isFile},
			{name: 'f1.x', parentPath: '/foo/d0', isFile},
			{name: 'f2.js', parentPath: '/foo/d0', isFile},
			{name: 'o3.js', parentPath: '/foo/d0', isFile},
		]);
		isFile
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false);
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
