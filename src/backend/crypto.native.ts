import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

// Supabase's PKCE implementation must use native secure randomness and S256 on iOS.
// Its fallback without Web Crypto uses a plain challenge, which we never rely on.
const nativeCrypto = globalThis.crypto ?? {};
if (!nativeCrypto.getRandomValues)
  Object.defineProperty(nativeCrypto, 'getRandomValues', { value: getRandomValues });
if (!nativeCrypto.subtle) {
  Object.defineProperty(nativeCrypto, 'subtle', {
    value: {
      digest: (algorithm: string, data: BufferSource) => {
        if (algorithm !== 'SHA-256') throw new Error('Unsupported PKCE digest');
        return digest(CryptoDigestAlgorithm.SHA256, data);
      },
    },
  });
}
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: nativeCrypto });
