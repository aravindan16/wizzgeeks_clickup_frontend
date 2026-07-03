import { createContext, useContext } from 'react';

// The topbar exposes a DOM node here; pages portal their breadcrumb/title into it
// so page-specific header content appears inside the shared top header.
export const HeaderSlotContext = createContext(null);
export const useHeaderSlot = () => useContext(HeaderSlotContext);
