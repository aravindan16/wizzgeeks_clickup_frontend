import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';

/**
 * Root Redux store. Feature slices register their reducers here as modules are built.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
