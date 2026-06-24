import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from './authApi';
import { setAccessToken } from '../../services/apiClient';

/**
 * Auth state. The access token lives in apiClient memory (not Redux/localStorage);
 * the refresh token is an httpOnly cookie the browser handles automatically.
 * `status` drives the initial bootstrap gate so protected routes don't flash.
 */
const initialState = {
  user: null,
  status: 'idle', // idle | bootstrapping | authenticated | unauthenticated
  error: null,
};

export const bootstrap = createAsyncThunk('auth/bootstrap', async (_, { rejectWithValue }) => {
  // On app load there is no access token in memory. Try a silent refresh using
  // the httpOnly cookie; if it works, fetch the current user.
  try {
    const data = await authApi.refresh();
    setAccessToken(data.access_token);
    const user = await authApi.me();
    return user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Not authenticated');
  }
});

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await authApi.login(email, password);
      setAccessToken(data.access_token);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Login failed');
    }
  },
);

export const googleLogin = createAsyncThunk(
  'auth/google',
  async (credential, { rejectWithValue }) => {
    try {
      const data = await authApi.google(credential);
      setAccessToken(data.access_token);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Google sign-in failed');
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } finally {
    setAccessToken(null);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(bootstrap.pending, (s) => {
        s.status = 'bootstrapping';
      })
      .addCase(bootstrap.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
      })
      .addCase(bootstrap.rejected, (s) => {
        s.user = null;
        s.status = 'unauthenticated';
      })
      .addCase(login.pending, (s) => {
        s.error = null;
      })
      .addCase(login.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
        s.error = null;
      })
      .addCase(login.rejected, (s, a) => {
        s.error = a.payload;
        s.status = 'unauthenticated';
      })
      .addCase(googleLogin.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
        s.error = null;
      })
      .addCase(googleLogin.rejected, (s, a) => {
        s.error = a.payload;
        s.status = 'unauthenticated';
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
        s.status = 'unauthenticated';
      });
  },
});

export default authSlice.reducer;
