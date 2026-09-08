import { create } from 'zustand';

type AddressBookState = {
  revision: number;
  markChanged: () => void;
};

// In-memory only. Mounted address consumers reload the authoritative API data
// after a change instead of keeping a second cached copy of the address book.
export const useAddressBookStore = create<AddressBookState>()((set) => ({
  revision: 0,
  markChanged: () => set((state) => ({ revision: state.revision + 1 })),
}));
