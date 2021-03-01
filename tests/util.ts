import * as titaniumlib from 'titaniumlib';
import * as path from 'path';
import * as os from 'os';
import child_process from 'child_process';
import { EventEmitter } from 'events';
import mockFS from 'mock-fs';
import stream from 'stream';
import sinon from 'sinon';

/**
 * Creates a mock child process with stdout and stderr properties to output to
 *
 * @returns {child_process.ChildProcess}
 */
export function createChildMock (): child_process.ChildProcess {
	const fakeChild = new EventEmitter() as child_process.ChildProcess;
	fakeChild.stdout = new EventEmitter() as stream.Readable;
	fakeChild.stderr = new EventEmitter() as stream.Readable;
	return fakeChild;
}

/**
 * Mocks the main appc cli executable and outputs the specified core and installer versions
 *
 * @param {sinon.SinonStub} stub - A stub created by stubbing the spawn method on child_process
 * @param {string} coreVersion - Value of the core version to output
 * @param {string} installerVersion - Value of the installer version to output
 * @param {number} waitTime - Time to wait before outputting the version to stdout
 * @param {boolean} mockVersionFile - Whether to mock the appc cli version file
 */
export function mockAppcCli (stub: sinon.SinonStub, coreVersion?: string, installerVersion?: string, waitTime = 500, mockVersionFile = false): void {
	const appcChild = createChildMock();

	if (coreVersion && installerVersion) {
		stub
			.withArgs('appc', sinon.match.any, sinon.match.any)
			.returns(appcChild);

		setTimeout(() => {
			appcChild.stdout?.emit('data', `{"NPM":"${installerVersion}","CLI":"${coreVersion}"}`);
			appcChild.emit('close', 0);
		}, waitTime);

		if (mockVersionFile) {
			const installPath = path.join(os.homedir(), '.appcelerator', 'install');
			mockFS({
				[installPath]: {
					'.version': coreVersion,
					[coreVersion]: {
						package: {
							'package.json': `{ "version": "${coreVersion}" }`
						}
					}
				},
			});
		}
		return;
	} else {
		setTimeout(() => {
			appcChild.stderr?.emit('data', '/bin/sh: appc: command not found\n');
			appcChild.emit('close', 127);
		}, waitTime);

		mockNpmCli(stub, 'appcelerator', installerVersion, waitTime + 250);

		if (coreVersion) {
			const installPath = path.join(os.homedir(), '.appcelerator', 'install');
			mockFS({
				[installPath]: {
					'.version': coreVersion,
					[coreVersion]: {
						package: {
							'package.json': `{ "version": "${coreVersion}" }`
						}
					}
				},
			});
		} else if (mockVersionFile) {
			mockFS({});
		}
	}
}

/**
 * Mocks the npm cli to return data for the specified package
 * @param {sinon.SinonStub} stub - A stub created by stubbing the spawn method on child_process
 * @param {string} packageName - Name of the package to return
 * @param {string} version - Version of the package to return
 * @param {number} [waitTime=500] - Time to wait before outputting data
 */
export function mockNpmCli (stub: sinon.SinonStub, packageName: string, version?: string, waitTime = 500): void {
	const npmChild = createChildMock();

	stub
		.withArgs('npm', [ 'ls', `${packageName}`, '--json', '--depth', '0', '--global' ], sinon.match.any)
		.returns(npmChild);

	setTimeout(() => {
		if (version) {
			npmChild.stdout?.emit('data', `{
				"dependencies": {
					"${packageName}": {
					"version": "${version}",
					"from": "${packageName}@${version}",
					"resolved": "https://registry.npmjs.org/${packageName}/-/${packageName}-${version}.tgz"
					}
				}
				}`);
		} else {
			npmChild.stdout?.emit('data', '{}');
		}
		npmChild.emit('close', 0);
	}, waitTime);
}

/**
 * Mocks the Node.js executable to return the specified value
 *
 * @param {sinon.SinonStub} stub - A stub created by stubbing the spawn method on child_process
 * @param {string} [version] - Version to output
 * @param {number} [waitTime=500] - Time to wait before outputting data
 */
export function mockNode (stub: sinon.SinonStub, version?: string, waitTime = 500): void {
	const nodeChild = createChildMock();
	stub
		.withArgs('node', sinon.match.any, sinon.match.any)
		.returns(nodeChild);

	setTimeout(() => {
		if (version) {
			nodeChild.stdout?.emit('data', `v${version}`);
			nodeChild.emit('close', 0);
		} else {
			nodeChild.stderr?.emit('data', '/bin/sh: node: command not found');
			nodeChild.emit('close', 127);
		}
	}, waitTime);
}

/**
 * Mocks titaniumlibs sdk.getInstalledSDKs to return the requested SDK alongside an older GA SDK
 * (7.0.2.GA) and a non GA SDK (8.1.0.v20190416065710)
 *
 * @param {String} version - The version to insert, if the value is undefined then an empty array will be returned
 */
export function mockSdk(version?: string): void {
	if (version === undefined) {
		global.sandbox
			.stub(titaniumlib.sdk, 'getInstalledSDKs')
			.returns([]);
	} else {
		global.sandbox
			.stub(titaniumlib.sdk, 'getInstalledSDKs')
			.returns([
				{
					name: '7.0.2.GA',
					manifest: {
						name: '7.0.2.v20180209105903',
						version: '7.0.2',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '4'
						},
						timestamp: '2/9/2018 19:05',
						githash: '5ef0c56',
						platforms: [
							'iphone',
							'android'
						]
					},
					path: '/Users/eharris/Library/Application Support/Titanium/mobilesdk/osx/7.0.2.GA'
				},
				{
					name: `${version}.GA`,
					manifest: {
						name: `${version}.v20181115134726`,
						version,
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						timestamp: '11/15/2018 21:52',
						githash: '2e5a7423d0',
						platforms: [
							'iphone',
							'android'
						]
					},
					path: `/Users/eharris/Library/Application Support/Titanium/mobilesdk/osx/${version}.GA`
				},
				{
					name: '8.1.0.v20190416065710',
					manifest: {
						name: '8.1.0.v20190416065710',
						version: '8.1.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '7'
						},
						timestamp: '4/16/2019 14:03',
						githash: '37f6d88',
						platforms: [
							'iphone',
							'android'
						]
					},
					path: '/Users/eharris/Library/Application Support/Titanium/mobilesdk/osx/8.1.0.v20190416065710'
				}
			]);
	}
}