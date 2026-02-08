const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * Wrapper for fetch that includes credentials for cookie-based auth
 */
const authFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
  return fetch(url, {
    ...options,
    credentials: "include",
  });
};

// Strategy types
export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
}

export interface AE {
  id: string;
  email: string;
  enabled: boolean;
  strategy_id: string;
  created_at: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// Prompt types
export interface Prompt {
  id?: string;
  body: string;
  is_active: boolean;
  strategy_id?: string;
  created_at?: string;
}

// Product and value point types
export interface ValuePoint {
  id?: string;
  product_id?: string;
  listen_for: string;
  insight_text: string;
  sort_order?: number;
  created_at?: string;
}

export interface Product {
  id: string;
  strategy_id: string;
  title: string;
  description: string | null;
  created_at: string;
  value_points: ValuePoint[];
}

// Email Log types
export interface CallContext {
  call_title?: string;
  call_date?: string;
  external_emails?: string[];
  transcript?: string;
}

export type CallType = 
  | "prospect"
  | "existing_customer"
  | "internal"
  | "unknown";

export interface ClassifierDecision {
  should_send: boolean;
  call_type: CallType;
  confidence: number;
  reason: string;
  is_prospect_call: boolean;
}

export interface EmailLog {
  id: string;
  ae_email: string;
  gong_call_id: string;
  status: "sent" | "failed" | "queued" | "skipped" | "generated";
  subject: string | null;
  body: string | null;
  error_message: string | null;
  strategy_id: string;
  context: CallContext | null;
  decision: ClassifierDecision | null;
  skip_reason: string | null;
  is_test: boolean;
  test_run_id: string;
  created_at: string;
}

export interface GenerateResponse {
  skipped?: boolean;
  reason?: string;
  decision?: ClassifierDecision;
  email_log?: EmailLog;
  // If not skipped, the response is the EmailLog itself
  id?: string;
  ae_email?: string;
  gong_call_id?: string;
  status?: string;
  subject?: string | null;
  body?: string | null;
}

// ============ Strategy API ============

export const getStrategies = async (): Promise<Strategy[]> => {
  const response = await authFetch(`${API_BASE_URL}/strategies`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch strategies: ${response.statusText}`);
  }

  return response.json();
};

export const createStrategy = async (name: string): Promise<Strategy> => {
  const response = await authFetch(`${API_BASE_URL}/strategies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to create strategy: ${response.statusText}`);
  }

  return response.json();
};

export const updateStrategy = async (strategyId: string, name: string): Promise<Strategy> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to update strategy: ${response.statusText}`);
  }

  return response.json();
};

export const deleteStrategy = async (strategyId: string): Promise<void> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete strategy: ${response.statusText}`);
  }
};

// ============ Strategy-scoped Products API ============

export const getProductsByStrategy = async (strategyId: string): Promise<Product[]> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/products`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch products: ${response.statusText}`);
  }

  return response.json();
};

export interface CreateProductInput {
  title: string;
  description?: string;
  value_points?: { listen_for: string; insight_text: string }[];
}

export const createProduct = async (
  strategyId: string,
  input: CreateProductInput
): Promise<Product> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    let error: { error?: string } = {};
    try {
      error = text ? JSON.parse(text) : {};
    } catch {
      if (text) error = { error: text };
    }
    const message = error?.error || `Failed to create product: ${response.statusText}`;
    throw new Error(typeof message === "string" ? message : "Failed to create product");
  }

  return response.json();
};

export interface UpdateProductInput {
  title?: string;
  description?: string | null;
  value_points?: { listen_for: string; insight_text: string }[];
}

export const updateProduct = async (
  strategyId: string,
  productId: string,
  input: UpdateProductInput
): Promise<Product> => {
  const response = await authFetch(
    `${API_BASE_URL}/strategies/${strategyId}/products/${productId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to update product: ${response.statusText}`);
  }

  return response.json();
};

export const deleteProduct = async (
  strategyId: string,
  productId: string
): Promise<void> => {
  const response = await authFetch(
    `${API_BASE_URL}/strategies/${strategyId}/products/${productId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete product: ${response.statusText}`);
  }
};

export const toggleStrategy = async (strategyId: string): Promise<Strategy> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/toggle`, {
    method: "PATCH",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to toggle strategy: ${response.statusText}`);
  }

  return response.json();
};

// ============ Strategy-scoped AE API ============

export const getAEsByStrategy = async (strategyId: string): Promise<AE[]> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/aes`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch AEs: ${response.statusText}`);
  }

  return response.json();
};

export const createAEInStrategy = async (strategyId: string, email: string): Promise<AE> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/aes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // Include existing strategy name in error message for 409 conflicts
    if (response.status === 409 && error.existing_strategy_name) {
      throw new Error(`This AE already belongs to "${error.existing_strategy_name}"`);
    }
    throw new Error(error.error || `Failed to create AE: ${response.statusText}`);
  }

  return response.json();
};

export const deleteAEFromStrategy = async (strategyId: string, aeId: string): Promise<void> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/aes/${aeId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete AE: ${response.statusText}`);
  }
};

