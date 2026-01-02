import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAEs, createAE, AE, getPrompt, updatePrompt, getEmailLogs, EmailLog, generateEmail } from "./api/client";

function App() {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [promptBody, setPromptBody] = useState("");
  const [promptSaved, setPromptSaved] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: aes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["aes"],
    queryFn: getAEs,
  });

  const createMutation = useMutation({
    mutationFn: createAE,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aes"] });
      setEmail("");
      setFormError(null);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Prompt query and mutation
  const {
    data: prompt,
    isLoading: isPromptLoading,
    isError: isPromptError,
    error: promptError,
  } = useQuery({
    queryKey: ["prompt"],
    queryFn: getPrompt,
  });

  // Sync promptBody with fetched prompt
  useEffect(() => {
    if (prompt) {
      setPromptBody(prompt.body);
    }
  }, [prompt]);

  const promptMutation = useMutation({
    mutationFn: updatePrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt"] });
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    },
  });

  // Email logs query
  const {
    data: emailLogs,
    isLoading: isEmailLogsLoading,
    isError: isEmailLogsError,
    error: emailLogsError,
  } = useQuery({
    queryKey: ["emailLogs"],
    queryFn: getEmailLogs,
  });

  // Generate email mutation
  const [generateMessage, setGenerateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: ({ ae_email, gong_call_id }: { ae_email: string; gong_call_id: string }) =>
      generateEmail(ae_email, gong_call_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailLogs"] });
      setGenerateMessage({ type: "success", text: "Email generated successfully!" });
      setGeneratingFor(null);
      setTimeout(() => setGenerateMessage(null), 3000);
    },
    onError: (err: Error) => {
      const isAlreadyGenerated = err.message.includes("Already generated");
      setGenerateMessage({
        type: "error",
        text: isAlreadyGenerated ? "Already generated for this AE and call" : err.message,
      });
      setGeneratingFor(null);
      setTimeout(() => setGenerateMessage(null), 3000);
    },
  });

  const handleGenerate = (ae_email: string) => {
    setGeneratingFor(ae_email);
    setGenerateMessage(null);
    generateMutation.mutate({ ae_email, gong_call_id: "test_call_001" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError("Email is required");
      return;
    }
    setFormError(null);
    createMutation.mutate(email.trim());
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Gong Call Coaching</h1>

      <section style={{ marginTop: "2rem" }}>
        <h2>AEs</h2>

        {/* Create AE Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="email"
              placeholder="Enter AE email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={createMutation.isPending}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                flex: 1,
                maxWidth: "300px",
              }}
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "1rem",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: createMutation.isPending ? "not-allowed" : "pointer",
                opacity: createMutation.isPending ? 0.6 : 1,
              }}
            >
              {createMutation.isPending ? "Adding..." : "Add AE"}
            </button>
          </div>
          {formError && (
            <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
              {formError}
            </p>
          )}
        </form>

        {/* Loading State */}
        {isLoading && <p>Loading AEs...</p>}

        {/* Error State */}
        {isError && (
          <div style={{ color: "#cc0000", padding: "1rem", backgroundColor: "#fff0f0", borderRadius: "4px" }}>
            <p style={{ margin: 0 }}>
              Error loading AEs: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {/* AE List */}
        {aes && aes.length === 0 && (
          <p style={{ color: "#666" }}>No AEs yet. Add one above!</p>
        )}

        {/* Generate Message */}
        {generateMessage && (
          <div
            style={{
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              borderRadius: "4px",
              backgroundColor: generateMessage.type === "success" ? "#e6f4ea" : "#fff0f0",
              color: generateMessage.type === "success" ? "#1e7e34" : "#cc0000",
            }}
          >
            {generateMessage.text}
          </div>
        )}

        {aes && aes.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Email</th>
                <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Created</th>
                <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {aes.map((ae: AE) => (
                <tr key={ae.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.75rem" }}>{ae.email}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        backgroundColor: ae.enabled ? "#e6f4ea" : "#fce8e6",
                        color: ae.enabled ? "#1e7e34" : "#c5221f",
                      }}
                    >
                      {ae.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem", color: "#666" }}>
                    {new Date(ae.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <button
                      onClick={() => handleGenerate(ae.email)}
                      disabled={generatingFor === ae.email}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        backgroundColor: "#f0f0f0",
                        color: "#333",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        cursor: generatingFor === ae.email ? "not-allowed" : "pointer",
                        opacity: generatingFor === ae.email ? 0.6 : 1,
                      }}
                    >
                      {generatingFor === ae.email ? "Generating..." : "Generate (test)"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Prompt Section */}
      <section style={{ marginTop: "3rem" }}>
        <h2>Prompt</h2>

        {isPromptLoading && <p>Loading prompt...</p>}

        {isPromptError && (
          <div style={{ color: "#cc0000", padding: "1rem", backgroundColor: "#fff0f0", borderRadius: "4px" }}>
            <p style={{ margin: 0 }}>
              Error loading prompt: {promptError instanceof Error ? promptError.message : "Unknown error"}
            </p>
          </div>
        )}

        {!isPromptLoading && !isPromptError && (
          <div>
            <textarea
              value={promptBody}
              onChange={(e) => setPromptBody(e.target.value)}
              disabled={promptMutation.isPending}
              placeholder="Enter your coaching prompt here..."
              style={{
                width: "100%",
                minHeight: "200px",
                padding: "0.75rem",
                fontSize: "1rem",
                fontFamily: "monospace",
                border: "1px solid #ccc",
                borderRadius: "4px",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                onClick={() => promptMutation.mutate(promptBody)}
                disabled={promptMutation.isPending || !promptBody.trim()}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "1rem",
                  backgroundColor: "#0066cc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: promptMutation.isPending || !promptBody.trim() ? "not-allowed" : "pointer",
                  opacity: promptMutation.isPending || !promptBody.trim() ? 0.6 : 1,
                }}
              >
                {promptMutation.isPending ? "Saving..." : "Save Prompt"}
              </button>
              {promptSaved && (
                <span style={{ color: "#1e7e34", fontWeight: 500 }}>
                  Saved!
                </span>
              )}
              {promptMutation.isError && (
                <span style={{ color: "#cc0000" }}>
                  Error: {promptMutation.error instanceof Error ? promptMutation.error.message : "Failed to save"}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Email Logs Section */}
      <section style={{ marginTop: "3rem" }}>
        <h2>Email Logs</h2>

        {isEmailLogsLoading && <p>Loading email logs...</p>}

        {isEmailLogsError && (
          <div style={{ color: "#cc0000", padding: "1rem", backgroundColor: "#fff0f0", borderRadius: "4px" }}>
            <p style={{ margin: 0 }}>
              Error loading email logs: {emailLogsError instanceof Error ? emailLogsError.message : "Unknown error"}
            </p>
          </div>
        )}

        {emailLogs && emailLogs.length === 0 && (
          <p style={{ color: "#666" }}>No email logs yet.</p>
        )}

        {emailLogs && emailLogs.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ddd" }}>
                  <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>AE Email</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Gong Call ID</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log: EmailLog) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.75rem" }}>{log.ae_email}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.875rem" }}>
                      {log.gong_call_id}
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <StatusBadge status={log.status} />
                    </td>
                    <td style={{ padding: "0.75rem", color: "#666" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: EmailLog["status"] }) {
  const styles: Record<EmailLog["status"], { bg: string; color: string }> = {
    sent: { bg: "#e6f4ea", color: "#1e7e34" },
    failed: { bg: "#fce8e6", color: "#c5221f" },
    queued: { bg: "#e8f0fe", color: "#1a73e8" },
    skipped: { bg: "#f5f5f5", color: "#666" },
  };

  const style = styles[status] || styles.queued;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.25rem 0.5rem",
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.color,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

export default App;

