import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStrategies,
  createStrategy,
  Strategy,
  getAEsByStrategy,
  createAEInStrategy,
  deleteAEFromStrategy,
  AE,
  getPromptByStrategy,
  updatePromptByStrategy,
  getEmailLogsByStrategy,
  EmailLog,
  generateEmailByStrategy,
  GenerateEmailRequest,
} from "./api/client";

function App() {
  const queryClient = useQueryClient();

  // Strategy state
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [newStrategyName, setNewStrategyName] = useState("");
  const [showNewStrategyForm, setShowNewStrategyForm] = useState(false);

  // AE form state
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showAllAEs, setShowAllAEs] = useState(false);
  const [showAllEmailLogs, setShowAllEmailLogs] = useState(false);
  const DISPLAY_LIMIT = 5;

  // Prompt state
  const [promptBody, setPromptBody] = useState("");
  const [promptSaved, setPromptSaved] = useState(false);

  // Strategies query
  const {
    data: strategies,
    isLoading: isStrategiesLoading,
    isError: isStrategiesError,
    error: strategiesError,
  } = useQuery({
    queryKey: ["strategies"],
    queryFn: getStrategies,
  });

  // Auto-select first strategy when strategies load
  useEffect(() => {
    if (strategies && strategies.length > 0 && !selectedStrategyId) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [strategies, selectedStrategyId]);

  // Reset overflow states when strategy changes
  useEffect(() => {
    setShowAllAEs(false);
    setShowAllEmailLogs(false);
  }, [selectedStrategyId]);

  // Create strategy mutation
  const createStrategyMutation = useMutation({
    mutationFn: createStrategy,
    onSuccess: (newStrategy) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      setSelectedStrategyId(newStrategy.id);
      setNewStrategyName("");
      setShowNewStrategyForm(false);
    },
  });

  // AEs query (strategy-scoped)
  const {
    data: aes,
    isLoading: isAEsLoading,
    isError: isAEsError,
    error: aesError,
  } = useQuery({
    queryKey: ["aes", selectedStrategyId],
    queryFn: () => getAEsByStrategy(selectedStrategyId!),
    enabled: !!selectedStrategyId,
  });

  // Create AE mutation (strategy-scoped)
  const createAEMutation = useMutation({
    mutationFn: ({ strategyId, email }: { strategyId: string; email: string }) =>
      createAEInStrategy(strategyId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aes", selectedStrategyId] });
      setEmail("");
      setFormError(null);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Delete AE mutation (strategy-scoped)
  const [deletingAeId, setDeletingAeId] = useState<string | null>(null);
  const deleteAEMutation = useMutation({
    mutationFn: ({ strategyId, aeId }: { strategyId: string; aeId: string }) =>
      deleteAEFromStrategy(strategyId, aeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aes", selectedStrategyId] });
      setDeletingAeId(null);
    },
    onError: () => {
      setDeletingAeId(null);
    },
  });

  const handleDeleteAE = (aeId: string) => {
    if (!selectedStrategyId) return;
    if (!confirm("Are you sure you want to delete this AE?")) return;
    setDeletingAeId(aeId);
    deleteAEMutation.mutate({ strategyId: selectedStrategyId, aeId });
  };

  // Prompt query (strategy-scoped)
  const {
    data: prompt,
    isLoading: isPromptLoading,
    isError: isPromptError,
    error: promptError,
  } = useQuery({
    queryKey: ["prompt", selectedStrategyId],
    queryFn: () => getPromptByStrategy(selectedStrategyId!),
    enabled: !!selectedStrategyId,
  });

  // Sync promptBody with fetched prompt
  useEffect(() => {
    if (prompt) {
      setPromptBody(prompt.body);
    }
  }, [prompt]);

  // Prompt mutation (strategy-scoped)
  const promptMutation = useMutation({
    mutationFn: ({ strategyId, body }: { strategyId: string; body: string }) =>
      updatePromptByStrategy(strategyId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt", selectedStrategyId] });
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    },
  });

  // Email logs query (strategy-scoped)
  const {
    data: emailLogs,
    isLoading: isEmailLogsLoading,
    isError: isEmailLogsError,
    error: emailLogsError,
  } = useQuery({
    queryKey: ["emailLogs", selectedStrategyId],
    queryFn: () => getEmailLogsByStrategy(selectedStrategyId!),
    enabled: !!selectedStrategyId,
  });

  // Email log detail modal state
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedLog(null);
      }
    };
    if (selectedLog) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [selectedLog]);

  // Generate email mutation (strategy-scoped)
  const [generateMessage, setGenerateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generateModalAE, setGenerateModalAE] = useState<string | null>(null);
  const [generateCallId, setGenerateCallId] = useState("");
  const [generateCallTitle, setGenerateCallTitle] = useState("");

  const generateMutation = useMutation({
    mutationFn: ({
      strategyId,
      request,
    }: {
      strategyId: string;
      request: GenerateEmailRequest;
    }) => generateEmailByStrategy(strategyId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailLogs", selectedStrategyId] });
      setGenerateMessage({ type: "success", text: "Email generated successfully!" });
      setGeneratingFor(null);
      setGenerateModalAE(null);
      setGenerateCallId("");
      setGenerateCallTitle("");
      setTimeout(() => setGenerateMessage(null), 3000);
    },
    onError: (err: Error) => {
      const isAlreadyGenerated = err.message.includes("Already generated");
      setGenerateMessage({
        type: "error",
        text: isAlreadyGenerated ? "Already generated for this call" : err.message,
      });
      setGeneratingFor(null);
      setTimeout(() => setGenerateMessage(null), 3000);
    },
  });

  const handleOpenGenerateModal = (ae_email: string) => {
    setGenerateModalAE(ae_email);
    setGenerateCallId("");
    setGenerateCallTitle("");
  };

  const handleSubmitGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStrategyId || !generateModalAE || !generateCallId.trim()) return;
    setGeneratingFor(generateModalAE);
    setGenerateMessage(null);
    generateMutation.mutate({
      strategyId: selectedStrategyId,
      request: {
        ae_email: generateModalAE,
        gong_call_id: generateCallId.trim(),
        call_title: generateCallTitle.trim() || undefined,
      },
    });
  };

  const handleSubmitAE = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError("Email is required");
      return;
    }
    if (!selectedStrategyId) {
      setFormError("Please select a strategy first");
      return;
    }
    setFormError(null);
    createAEMutation.mutate({ strategyId: selectedStrategyId, email: email.trim() });
  };

  const handleSubmitStrategy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrategyName.trim()) return;
    createStrategyMutation.mutate(newStrategyName.trim());
  };

  // Get selected strategy name
  const selectedStrategy = strategies?.find((s) => s.id === selectedStrategyId);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Gong Call Coaching</h1>

      {/* Strategy Selector Section */}
      <section
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Strategy</h2>
          {!showNewStrategyForm && (
            <button
              onClick={() => setShowNewStrategyForm(true)}
              style={{
                padding: "0.375rem 0.75rem",
                fontSize: "0.875rem",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              + New Strategy
            </button>
          )}
        </div>

        {isStrategiesLoading && <p>Loading strategies...</p>}

        {isStrategiesError && (
          <div style={{ color: "#cc0000", padding: "1rem", backgroundColor: "#fff0f0", borderRadius: "4px" }}>
            <p style={{ margin: 0 }}>
              Error loading strategies: {strategiesError instanceof Error ? strategiesError.message : "Unknown error"}
            </p>
          </div>
        )}

        {showNewStrategyForm && (
          <form onSubmit={handleSubmitStrategy} style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Strategy name"
                value={newStrategyName}
                onChange={(e) => setNewStrategyName(e.target.value)}
                disabled={createStrategyMutation.isPending}
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  flex: 1,
                  maxWidth: "300px",
                }}
                autoFocus
              />
              <button
                type="submit"
                disabled={createStrategyMutation.isPending || !newStrategyName.trim()}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "1rem",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: createStrategyMutation.isPending ? "not-allowed" : "pointer",
                  opacity: createStrategyMutation.isPending || !newStrategyName.trim() ? 0.6 : 1,
                }}
              >
                {createStrategyMutation.isPending ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewStrategyForm(false);
                  setNewStrategyName("");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "1rem",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            {createStrategyMutation.isError && (
              <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
                {createStrategyMutation.error instanceof Error
                  ? createStrategyMutation.error.message
                  : "Failed to create strategy"}
              </p>
            )}
          </form>
        )}

        {strategies && strategies.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {strategies.map((strategy: Strategy) => (
              <button
                key={strategy.id}
                onClick={() => setSelectedStrategyId(strategy.id)}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  backgroundColor: selectedStrategyId === strategy.id ? "#0066cc" : "#fff",
                  color: selectedStrategyId === strategy.id ? "#fff" : "#333",
                  border: `2px solid ${selectedStrategyId === strategy.id ? "#0066cc" : "#ccc"}`,
                  borderRadius: "20px",
                  cursor: "pointer",
                  fontWeight: selectedStrategyId === strategy.id ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                {strategy.name}
              </button>
            ))}
          </div>
        )}

        {strategies && strategies.length === 0 && (
          <p style={{ color: "#666" }}>No strategies yet. Create one to get started!</p>
        )}
      </section>

      {/* Only show rest of UI if a strategy is selected */}
      {selectedStrategyId && (
        <>
          <section style={{ marginTop: "2rem" }}>
            <h2>AEs {selectedStrategy && <span style={{ fontWeight: 400, color: "#666" }}>({selectedStrategy.name})</span>}</h2>

            {/* Create AE Form */}
            <form onSubmit={handleSubmitAE} style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="email"
                  placeholder="Enter AE email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={createAEMutation.isPending}
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
                  disabled={createAEMutation.isPending}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "1rem",
                    backgroundColor: "#0066cc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: createAEMutation.isPending ? "not-allowed" : "pointer",
                    opacity: createAEMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {createAEMutation.isPending ? "Adding..." : "Add AE"}
                </button>
              </div>
              {formError && (
                <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
                  {formError}
                </p>
              )}
            </form>

            {/* Loading State */}
            {isAEsLoading && <p>Loading AEs...</p>}

            {/* Error State */}
            {isAEsError && (
              <div style={{ color: "#cc0000", padding: "1rem", backgroundColor: "#fff0f0", borderRadius: "4px" }}>
                <p style={{ margin: 0 }}>
                  Error loading AEs: {aesError instanceof Error ? aesError.message : "Unknown error"}
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
              <>
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
                    {(showAllAEs ? aes : aes.slice(0, DISPLAY_LIMIT)).map((ae: AE) => (
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
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => handleOpenGenerateModal(ae.email)}
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
                            <button
                              onClick={() => handleDeleteAE(ae.id)}
                              disabled={deletingAeId === ae.id}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                backgroundColor: "#fce8e6",
                                color: "#c5221f",
                                border: "1px solid #f5c6cb",
                                borderRadius: "4px",
                                cursor: deletingAeId === ae.id ? "not-allowed" : "pointer",
                                opacity: deletingAeId === ae.id ? 0.6 : 1,
                              }}
                            >
                              {deletingAeId === ae.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {aes.length > DISPLAY_LIMIT && (
                  <button
                    onClick={() => setShowAllAEs(!showAllAEs)}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      backgroundColor: "transparent",
                      color: "#0066cc",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {showAllAEs ? "Show less" : `See ${aes.length - DISPLAY_LIMIT} more`}
                  </button>
                )}
              </>
            )}
          </section>

          {/* Prompt Section */}
          <section style={{ marginTop: "3rem" }}>
            <h2>Prompt {selectedStrategy && <span style={{ fontWeight: 400, color: "#666" }}>({selectedStrategy.name})</span>}</h2>

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
                    onClick={() =>
                      promptMutation.mutate({ strategyId: selectedStrategyId, body: promptBody })
                    }
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
            <h2>Email Logs {selectedStrategy && <span style={{ fontWeight: 400, color: "#666" }}>({selectedStrategy.name})</span>}</h2>

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
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #ddd" }}>
                        <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>AE Email</th>
                        <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Gong Call ID</th>
                        <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Status</th>
                        <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Created At</th>
                        <th style={{ textAlign: "left", padding: "0.75rem", color: "#333" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllEmailLogs ? emailLogs : emailLogs.slice(0, DISPLAY_LIMIT)).map((log: EmailLog) => (
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
                          <td style={{ padding: "0.75rem" }}>
                            <button
                              onClick={() => setSelectedLog(log)}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                backgroundColor: "#f0f0f0",
                                color: "#333",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {emailLogs.length > DISPLAY_LIMIT && (
                  <button
                    onClick={() => setShowAllEmailLogs(!showAllEmailLogs)}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      backgroundColor: "transparent",
                      color: "#0066cc",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {showAllEmailLogs ? "Show less" : `See ${emailLogs.length - DISPLAY_LIMIT} more`}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* Email Log Detail Modal */}
      {selectedLog && (
        <EmailLogModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      {/* Generate Email Modal */}
      {generateModalAE && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setGenerateModalAE(null);
              setGenerateCallId("");
              setGenerateCallTitle("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "1.5rem",
              maxWidth: "450px",
              width: "90%",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem" }}>Generate Email</h3>
              <button
                onClick={() => {
                  setGenerateModalAE(null);
                  setGenerateCallId("");
                  setGenerateCallTitle("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#666",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitGenerate}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                  AE Email
                </label>
                <p style={{ margin: 0, color: "#666" }}>{generateModalAE}</p>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                  Gong Call ID <span style={{ color: "#cc0000" }}>*</span>
                </label>
                <input
                  type="text"
                  value={generateCallId}
                  onChange={(e) => setGenerateCallId(e.target.value)}
                  placeholder="e.g., 1234567890"
                  disabled={generateMutation.isPending}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    fontSize: "1rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                  Call Title <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={generateCallTitle}
                  onChange={(e) => setGenerateCallTitle(e.target.value)}
                  placeholder="e.g., Discovery Call with Acme Corp"
                  disabled={generateMutation.isPending}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    fontSize: "1rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setGenerateModalAE(null);
                    setGenerateCallId("");
                    setGenerateCallTitle("");
                  }}
                  disabled={generateMutation.isPending}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "1rem",
                    backgroundColor: "#f0f0f0",
                    color: "#333",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateMutation.isPending || !generateCallId.trim()}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "1rem",
                    backgroundColor: "#0066cc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: generateMutation.isPending || !generateCallId.trim() ? "not-allowed" : "pointer",
                    opacity: generateMutation.isPending || !generateCallId.trim() ? 0.6 : 1,
                  }}
                >
                  {generateMutation.isPending ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

function EmailLogModal({ log, onClose }: { log: EmailLog; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<"subject" | "body" | null>(null);
  const [showContext, setShowContext] = useState(false);

  const handleCopy = async (text: string, field: "subject" | "body") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const displayValue = (value: string | null | undefined) => {
    return value && value.trim() ? value : "(empty)";
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "1.5rem",
          maxWidth: "700px",
          width: "90%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem" }}>Email Details</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#666",
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase", fontWeight: 600 }}>
              Subject
            </label>
            <button
              onClick={() => handleCopy(log.subject || "", "subject")}
              disabled={!log.subject}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.7rem",
                backgroundColor: copiedField === "subject" ? "#e6f4ea" : "#f0f0f0",
                color: copiedField === "subject" ? "#1e7e34" : "#333",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: log.subject ? "pointer" : "not-allowed",
                opacity: log.subject ? 1 : 0.5,
              }}
            >
              {copiedField === "subject" ? "Copied!" : "Copy"}
            </button>
          </div>
          <p
            style={{
              margin: 0,
              padding: "0.5rem",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              color: log.subject ? "#333" : "#999",
            }}
          >
            {displayValue(log.subject)}
          </p>
        </div>

        {/* Body */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase", fontWeight: 600 }}>
              Body
            </label>
            <button
              onClick={() => handleCopy(log.body || "", "body")}
              disabled={!log.body}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.7rem",
                backgroundColor: copiedField === "body" ? "#e6f4ea" : "#f0f0f0",
                color: copiedField === "body" ? "#1e7e34" : "#333",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: log.body ? "pointer" : "not-allowed",
                opacity: log.body ? 1 : 0.5,
              }}
            >
              {copiedField === "body" ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "0.75rem",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              maxHeight: "400px",
              overflow: "auto",
              color: log.body ? "#333" : "#999",
            }}
          >
            {displayValue(log.body)}
          </pre>
        </div>

        {/* Context (collapsible) */}
        {log.context && Object.keys(log.context).length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <button
              onClick={() => setShowContext(!showContext)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0",
                fontSize: "0.875rem",
                color: "#0066cc",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <span style={{ transform: showContext ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                ▶
              </span>
              Call Context
            </button>
            {showContext && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                }}
              >
                {log.context.call_title && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong>Call Title:</strong> {log.context.call_title}
                  </div>
                )}
                {log.context.call_date && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong>Call Date:</strong> {log.context.call_date}
                  </div>
                )}
                {log.context.external_emails && log.context.external_emails.length > 0 && (
                  <div>
                    <strong>External Emails:</strong> {log.context.external_emails.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1.5rem",
              fontSize: "1rem",
              backgroundColor: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
