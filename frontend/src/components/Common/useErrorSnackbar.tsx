import React, { useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

// FIX: create/update mutations across Orders, Schedule, Payments, Expenses
// and Clients had no onError handler at all. When the API rejected a
// request (missing required field, validation error, etc.) the dialog
// just sat there with zero feedback - indistinguishable from the app
// being broken/frozen ("the table disappears and doesn't save"). This
// hook gives every page a one-line way to surface the *actual* DRF
// validation message instead of failing silently.
function extractMessage(err: any): string {
  const data = err?.response?.data;
  if (!data) {
    // No response at all (vs. a 400/500 WITH a body) usually means the
    // local backend itself is unreachable - the persistent connection
    // banner (see ConnectionBanner.tsx) already explains that clearly,
    // so this just points there instead of the vague generic fallback.
    if (err?.request && !err?.response) {
      return "Can't reach the local server right now - see the banner at the top of the screen.";
    }
    return err?.message || 'Something went wrong. Please try again.';
  }
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  if (data.error) return String(data.error);
  // DRF validation errors look like { field: ["msg", ...], ... }
  try {
    const parts = Object.entries(data).map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
      return field === 'non_field_errors' ? text : `${field}: ${text}`;
    });
    if (parts.length) return parts.join(' | ');
  } catch {
    // fall through
  }
  return 'Something went wrong. Please try again.';
}

export function useErrorSnackbar() {
  const [state, setState] = useState<{ open: boolean; message: string; severity: 'error' | 'success' }>({
    open: false, message: '', severity: 'error',
  });

  const showError = useCallback((err: any) => {
    setState({ open: true, message: extractMessage(err), severity: 'error' });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setState({ open: true, message, severity: 'success' });
  }, []);

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const SnackbarElement = (
    <Snackbar open={state.open} autoHideDuration={6000} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity={state.severity} onClose={close} sx={{ width: '100%' }}>
        {state.message}
      </Alert>
    </Snackbar>
  );

  return { showError, showSuccess, SnackbarElement };
}
