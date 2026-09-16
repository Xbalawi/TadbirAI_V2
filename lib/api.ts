const DEFAULT_API_URL = "";

/**
 * Returns the resolved backend API base URL from env variables or fallback.
 */
export const getAPIUrl = (): string => {
  if (typeof window !== "undefined") {
    // Allows dynamic overriding in local dev storage if needed
    const overridden = window.localStorage.getItem("API_URL");
    if (overridden) return overridden;
  }
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
};

/**
 * Centralized fetch helper for Tadbir AI API calls.
 * Automatically prepends the base API URL and default headers.
 *
 * @param path Endpoint path (e.g. "api/products/")
 * @param options Request options
 */
export const fetchAPI = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const baseUrl = getAPIUrl();
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");
  const url = cleanBase ? `${cleanBase}/${cleanPath}` : `/${cleanPath}`;
  
  const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
  const authHeader: Record<string, string> = {};
  if (token && token !== "demo_access_token" && token !== "session_token") {
    authHeader["Authorization"] = `Bearer ${token}`;
  }

  const orgId = typeof window !== "undefined" ? window.localStorage.getItem("active_organization_id") : null;
  const orgHeader: Record<string, string> = {};
  if (orgId) {
    orgHeader["x-organization-id"] = orgId;
  }
  
  const headers = {
    "Content-Type": "application/json",
    ...authHeader,
    ...orgHeader,
    ...(options.headers || {}),
  };
  
  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });
    return res;
  } catch (error) {
    console.error(`[fetchAPI] Network request failed for ${url}`, error);
    
    // Return safe fallback Response to prevent unhandled React runtime errors, 
    // but clearly indicate that the external backend failed rather than masking it.
    return new Response(
      JSON.stringify({ 
        error: "Network error: Le serveur backend (Django) est injoignable. Vérifiez qu'il est bien démarré ou configuré.", 
        details: error instanceof Error ? error.message : "Unknown error",
        results: [] 
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
