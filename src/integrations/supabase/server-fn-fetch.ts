// Attach the current Supabase access token to all TanStack server-fn requests.
// Without this, createServerFn calls hit the server without an Authorization
// header and any handler protected by requireSupabaseAuth returns 401.
import { supabase } from "./client";

if (typeof window !== "undefined" && !(window as unknown as { __serverFnFetchPatched?: boolean }).__serverFnFetchPatched) {
  (window as unknown as { __serverFnFetchPatched?: boolean }).__serverFnFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url && url.includes("/_serverFn/")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
          return originalFetch(input, { ...init, headers });
        }
      }
    } catch (e) {
      console.error("[server-fn-fetch] failed to attach auth", e);
    }
    return originalFetch(input, init);
  };
}
