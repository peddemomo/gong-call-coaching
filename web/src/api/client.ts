const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export interface AE {
  id: number;
  email: string;
  enabled: boolean;
  created_at: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

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

// Prompt types and API functions
export interface Prompt {
  id?: number;
  body: string;
  is_active: boolean;
  created_at?: string;
}

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

// Email Log types and API functions
export interface EmailLog {
  id: number;
  ae_email: string;
  gong_call_id: string;
  status: "sent" | "failed" | "queued" | "skipped";
  subject: string;
  body: string;
  error_message: string | null;
  created_at: string;
}

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

// Generate email function
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