// ============ Strategy-scoped Prompt API ============

export const getPromptByStrategy = async (strategyId: string): Promise<Prompt> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/prompt`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch prompt: ${response.statusText}`);
  }

  return response.json();
};

export const updatePromptByStrategy = async (strategyId: string, body: string): Promise<Prompt> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/prompt`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to update prompt: ${response.statusText}`);
  }

  return response.json();
};

// ============ Strategy-scoped Email Logs API ============

export const getEmailLogsByStrategy = async (strategyId: string): Promise<EmailLog[]> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/email-logs`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch email logs: ${response.statusText}`);
  }

  return response.json();
};

// ============ Strategy-scoped Generate API ============

export interface GenerateEmailRequest {
  ae_email: string;
  gong_call_id: string;
  call_title?: string;
  call_date?: string;
  external_emails?: string[];
  transcript?: string;
}

export interface TestCallRequest {
  gong_call_id: string;
}

export interface TestCallResponse {
  skipped?: boolean;
  reason?: string;
  decision?: ClassifierDecision;
  ae_email?: string;
  current_strategy_id?: string;
  gong_call_id?: string;
  call_title?: string;
  email_log?: EmailLog;
  // If successful generation, the response is the EmailLog itself
  id?: string;
  status?: string;
  subject?: string | null;
  body?: string | null;
  is_test?: boolean;
}

export const generateEmailByStrategy = async (
  strategyId: string,
  request: GenerateEmailRequest
): Promise<GenerateResponse> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to generate email: ${response.statusText}`);
  }

  return response.json();
};

// ============ Test Call API ============

export const runTestCall = async (
  strategyId: string,
  gongCallId: string
): Promise<TestCallResponse> => {
  const response = await authFetch(`${API_BASE_URL}/strategies/${strategyId}/test-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ gong_call_id: gongCallId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.details || `Failed to run test call: ${response.statusText}`);
  }

  return response.json();
};

// ============ Legacy API (backward compatibility) ============

export const getAEs = async (): Promise<AE[]> => {
  const response = await authFetch(`${API_BASE_URL}/aes`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch AEs: ${response.statusText}`);
  }

  return response.json();
};

export const createAE = async (email: string): Promise<AE> => {
  const response = await authFetch(`${API_BASE_URL}/aes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to create AE: ${response.statusText}`);
  }

  return response.json();
};

export const getPrompt = async (): Promise<Prompt> => {
  const response = await authFetch(`${API_BASE_URL}/prompt`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch prompt: ${response.statusText}`);
  }

  return response.json();
};

export const updatePrompt = async (body: string): Promise<Prompt> => {
  const response = await authFetch(`${API_BASE_URL}/prompt`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to update prompt: ${response.statusText}`);
  }

  return response.json();
};

export const getEmailLogs = async (): Promise<EmailLog[]> => {
  const response = await authFetch(`${API_BASE_URL}/email-logs`, {
    method: "GET",
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch email logs: ${response.statusText}`);
  }
  
  return response.json();
};

export const generateEmail = async (
  ae_email: string,
  gong_call_id: string
): Promise<EmailLog> => {
  const response = await authFetch(`${API_BASE_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ae_email, gong_call_id }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to generate email: ${response.statusText}`);
  }

  return response.json();
};
