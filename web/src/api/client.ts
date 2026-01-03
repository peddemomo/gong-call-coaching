const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Strategy types
export interface Strategy {
  id: string;
  name: string;
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

// Email Log types
export interface EmailLog {
  id: string;
  ae_email: string;
  gong_call_id: string;
  status: "sent" | "failed" | "queued" | "skipped";
  subject: string;
  body: string;
  error_message: string | null;
  strategy_id: string;
  created_at: string;
}

// ============ Strategy API ============

export const getStrategies = async (): Promise<Strategy[]> => {
  const response = await fetch(`${API_BASE_URL}/strategies`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch strategies: ${response.statusText}`);
  }

  return response.json();
};

export const createStrategy = async (name: string): Promise<Strategy> => {
  const response = await fetch(`${API_BASE_URL}/strategies`, {
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

// ============ Strategy-scoped AE API ============

export const getAEsByStrategy = async (strategyId: string): Promise<AE[]> => {
  const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}/aes`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch AEs: ${response.statusText}`);
  }

  return response.json();
};

export const createAEInStrategy = async (strategyId: string, email: string): Promise<AE> => {
  const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}/aes`, {
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

// ============ Strategy-scoped Prompt API ============

export const getPromptByStrategy = async (strategyId: string): Promise<Prompt> => {
  const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}/prompt`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch prompt: ${response.statusText}`);
  }

  return response.json();
};

export const updatePromptByStrategy = async (strategyId: string, body: string): Promise<Prompt> => {
  const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}/prompt`, {
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
  const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}/email-logs`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch email logs: ${response.statusText}`);
  }

  return response.json();
};

// ============ Strategy-scoped Generate API ============

export const generateEmailByStrategy = async (
  strategyId: string,
  ae_email: string,
  gong_call_id: string
): Promise<EmailLog> => {
  const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}/generate`, {
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

// ============ Legacy API (backward compatibility) ============

export const getAEs = async (): Promise<AE[]> => {
  const response = await fetch(`${API_BASE_URL}/aes`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch AEs: ${response.statusText}`);
  }

  return response.json();
};

export const createAE = async (email: string): Promise<AE> => {
  const response = await fetch(`${API_BASE_URL}/aes`, {
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
  const response = await fetch(`${API_BASE_URL}/prompt`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch prompt: ${response.statusText}`);
  }

  return response.json();
};

export const updatePrompt = async (body: string): Promise<Prompt> => {
  const response = await fetch(`${API_BASE_URL}/prompt`, {
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
  const response = await fetch(`${API_BASE_URL}/email-logs`, {
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
  const response = await fetch(`${API_BASE_URL}/generate`, {
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
