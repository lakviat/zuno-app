/** Replace at the composition root when real authentication is introduced. */
export interface AuthService {
  currentUserId(): Promise<string | null>;
  signOut(): Promise<void>;
}
export const demoAuth: AuthService = {
  currentUserId: async () => 'me',
  signOut: async () => undefined,
};
