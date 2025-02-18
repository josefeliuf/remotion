import {createWriteStream} from 'node:fs';
import {ensureOutputDirectory} from '../ensure-output-directory';
import {readFile} from './read-file';

type Response = {sizeInBytes: number; to: string};

type Options = {
	url: string;
	to: (contentDisposition: string | null, contentType: string | null) => string;
	onProgress:
		| ((progress: {
				percent: number | null;
				downloaded: number;
				totalSize: number | null;
		  }) => void)
		| undefined;
};

const incorrectContentLengthToken = 'Download finished with';

const downloadFileWithoutRetries = ({onProgress, url, to: toFn}: Options) => {
	return new Promise<Response>((resolve, reject) => {
		let rejected = false;
		let resolved = false;
		let timeout: NodeJS.Timeout | undefined;

		const resolveAndFlag = (val: Response) => {
			resolved = true;
			resolve(val);
			if (timeout) {
				clearTimeout(timeout);
			}
		};

		const rejectAndFlag = (err: Error) => {
			if (timeout) {
				clearTimeout(timeout);
			}

			reject(err);
			rejected = true;
		};

		const refreshTimeout = () => {
			if (timeout) {
				clearTimeout(timeout);
			}

			timeout = setTimeout(() => {
				if (resolved) {
					return;
				}

				rejectAndFlag(
					new Error(
						`Tried to download file ${url}, but the server sent no data for 20 seconds`,
					),
				);
			}, 20000);
		};

		refreshTimeout();

		readFile(url)
			.then((res) => {
				const contentDisposition = res.headers['content-disposition'] ?? null;
				const contentType = res.headers['content-type'] ?? null;
				const to = toFn(contentDisposition, contentType);
				ensureOutputDirectory(to);

				const sizeHeader = res.headers['content-length'];

				const totalSize =
					typeof sizeHeader === 'undefined' ? null : Number(sizeHeader);
				const writeStream = createWriteStream(to);

				let downloaded = 0;
				// Listen to 'close' event instead of more
				// concise method to avoid this problem
				// https://github.com/remotion-dev/remotion/issues/384#issuecomment-844398183
				writeStream.on('close', () => {
					if (rejected) {
						return;
					}

					onProgress?.({
						downloaded,
						percent: 1,
						totalSize: downloaded,
					});
					refreshTimeout();
					return resolveAndFlag({sizeInBytes: downloaded, to});
				});
				writeStream.on('error', (err) => rejectAndFlag(err));
				res.on('error', (err) => rejectAndFlag(err));
				res.pipe(writeStream).on('error', (err) => rejectAndFlag(err));
				res.on('data', (d) => {
					refreshTimeout();
					downloaded += d.length;
					refreshTimeout();
					onProgress?.({
						downloaded,
						percent: totalSize === null ? null : downloaded / totalSize,
						totalSize,
					});
				});
				res.on('close', () => {
					if (totalSize !== null && downloaded !== totalSize) {
						rejectAndFlag(
							new Error(
								`${incorrectContentLengthToken} ${downloaded} bytes, but expected ${totalSize} bytes from 'Content-Length'.`,
							),
						);
					}

					writeStream.close();
				});
			})
			.catch((err) => {
				rejectAndFlag(err);
			});
	});
};

export const downloadFile = async (
	options: Options,
	retries = 2,
	attempt = 1,
): Promise<Response> => {
	try {
		const res = await downloadFileWithoutRetries(options);
		return res;
	} catch (err) {
		const {message} = err as Error;
		if (
			message === 'aborted' ||
			message.includes(incorrectContentLengthToken)
		) {
			if (retries === 0) {
				throw err;
			}

			const backoffInSeconds = (attempt + 1) ** 2;
			await new Promise<void>((resolve) => {
				setTimeout(() => resolve(), backoffInSeconds * 1000);
			});

			return downloadFile(options, retries - 1, attempt + 1);
		}

		throw err;
	}
};
