import { auth } from './firebase';

export async function customFetch(url: string, options: RequestInit = {}) {
  try {
    const apiBase = (((import.meta as any).env?.VITE_API_BASE_URL as string) || '').replace(/\/$/, '');
    const resolvedUrl = (apiBase && url.startsWith('/')) ? `${apiBase}${url}` : url;
    const headers = new Headers(options.headers || {});
    
    // Automatically attach verified Firebase ID token if present
    try {
      if (!headers.has('Authorization')) {
        let token = '';
        if (auth?.currentUser && !auth.currentUser.isAnonymous) {
          const fresh = await auth.currentUser.getIdToken(false);
          if (fresh && fresh.split('.').length === 3) {
            token = fresh;
            localStorage.setItem('bse_nexus_fb_id_token', token);
          }
        }
        if (!token) {
          const stored = localStorage.getItem('bse_nexus_fb_id_token') || '';
          if (stored && stored.split('.').length === 3) {
            token = stored;
          } else if (stored) {
            localStorage.removeItem('bse_nexus_fb_id_token');
          }
        }
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch {}

    let res = await fetch(resolvedUrl, {
      credentials: 'include',
      ...options,
      headers
    });

    // If 401 received and user is logged into Firebase, attempt force-refresh and transparent retry
    if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/verify-pin') && !url.includes('/auth/status') && !url.includes('/auth/session')) {
      if (auth?.currentUser && !auth.currentUser.isAnonymous) {
        try {
          const freshToken = await auth.currentUser.getIdToken(true);
          if (freshToken && freshToken.split('.').length === 3) {
            localStorage.setItem('bse_nexus_fb_id_token', freshToken);
            headers.set('Authorization', `Bearer ${freshToken}`);
            res = await fetch(resolvedUrl, {
              credentials: 'include',
              ...options,
              headers
            });
          }
        } catch (refreshErr) {
          console.warn('Firebase token force-refresh failed:', refreshErr);
        }
      }

      if (res.status === 401) {
        window.dispatchEvent(new Event('auth-expired'));
      }
    }

    if (res.ok) {
      window.dispatchEvent(new CustomEvent('network-status', { detail: { isOnline: true } }));
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html") && !contentType.includes("application/json")) {
      // If server returned pure HTML for an API request, wrap it as a JSON error response
      return new Response(JSON.stringify({ success: false, error: `Server returned non-JSON response (${res.status})`, items: [] }), {
        status: res.status || 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return res;
  } catch (error: any) {
    // Notify frontend of network disruption
    window.dispatchEvent(new CustomEvent('network-status', { detail: { isOnline: false, error: error.message || 'Connection lost' } }));

    // Return a 503 response so callers can handle gracefully
    return new Response(JSON.stringify({ success: false, error: error.message || "Failed to fetch", items: [] }), {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "application/json" }
    });
  }
}


