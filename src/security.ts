export const PATH_TOKEN_BYTES = 32;
export const PATH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,}$/;

export function generatePathToken(byteLength = PATH_TOKEN_BYTES): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);

	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
