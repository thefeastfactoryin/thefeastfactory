'use client';
import type { AdminSession } from '@aranyam/shared-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
type State = {
  session?: AdminSession;
  hasHydrated: boolean;
  setSession: (session: AdminSession) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
};
export const useAdminSessionStore = create<State>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setSession: (session) => set({ session }),
      clear: () => set({ session: undefined }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'aranyam-admin-session',
      partialize: (state) => ({ session: state.session }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
