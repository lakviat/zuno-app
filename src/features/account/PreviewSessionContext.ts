import { createContext, useContext } from 'react';

// The development-only provider supplies this; production has no preview session.
export const PreviewSessionContext = createContext<{ signOut(): Promise<void> } | null>(null);
export const usePreviewSession = () => useContext(PreviewSessionContext);
