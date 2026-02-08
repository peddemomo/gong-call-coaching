import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  toggleStrategy,
  Strategy,
  getAEsByStrategy,
  createAEInStrategy,
  deleteAEFromStrategy,
  AE,
  getProductsByStrategy,
  createProduct,
  updateProduct,
  deleteProduct,
  Product,
  getEmailLogsByStrategy,
  EmailLog,
  runTestCall,
  TestCallResponse,
} from "./api/client";

function AppContent() {
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

  // Products state
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductValuePoints, setNewProductValuePoints] = useState<{ listen_for: string; insight_text: string; link: string }[]>([{ listen_for: "", insight_text: "", link: "" }]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductTitle, setEditingProductTitle] = useState("");
  const [editingProductDescription, setEditingProductDescription] = useState("");
  const [editingProductValuePoints, setEditingProductValuePoints] = useState<{ listen_for: string; insight_text: string; link: string }[]>([]);
  const [showAllProducts, setShowAllProducts] = useState(false);

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
    setShowAllProducts(false);
    setShowNewProductForm(false);
    setEditingProductId(null);
  }, [selectedStrategyId]);

  // Editing strategy state
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [editingStrategyName, setEditingStrategyName] = useState("");

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

  // Update strategy mutation
  const updateStrategyMutation = useMutation({
    mutationFn: ({ strategyId, name }: { strategyId: string; name: string }) =>
      updateStrategy(strategyId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      setEditingStrategyId(null);
      setEditingStrategyName("");
    },
  });

  // Delete strategy mutation
  const deleteStrategyMutation = useMutation({
    mutationFn: deleteStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      if (selectedStrategyId === editingStrategyId) {
        setSelectedStrategyId(null);
      }
    },
  });

  // Toggle strategy enabled mutation
  const toggleStrategyMutation = useMutation({
    mutationFn: toggleStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });

  const handleEditStrategy = (strategy: Strategy) => {
    setEditingStrategyId(strategy.id);
    setEditingStrategyName(strategy.name);
  };

  const handleSaveStrategyName = () => {
    if (!editingStrategyId || !editingStrategyName.trim()) return;
    updateStrategyMutation.mutate({ strategyId: editingStrategyId, name: editingStrategyName.trim() });
  };

  const handleDeleteStrategy = (strategyId: string) => {
    if (!confirm("Are you sure you want to delete this strategy? You must remove all recipients first.")) return;
    deleteStrategyMutation.mutate(strategyId);
  };

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
    if (!confirm("Are you sure you want to delete this recipient?")) return;
    setDeletingAeId(aeId);
    deleteAEMutation.mutate({ strategyId: selectedStrategyId, aeId });
  };

  // Products query (strategy-scoped)
  const {
    data: products,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productsError,
  } = useQuery({
    queryKey: ["products", selectedStrategyId],
    queryFn: () => getProductsByStrategy(selectedStrategyId!),
    enabled: !!selectedStrategyId,
  });

  // Prompt query (strategy-scoped)
  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: ({
      strategyId,
      title,
      description,
      value_points,
    }: {
      strategyId: string;
      title: string;
      description?: string;
      value_points: { listen_for: string; insight_text: string; link?: string }[];
    }) =>
      createProduct(strategyId, {
        title,
        description: description || undefined,
        value_points: value_points.filter(
          (vp) => vp.listen_for.trim().length > 0 && vp.insight_text.trim().length > 0
        ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", selectedStrategyId] });
      setShowNewProductForm(false);
      setNewProductTitle("");
      setNewProductDescription("");
      setNewProductValuePoints([{ listen_for: "", insight_text: "", link: "" }]);
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: ({
      strategyId,
      productId,
      title,
      description,
      value_points,
    }: {
      strategyId: string;
      productId: string;
      title?: string;
      description?: string | null;
      value_points?: { listen_for: string; insight_text: string; link?: string }[];
    }) =>
      updateProduct(strategyId, productId, {
        title,
        description,
        value_points,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", selectedStrategyId] });
      setEditingProductId(null);
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: ({ strategyId, productId }: { strategyId: string; productId: string }) =>
      deleteProduct(strategyId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", selectedStrategyId] });
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

  // Test Call state
  const [testCallId, setTestCallId] = useState("");
  const [testCallMessage, setTestCallMessage] = useState<{ type: "success" | "error" | "skipped"; text: string; details?: string } | null>(null);

  // Test Call mutation
  const testCallMutation = useMutation({
    mutationFn: ({ strategyId, gongCallId }: { strategyId: string; gongCallId: string }) =>
      runTestCall(strategyId, gongCallId),
    onSuccess: (response: TestCallResponse) => {
      queryClient.invalidateQueries({ queryKey: ["emailLogs", selectedStrategyId] });
      if (response.skipped) {
        setTestCallMessage({
          type: "skipped",
          text: `Skipped: ${response.reason}`,
          details: response.ae_email ? `AE: ${response.ae_email}` : undefined,
        });
      } else {
        setTestCallMessage({
          type: "success",
          text: "Test call completed! Email generated (not sent).",
          details: response.ae_email ? `AE: ${response.ae_email}` : undefined,
        });
      }
      setTestCallId("");
      // Message persists until manually dismissed
    },
    onError: (err: Error) => {
      setTestCallMessage({
        type: "error",
        text: err.message,
      });
      // Message persists until manually dismissed
    },
  });

  const handleTestCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStrategyId || !testCallId.trim()) return;
    setTestCallMessage(null);
    testCallMutation.mutate({ strategyId: selectedStrategyId, gongCallId: testCallId.trim() });
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

  const handleStartEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setEditingProductTitle(product.title);
    setEditingProductDescription(product.description || "");
    setEditingProductValuePoints(
      product.value_points.length > 0
        ? product.value_points.map((vp) => ({ listen_for: vp.listen_for, insight_text: vp.insight_text, link: vp.link || "" }))
        : [{ listen_for: "", insight_text: "", link: "" }]
    );
  };

  const handleSaveProduct = () => {
    if (!selectedStrategyId || !editingProductId) return;
    const valuePoints = editingProductValuePoints.filter((vp) => vp.listen_for.trim() || vp.insight_text.trim());
    updateProductMutation.mutate({
      strategyId: selectedStrategyId,
      productId: editingProductId,
      title: editingProductTitle.trim(),
      description: editingProductDescription.trim() || null,
      value_points: valuePoints.length > 0 ? valuePoints : [],
    });
  };

  const handleSubmitNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStrategyId || !newProductTitle.trim()) return;
    const valuePoints = newProductValuePoints.filter(
      (vp) => vp.listen_for.trim().length > 0 && vp.insight_text.trim().length > 0
    );
    createProductMutation.mutate({
      strategyId: selectedStrategyId,
      title: newProductTitle.trim(),
      description: newProductDescription.trim() || undefined,
      value_points: valuePoints,
    });
  };

  const handleDeleteProduct = (productId: string) => {
    if (!selectedStrategyId) return;
    if (!confirm("Are you sure you want to delete this product and its value points?")) return;
    deleteProductMutation.mutate({ strategyId: selectedStrategyId, productId });
  };

  const addNewValuePoint = (isEditing: boolean) => {
    if (isEditing) {
      setEditingProductValuePoints((prev) => [...prev, { listen_for: "", insight_text: "", link: "" }]);
    } else {
      setNewProductValuePoints((prev) => [...prev, { listen_for: "", insight_text: "", link: "" }]);
    }
  };

  const removeValuePoint = (index: number, isEditing: boolean) => {
    if (isEditing) {
      setEditingProductValuePoints((prev) => prev.filter((_, i) => i !== index));
    } else {
      setNewProductValuePoints((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateValuePoint = (
    index: number,
    field: "listen_for" | "insight_text" | "link",
    value: string,
    isEditing: boolean
  ) => {
    if (isEditing) {
      setEditingProductValuePoints((prev) =>
        prev.map((vp, i) => (i === index ? { ...vp, [field]: value } : vp))
      );
    } else {
      setNewProductValuePoints((prev) =>
        prev.map((vp, i) => (i === index ? { ...vp, [field]: value } : vp))
      );
    }
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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Gong Call Coaching</h1>
      </div>

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
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {strategies.map((strategy: Strategy) => (
              <div key={strategy.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {editingStrategyId === strategy.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <input
                      type="text"
                      value={editingStrategyName}
                      onChange={(e) => setEditingStrategyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveStrategyName();
                        if (e.key === "Escape") {
                          setEditingStrategyId(null);
                          setEditingStrategyName("");
                        }
                      }}
                      autoFocus
                      style={{
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.875rem",
                        border: "2px solid #0066cc",
                        borderRadius: "20px",
                        outline: "none",
                        width: "150px",
                      }}
                    />
                    <button
                      onClick={handleSaveStrategyName}
                      disabled={updateStrategyMutation.isPending || !editingStrategyName.trim()}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      {updateStrategyMutation.isPending ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingStrategyId(null);
                        setEditingStrategyName("");
                      }}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
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
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedStrategyId(strategy.id)}
                      style={{
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        backgroundColor: selectedStrategyId === strategy.id ? "#0066cc" : "#fff",
                        color: selectedStrategyId === strategy.id ? "#fff" : strategy.enabled ? "#333" : "#999",
                        border: `2px solid ${selectedStrategyId === strategy.id ? "#0066cc" : strategy.enabled ? "#ccc" : "#ddd"}`,
                        borderRadius: "20px",
                        cursor: "pointer",
                        fontWeight: selectedStrategyId === strategy.id ? 600 : 400,
                        transition: "all 0.15s ease",
                        opacity: strategy.enabled ? 1 : 0.7,
                      }}
                    >
                      {strategy.name}{!strategy.enabled && " (off)"}
                    </button>
                    {selectedStrategyId === strategy.id && (
                      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                        <button
                          onClick={() => toggleStrategyMutation.mutate(strategy.id)}
                          disabled={toggleStrategyMutation.isPending}
                          title={strategy.enabled ? "Turn off auto-emails" : "Turn on auto-emails"}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.7rem",
                            backgroundColor: strategy.enabled ? "#e6f4ea" : "#f5f5f5",
                            color: strategy.enabled ? "#1e7e34" : "#666",
                            border: `1px solid ${strategy.enabled ? "#b7e4c7" : "#ccc"}`,
                            borderRadius: "12px",
                            cursor: "pointer",
                            fontWeight: 500,
                            minWidth: "40px",
                          }}
                        >
                          {strategy.enabled ? "ON" : "OFF"}
                        </button>
                        <button
                          onClick={() => handleEditStrategy(strategy)}
                          title="Edit name"
                          style={{
                            padding: "0.25rem 0.4rem",
                            fontSize: "0.7rem",
                            backgroundColor: "#f0f0f0",
                            color: "#333",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteStrategy(strategy.id)}
                          disabled={deleteStrategyMutation.isPending}
                          title="Delete strategy"
                          style={{
                            padding: "0.25rem 0.4rem",
                            fontSize: "0.7rem",
                            backgroundColor: "#fce8e6",
                            color: "#c5221f",
                            border: "1px solid #f5c6cb",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {deleteStrategyMutation.isError && (
          <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
            {deleteStrategyMutation.error instanceof Error
              ? deleteStrategyMutation.error.message
              : "Failed to delete strategy"}
          </p>
        )}
        {updateStrategyMutation.isError && (
          <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
            {updateStrategyMutation.error instanceof Error
              ? updateStrategyMutation.error.message
              : "Failed to update strategy"}
          </p>
        )}

        {strategies && strategies.length === 0 && (
          <p style={{ color: "#666" }}>No strategies yet. Create one to get started!</p>
        )}
      </section>

      {/* Only show rest of UI if a strategy is selected */}
      {selectedStrategyId && (
        <>
          <section style={{ marginTop: "2rem" }}>
            <h2>Recipients</h2>

            {/* Create AE Form */}
            <form onSubmit={handleSubmitAE} style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="email"
                  placeholder="Enter recipient email"
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
                  {createAEMutation.isPending ? "Adding..." : "Add"}
                </button>
              </div>
              {formError && (
                <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
                  {formError}
                </p>
              )}
            </form>

            {/* Loading State */}
            {isAEsLoading && <p>Loading recipients...</p>}

            {/* Error State */}
            {isAEsError && (
              <div style={{ color: "#cc0000", padding: "1rem", backgroundColor: "#fff0f0", borderRadius: "4px" }}>
                <p style={{ margin: 0 }}>
                  Error loading recipients: {aesError instanceof Error ? aesError.message : "Unknown error"}
                </p>
              </div>
            )}

            {/* Recipient List */}
            {aes && aes.length === 0 && (
              <p style={{ color: "#666" }}>No recipients yet. Add one above!</p>
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

          {/* Products Section - main content (replaces Prompt) */}
          <section style={{ marginTop: "2rem" }}>
            <h2>Products</h2>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
              Add products and value points. When an external participant says something related to a value point on a call, the AI surfaces that insight in the coaching email.
            </p>

            {!showNewProductForm && (
              <button
                onClick={() => setShowNewProductForm(true)}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.875rem",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginBottom: "1rem",
                }}
              >
                + New Product
              </button>
            )}

            {showNewProductForm && (
              <form
                onSubmit={handleSubmitNewProduct}
                style={{
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "8px",
                  border: "1px solid #e9ecef",
                }}
              >
                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="Product title"
                    value={newProductTitle}
                    onChange={(e) => setNewProductTitle(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      maxWidth: "400px",
                      padding: "0.5rem 0.75rem",
                      fontSize: "1rem",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <textarea
                    placeholder="Description (optional)"
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      maxWidth: "500px",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <strong style={{ fontSize: "0.875rem" }}>Value points</strong>
                  {newProductValuePoints.map((vp, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "flex-start",
                        marginTop: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Listen for (what to hear on the call)"
                        value={vp.listen_for}
                        onChange={(e) => updateValuePoint(index, "listen_for", e.target.value, false)}
                        style={{
                          flex: "1",
                          minWidth: "180px",
                          padding: "0.4rem 0.5rem",
                          fontSize: "0.875rem",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Insight to surface when external says it"
                        value={vp.insight_text}
                        onChange={(e) => updateValuePoint(index, "insight_text", e.target.value, false)}
                        style={{
                          flex: "1",
                          minWidth: "180px",
                          padding: "0.4rem 0.5rem",
                          fontSize: "0.875rem",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                        }}
                      />
                      <input
                        type="url"
                        placeholder="Link (optional)"
                        value={vp.link}
                        onChange={(e) => updateValuePoint(index, "link", e.target.value, false)}
                        style={{
                          flex: "0.7",
                          minWidth: "140px",
                          padding: "0.4rem 0.5rem",
                          fontSize: "0.875rem",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeValuePoint(index, false)}
                        disabled={newProductValuePoints.length <= 1}
                        style={{
                          padding: "0.4rem 0.5rem",
                          fontSize: "0.75rem",
                          backgroundColor: "#fce8e6",
                          color: "#c5221f",
                          border: "1px solid #f5c6cb",
                          borderRadius: "4px",
                          cursor: newProductValuePoints.length <= 1 ? "not-allowed" : "pointer",
                          opacity: newProductValuePoints.length <= 1 ? 0.5 : 1,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addNewValuePoint(false)}
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.35rem 0.6rem",
                      fontSize: "0.8rem",
                      backgroundColor: "#e8f0fe",
                      color: "#1a73e8",
                      border: "1px solid #a8c7fa",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    + Add value point
                  </button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button
                    type="submit"
                    disabled={createProductMutation.isPending || !newProductTitle.trim()}
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      backgroundColor: "#0066cc",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: createProductMutation.isPending || !newProductTitle.trim() ? "not-allowed" : "pointer",
                      opacity: createProductMutation.isPending || !newProductTitle.trim() ? 0.6 : 1,
                    }}
                  >
                    {createProductMutation.isPending ? "Creating..." : "Create Product"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProductForm(false);
                      setNewProductTitle("");
                      setNewProductDescription("");
                      setNewProductValuePoints([{ listen_for: "", insight_text: "", link: "" }]);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
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
                {createProductMutation.isError && (
                  <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
                    {createProductMutation.error instanceof Error
                      ? createProductMutation.error.message
                      : "Failed to create product"}
                  </p>
                )}
              </form>
            )}

            {isProductsLoading && <p>Loading products...</p>}
            {isProductsError && (
              <div style={{ color: "#cc0000", padding: "1rem", backgroundColor: "#fff0f0", borderRadius: "4px" }}>
                <p style={{ margin: 0 }}>
                  Error loading products: {productsError instanceof Error ? productsError.message : "Unknown error"}
                </p>
              </div>
            )}

            {products && products.length === 0 && !showNewProductForm && (
              <p style={{ color: "#999", fontStyle: "italic" }}>No products yet. Click "+ New Product" to add your first product and its value points.</p>
            )}

            {products &&
              products.length > 0 &&
              (showAllProducts ? products : products.slice(0, DISPLAY_LIMIT)).map((product: Product) => (
                <div
                  key={product.id}
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    border: "1px solid #e9ecef",
                  }}
                >
                  {editingProductId === product.id ? (
                    <div>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <input
                          type="text"
                          value={editingProductTitle}
                          onChange={(e) => setEditingProductTitle(e.target.value)}
                          style={{
                            width: "100%",
                            maxWidth: "400px",
                            padding: "0.5rem 0.75rem",
                            fontSize: "1rem",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <textarea
                          value={editingProductDescription}
                          onChange={(e) => setEditingProductDescription(e.target.value)}
                          placeholder="Description (optional)"
                          rows={2}
                          style={{
                            width: "100%",
                            maxWidth: "500px",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.875rem",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            resize: "vertical",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "0.75rem" }}>
                        <strong style={{ fontSize: "0.875rem" }}>Value points</strong>
                        {editingProductValuePoints.map((vp, index) => (
                          <div
                            key={index}
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              alignItems: "flex-start",
                              marginTop: "0.5rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Listen for"
                              value={vp.listen_for}
                              onChange={(e) => updateValuePoint(index, "listen_for", e.target.value, true)}
                              style={{
                                flex: "1",
                                minWidth: "180px",
                                padding: "0.4rem 0.5rem",
                                fontSize: "0.875rem",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Insight to surface"
                              value={vp.insight_text}
                              onChange={(e) => updateValuePoint(index, "insight_text", e.target.value, true)}
                              style={{
                                flex: "1",
                                minWidth: "180px",
                                padding: "0.4rem 0.5rem",
                                fontSize: "0.875rem",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                              }}
                            />
                            <input
                              type="url"
                              placeholder="Link (optional)"
                              value={vp.link}
                              onChange={(e) => updateValuePoint(index, "link", e.target.value, true)}
                              style={{
                                flex: "0.7",
                                minWidth: "140px",
                                padding: "0.4rem 0.5rem",
                                fontSize: "0.875rem",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removeValuePoint(index, true)}
                              disabled={editingProductValuePoints.length <= 1}
                              style={{
                                padding: "0.4rem 0.5rem",
                                fontSize: "0.75rem",
                                backgroundColor: "#fce8e6",
                                color: "#c5221f",
                                border: "1px solid #f5c6cb",
                                borderRadius: "4px",
                                cursor: editingProductValuePoints.length <= 1 ? "not-allowed" : "pointer",
                                opacity: editingProductValuePoints.length <= 1 ? 0.5 : 1,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addNewValuePoint(true)}
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.35rem 0.6rem",
                            fontSize: "0.8rem",
                            backgroundColor: "#e8f0fe",
                            color: "#1a73e8",
                            border: "1px solid #a8c7fa",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          + Add value point
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={handleSaveProduct}
                          disabled={
                            updateProductMutation.isPending ||
                            !editingProductTitle.trim()
                          }
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor:
                              updateProductMutation.isPending || !editingProductTitle.trim()
                                ? "not-allowed"
                                : "pointer",
                            opacity:
                              updateProductMutation.isPending || !editingProductTitle.trim() ? 0.6 : 1,
                          }}
                        >
                          {updateProductMutation.isPending ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingProductId(null)}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
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
                      {updateProductMutation.isError && (
                        <p style={{ color: "#cc0000", marginTop: "0.5rem", fontSize: "0.875rem" }}>
                          {updateProductMutation.error instanceof Error
                            ? updateProductMutation.error.message
                            : "Failed to update product"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <strong style={{ fontSize: "1rem" }}>{product.title}</strong>
                        {product.description && (
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#666" }}>
                            {product.description}
                          </p>
                        )}
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#888" }}>
                          {product.value_points.length} value point{product.value_points.length !== 1 ? "s" : ""}
                          {product.value_points.some((vp) => vp.link) && (
                            <span style={{ marginLeft: "0.5rem" }}>
                              ({product.value_points.filter((vp) => vp.link).length} with link{product.value_points.filter((vp) => vp.link).length !== 1 ? "s" : ""})
                            </span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          onClick={() => handleStartEditProduct(product)}
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
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={deleteProductMutation.isPending}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            backgroundColor: "#fce8e6",
                            color: "#c5221f",
                            border: "1px solid #f5c6cb",
                            borderRadius: "4px",
                            cursor: deleteProductMutation.isPending ? "not-allowed" : "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

            {products && products.length > DISPLAY_LIMIT && !editingProductId && (
              <button
                onClick={() => setShowAllProducts(!showAllProducts)}
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
                {showAllProducts ? "Show less" : `See ${products.length - DISPLAY_LIMIT} more`}
              </button>
            )}
          </section>

          {/* Test Call Section */}
          <section
            style={{
              marginTop: "3rem",
              padding: "1.5rem",
              backgroundColor: "#fafbfc",
              borderRadius: "8px",
              border: "1px solid #e1e4e8",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>
              Test Call{" "}
              <span style={{ fontWeight: 400, color: "#666", fontSize: "0.875rem" }}>
                (dry-run, never sends email)
              </span>
            </h2>
            <form onSubmit={handleTestCall} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1", minWidth: "200px", maxWidth: "400px" }}>
                <input
                  type="text"
                  placeholder="Enter Gong Call ID"
                  value={testCallId}
                  onChange={(e) => setTestCallId(e.target.value)}
                  disabled={testCallMutation.isPending}
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
              <button
                type="submit"
                disabled={testCallMutation.isPending || !testCallId.trim()}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "1rem",
                  backgroundColor: "#6f42c1",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: testCallMutation.isPending || !testCallId.trim() ? "not-allowed" : "pointer",
                  opacity: testCallMutation.isPending || !testCallId.trim() ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {testCallMutation.isPending ? "Running..." : "Run Test"}
              </button>
            </form>
            {testCallMessage && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "4px",
                  backgroundColor:
                    testCallMessage.type === "success"
                      ? "#e6f4ea"
                      : testCallMessage.type === "skipped"
                      ? "#fff8e6"
                      : "#fff0f0",
                  color:
                    testCallMessage.type === "success"
                      ? "#1e7e34"
                      : testCallMessage.type === "skipped"
                      ? "#b36b00"
                      : "#cc0000",
                  position: "relative",
                }}
              >
                <button
                  onClick={() => setTestCallMessage(null)}
                  style={{
                    position: "absolute",
                    top: "0.5rem",
                    right: "0.5rem",
                    background: "none",
                    border: "none",
                    fontSize: "1.25rem",
                    cursor: "pointer",
                    color: "inherit",
                    opacity: 0.6,
                    lineHeight: 1,
                    padding: 0,
                  }}
                  aria-label="Dismiss"
                >
                  ×
                </button>
                <div style={{ paddingRight: "1.5rem" }}>{testCallMessage.text}</div>
                {testCallMessage.details && (
                  <div style={{ fontSize: "0.875rem", marginTop: "0.25rem", opacity: 0.8, paddingRight: "1.5rem" }}>
                    {testCallMessage.details}
                  </div>
                )}
              </div>
            )}
            <p style={{ margin: "0.75rem 0 0 0", fontSize: "0.8rem", color: "#666" }}>
              Runs the full pipeline: fetch from Gong → find AE → classify → generate output.
              Test runs can be repeated any number of times for prompt iteration.
            </p>
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
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <StatusBadge status={log.status} />
                              {log.is_test && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "0.2rem 0.4rem",
                                    borderRadius: "4px",
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    backgroundColor: "#f3e8ff",
                                    color: "#6f42c1",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                  }}
                                >
                                  TEST
                                </span>
                              )}
                            </div>
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
    </div>
  );
}

function StatusBadge({ status }: { status: EmailLog["status"] }) {
  const styles: Record<EmailLog["status"], { bg: string; color: string }> = {
    sent: { bg: "#e6f4ea", color: "#1e7e34" },
    failed: { bg: "#fce8e6", color: "#c5221f" },
    queued: { bg: "#e8f0fe", color: "#1a73e8" },
    skipped: { bg: "#f5f5f5", color: "#666" },
    generated: { bg: "#e6f4ea", color: "#1e7e34" },
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
  const [copiedField, setCopiedField] = useState<"subject" | "body" | "decision" | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [showDecision, setShowDecision] = useState(false);

  const handleCopy = async (text: string, field: "subject" | "body" | "decision") => {
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

  const isSkipped = log.status === "skipped";

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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.25rem" }}>Email Details</h3>
            <StatusBadge status={log.status} />
            {log.is_test && (
              <span
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  backgroundColor: "#f3e8ff",
                  color: "#6f42c1",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                TEST
              </span>
            )}
          </div>
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

        {/* Skip Reason (prominent when skipped) */}
        {isSkipped && log.skip_reason && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "1rem",
              backgroundColor: "#fff8e6",
              borderRadius: "8px",
              border: "1px solid #ffd666",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>⚠️</span>
              <strong style={{ color: "#b36b00" }}>Skipped</strong>
            </div>
            <p style={{ margin: 0, color: "#8c5a00" }}>{log.skip_reason}</p>
          </div>
        )}

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
              maxHeight: "300px",
              overflow: "auto",
              color: log.body ? "#333" : "#999",
            }}
          >
            {displayValue(log.body)}
          </pre>
        </div>

        {/* Classifier Decision (collapsible) */}
        {log.decision && (
          <div style={{ marginBottom: "1rem" }}>
            <button
              onClick={() => setShowDecision(!showDecision)}
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
              <span style={{ transform: showDecision ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                ▶
              </span>
              Classifier Decision
            </button>
            {showDecision && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        backgroundColor: log.decision.should_send ? "#e6f4ea" : "#fce8e6",
                        color: log.decision.should_send ? "#1e7e34" : "#c5221f",
                      }}
                    >
                      {log.decision.should_send ? "Should Send" : "Should Skip"}
                    </span>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        backgroundColor: "#e8f0fe",
                        color: "#1a73e8",
                      }}
                    >
                      {log.decision.call_type}
                    </span>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        backgroundColor: "#f5f5f5",
                        color: "#666",
                      }}
                    >
                      {Math.round(log.decision.confidence * 100)}% confidence
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(JSON.stringify(log.decision, null, 2), "decision")}
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.7rem",
                      backgroundColor: copiedField === "decision" ? "#e6f4ea" : "#f0f0f0",
                      color: copiedField === "decision" ? "#1e7e34" : "#333",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {copiedField === "decision" ? "Copied!" : "Copy JSON"}
                  </button>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <strong>Reason:</strong> {log.decision.reason}
                </div>
                <details>
                  <summary style={{ cursor: "pointer", color: "#666", fontSize: "0.8rem" }}>
                    Raw JSON
                  </summary>
                  <pre
                    style={{
                      margin: "0.5rem 0 0 0",
                      padding: "0.5rem",
                      backgroundColor: "#fff",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      overflow: "auto",
                      maxHeight: "150px",
                    }}
                  >
                    {JSON.stringify(log.decision, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}

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
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong>External Emails:</strong> {log.context.external_emails.join(", ")}
                  </div>
                )}
                {log.context.transcript && (
                  <div>
                    <strong>Transcript:</strong>
                    <pre
                      style={{
                        margin: "0.25rem 0 0 0",
                        padding: "0.5rem",
                        backgroundColor: "#fff",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        maxHeight: "150px",
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {log.context.transcript}
                    </pre>
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

function App() {
  return <AppContent />;
}

export default App;
