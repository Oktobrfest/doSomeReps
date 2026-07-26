import React, { useState, useEffect } from "react";
import styles from "./AiIntegration.module.css";

interface SavedProvider {
  id: number;
  provider: string;
  apiBase: string;
  hasKey: boolean;
  maskedKey: string;
}

interface SavedIntegration {
  id: number;
  modality: string;
  provider_id: number | null;
  model: string;
}

interface AIConfig {
  providers: SavedProvider[];
  integrations: SavedIntegration[];
  predefinedOptions: Record<string, string[]>;
  modelPrices?: Record<string, string>;
}

const MODALITIES = [
  { value: "text", label: "Text Generation (LLM)", desc: "Used for question formulation, chat, and explanation features." },
  { value: "tts", label: "Text to Speech (TTS)", desc: "Used for reading out questions, answers, and hints." },
  { value: "stt", label: "Speech to Text / Transcribe", desc: "Used for transcribing voice responses." },
  { value: "image", label: "Image Generation", desc: "Used for creating illustrative visual aids." }
];

export default function AiIntegration() {
  const [activeTab, setActiveTab] = useState<"status" | "providers" | "integrations" | "playground">("status");
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Provider Form State
  const [providerName, setProviderName] = useState<string>("");
  const [customProviderName, setCustomProviderName] = useState<string>("");
  const [providerApiBase, setProviderApiBase] = useState<string>("");
  const [providerApiKey, setProviderApiKey] = useState<string>("");

  // Integration Form State
  const [selectedModality, setSelectedModality] = useState<string>("text");
  const [integrationProviderId, setIntegrationProviderId] = useState<string>("");
  const [integrationModel, setIntegrationModel] = useState<string>("");
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);

  // Playground states
  const [playgroundModality, setPlaygroundModality] = useState<string>("text");
  const [prompt, setPrompt] = useState<string>("");
  const [playgroundResponse, setPlaygroundResponse] = useState<string | null>(null);
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);
  const [playgroundModelUsed, setPlaygroundModelUsed] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/integration/api/config?_=${Date.now()}`);
      let data: any;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Failed to load configuration: Server returned a non-JSON response (Status: ${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to load configuration (Status: ${res.status})`);
      }
      setConfig(data);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred while fetching settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Update integration model defaults when modality or provider changes
  useEffect(() => {
    if (!config) return;
    const providerObj = config.providers.find(p => p.id === Number(integrationProviderId));
    const providerKey = providerObj ? providerObj.provider : "";
    const stdModels = config.predefinedOptions[providerKey] || [];
    
    // Check if there's an existing integration configuration for this modality
    const existing = config.integrations.find(i => i.modality === selectedModality);
    if (existing) {
      setIntegrationProviderId(existing.provider_id ? String(existing.provider_id) : "");
      setIntegrationModel(existing.model);
      if (existing.model && !stdModels.includes(existing.model)) {
        setIsCustomModel(true);
      } else {
        setIsCustomModel(false);
      }
    } else {
      setIntegrationProviderId("");
      setIntegrationModel("");
      setIsCustomModel(false);
    }
  }, [selectedModality, config]);

  const handleProviderSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pName = e.target.value;
    setProviderName(pName);
    
    // Auto populate fields if provider already has config
    if (config) {
      const existing = config.providers.find(p => p.provider === pName);
      if (existing) {
        setProviderApiBase(existing.apiBase || "");
      } else {
        setProviderApiBase("");
      }
    }
    setProviderApiKey("");
  };

  const getModelPrice = (modelName: string, providerIdStr: string): string => {
    if (!config?.modelPrices || !modelName) return "N/A";
    const providerObj = config.providers.find(p => p.id === Number(providerIdStr));
    const providerName = providerObj ? providerObj.provider : "";

    const normalizedModel = modelName.trim().toLowerCase();
    const normalizedProvider = providerName.trim().toLowerCase();

    const lookupKeys = [
      modelName,
      normalizedModel,
      `${providerName}/${modelName}`,
      `${normalizedProvider}/${normalizedModel}`,
      modelName.split('/').pop() || modelName,
      (modelName.split('/').pop() || modelName).toLowerCase(),
    ];

    for (const key of lookupKeys) {
      if (config.modelPrices[key]) {
        return config.modelPrices[key];
      }
    }
    return "N/A";
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalProvider = providerName === "custom" ? customProviderName.trim() : providerName;
    if (!finalProvider) {
      setError("Please specify a provider.");
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setError(null);

    try {
      const res = await fetch("/integration/api/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: finalProvider,
          apiBase: providerApiBase,
          apiKey: providerApiKey,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(result.message || "Provider credentials saved successfully!");
        setProviderApiKey("");
        setProviderName("");
        setCustomProviderName("");
        setProviderApiBase("");
        await fetchConfig();
      } else {
        throw new Error(result.error || "Failed to save provider.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (providerId: number) => {
    if (!window.confirm("Are you sure you want to delete credentials for this provider? All linked modalities will be unset.")) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/integration/api/provider/${providerId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg("Provider deleted successfully.");
        await fetchConfig();
      } else {
        throw new Error(result.error || "Failed to delete provider.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setError(null);

    try {
      const res = await fetch("/integration/api/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modality: selectedModality,
          provider_id: integrationProviderId ? Number(integrationProviderId) : null,
          model: integrationModel,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(result.message || "Integration configured successfully!");
        await fetchConfig();
      } else {
        throw new Error(result.error || "Failed to save integration.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setTesting(true);
    setPlaygroundResponse(null);
    setPlaygroundError(null);
    setPlaygroundModelUsed(null);

    try {
      const res = await fetch("/integration/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          modality: playgroundModality,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPlaygroundResponse(data.response);
        setPlaygroundModelUsed(data.model_used);
      } else {
        throw new Error(data.error || "Failed to generate completion.");
      }
    } catch (err: any) {
      setPlaygroundError(err.message || "An unexpected error occurred.");
    } finally {
      setTesting(false);
    }
  };

  if (loading && !config) {
    return (
      <div className={`${styles.textCenter} ${styles.my5} ${styles.py5}`}>
        <div className={styles.spinner} role="status"></div>
        <p className={`${styles.textMuted} ${styles.bold}`} style={{ marginTop: "1rem" }}>Fetching current AI status...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            <i className="fa fa-plug" style={{ marginRight: "0.5rem" }}></i>Multi-Modality AI Orchestrator
          </h2>
        </div>
      </div>

      <ul className={styles.tabList}>
        <li className={styles.tabItem}>
          <button
            className={`${styles.tabBtn} ${activeTab === "status" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("status")}
          >
            <i className="fa fa-dashboard"></i> Dashboard
          </button>
        </li>
        <li className={styles.tabItem}>
          <button
            className={`${styles.tabBtn} ${activeTab === "providers" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("providers")}
          >
            <i className="fa fa-key"></i> 1. Credentials & API Keys
          </button>
        </li>
        <li className={styles.tabItem}>
          <button
            className={`${styles.tabBtn} ${activeTab === "integrations" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("integrations")}
          >
            <i className="fa fa-gears"></i> 2. Modality Models
          </button>
        </li>
        <li className={styles.tabItem}>
          <button
            className={`${styles.tabBtn} ${activeTab === "playground" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("playground")}
          >
            <i className="fa fa-flask"></i> 3. Playground
          </button>
        </li>
      </ul>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button type="button" className={styles.alertClose} onClick={() => setError(null)}>
            <span>&times;</span>
          </button>
        </div>
      )}

      {successMsg && (
        <div className={`${styles.alert} ${styles.alertSuccess}`} role="alert">
          <div>
            <strong>Success!</strong> {successMsg}
          </div>
          <button type="button" className={styles.alertClose} onClick={() => setSuccessMsg(null)}>
            <span>&times;</span>
          </button>
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === "status" && config && (
        <div className={styles.dashboardGrid}>
          <div className={`${styles.card} ${styles.cardPrimary}`}>
            <div className={`${styles.cardHeader} ${styles.cardHeaderPrimary}`}>
              <i className="fa fa-key" style={{ marginRight: "0.5rem" }}></i>Active Providers ({config.providers.length})
            </div>
            <div className={styles.cardBody}>
              {config.providers.length === 0 ? (
                <div className={`${styles.textCenter} ${styles.textMuted}`} style={{ padding: "1.5rem 0" }}>
                  <p style={{ marginBottom: "0.5rem" }}>No API keys or provider credentials added yet.</p>
                  <button className={`${styles.btn} ${styles.btnPrimary} ${styles.small}`} onClick={() => setActiveTab("providers")}>
                    Add Credentials
                  </button>
                </div>
              ) : (
                <div className={styles.tableResponsive}>
                  <table className={`${styles.table} ${styles.tableBorderless}`}>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Endpoint</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.providers.map(p => (
                        <tr key={p.id}>
                          <td>
                            <span className={`${styles.badge} ${styles.badgeInfo}`}>{p.provider}</span>
                          </td>
                          <td>
                            <span className={`${styles.small} ${styles.textMuted}`}>{p.apiBase || "Default"}</span>
                          </td>
                          <td>
                            <span className={`${styles.textSuccess} ${styles.small}`}>
                              <i className="fa fa-check-circle" style={{ marginRight: "0.25rem" }}></i> Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className={`${styles.card} ${styles.cardSuccess}`}>
            <div className={`${styles.cardHeader} ${styles.cardHeaderSuccess}`}>
              <i className="fa fa-sliders" style={{ marginRight: "0.5rem" }}></i>Modality Mapping
            </div>
            <div className={styles.cardBody}>
              <table className={`${styles.table} ${styles.tableBorderless}`}>
                <tbody>
                  {MODALITIES.map(m => {
                    const mapping = config.integrations.find(i => i.modality === m.value);
                    const providerObj = mapping ? config.providers.find(p => p.id === mapping.provider_id) : null;
                    return (
                      <tr key={m.value}>
                        <td style={{ paddingLeft: 0 }}>
                          <strong>{m.label}</strong>
                        </td>
                        <td>
                          {mapping && providerObj ? (
                            <div>
                              <span className={`${styles.badge} ${styles.badgeSecondary}`} style={{ marginRight: "0.5rem" }}>{providerObj.provider}</span>
                              <code>{mapping.model}</code>
                            </div>
                          ) : (
                            <span className={`${styles.textDanger} ${styles.italic} ${styles.small}`}>Unconfigured</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className={styles.textCenter} style={{ marginTop: "1.5rem" }}>
                <button className={`${styles.btn} ${styles.btnOutlineSuccess} ${styles.small}`} onClick={() => setActiveTab("integrations")}>
                  Configure Modalities
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROVIDERS TAB */}
      {activeTab === "providers" && config && (
        <div className={styles.credentialsGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>Add / Edit Credentials</div>
            <div className={styles.cardBody}>
              <form onSubmit={handleSaveProvider}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Select Provider</label>
                  <select className={styles.formControl} value={providerName} onChange={handleProviderSelectChange}>
                    <option value="">-- Choose Provider --</option>
                    {Object.keys(config.predefinedOptions).map(p => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                    <option value="custom">Other / Custom</option>
                  </select>
                </div>

                {providerName === "custom" && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Custom Provider ID</label>
                    <input
                      type="text"
                      className={`${styles.formControl} ${styles.formControlLowercase}`}
                      placeholder="e.g. together_ai"
                      value={customProviderName}
                      onChange={(e) => setCustomProviderName(e.target.value)}
                    />
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Custom API Base URL (Optional)</label>
                  <input
                    type="text"
                    className={styles.formControl}
                    placeholder="Only for Ollama, Local, or Private Proxies"
                    value={providerApiBase}
                    onChange={(e) => setProviderApiBase(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>API Key / Credentials Token</label>
                  <input
                    type="password"
                    className={styles.formControl}
                    placeholder="Enter new key token"
                    value={providerApiKey}
                    onChange={(e) => setProviderApiKey(e.target.value)}
                  />
                </div>

                <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} disabled={saving}>
                  {saving ? "Saving..." : "Save Provider Credentials"}
                </button>
              </form>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>Saved Credentials</div>
            <div className={styles.cardBodyNoPadding}>
              {config.providers.length === 0 ? (
                <p className={`${styles.textMuted} ${styles.textCenter}`} style={{ padding: "1.5rem 0" }}>No providers configured yet.</p>
              ) : (
                <div className={styles.tableResponsive}>
                  <table className={`${styles.table} ${styles.tableStriped} ${styles.tableHover}`}>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>API Base</th>
                        <th>Key Saved</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.providers.map(p => (
                        <tr key={p.id}>
                          <td>
                            <strong className={`${styles.textPrimary}`} style={{ textTransform: "uppercase" }}>{p.provider}</strong>
                          </td>
                          <td>
                            <code>{p.apiBase || "Default"}</code>
                          </td>
                          <td>
                            <span className={`${styles.textSuccess} ${styles.small}`}>
                              <i className="fa fa-lock" style={{ marginRight: "0.25rem" }}></i> Yes
                            </span>
                          </td>
                          <td>
                            <button className={`${styles.btn} ${styles.btnOutlineDanger}`} onClick={() => handleDeleteProvider(p.id)}>
                              <i className="fa fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INTEGRATIONS TAB */}
      {activeTab === "integrations" && config && (
        <div className={styles.integrationsGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>Select Modality</div>
            <div className={styles.cardBodyNoPadding}>
              <div className={styles.listGroup}>
                {MODALITIES.map(m => (
                  <button
                    key={m.value}
                    className={`${styles.listGroupItem} ${selectedModality === m.value ? styles.listGroupItemActive : ""}`}
                    onClick={() => setSelectedModality(m.value)}
                  >
                    <h6 className={styles.bold} style={{ margin: "0 0 4px 0", fontSize: "0.95rem" }}>{m.label}</h6>
                    <p className={styles.small} style={{ margin: 0, color: selectedModality === m.value ? "rgba(255, 255, 255, 0.8)" : "#718096" }}>{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={`${styles.cardHeader} ${styles.textPrimary}`} style={{ textTransform: "capitalize" }}>
              Configure {selectedModality} Generation Modality
            </div>
            <div className={styles.cardBody}>
              {config.providers.length === 0 ? (
                <div className={styles.textCenter} style={{ padding: "1.5rem 0" }}>
                  <p className={styles.textMuted}>You must add provider credentials before assigning models to modalities.</p>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setActiveTab("providers")}>
                    Go to Credentials
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveIntegration}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Assigned API Provider Key</label>
                    <select
                      className={styles.formControl}
                      value={integrationProviderId}
                      onChange={(e) => setIntegrationProviderId(e.target.value)}
                    >
                      <option value="">-- No Provider Assigned --</option>
                      {config.providers.map(p => (
                        <option key={p.id} value={p.id}>{p.provider.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {integrationProviderId && (
                    <div className={styles.formGroup}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <label className={styles.formLabel} style={{ margin: 0 }}>Target Model Name</label>
                        <div className={styles.formCheck}>
                          <input
                            type="checkbox"
                            className={styles.formCheckInput}
                            id="custom-model-check"
                            checked={isCustomModel}
                            onChange={(e) => setIsCustomModel(e.target.checked)}
                          />
                          <label className={styles.formCheckLabel} htmlFor="custom-model-check">
                            Custom model path entry
                          </label>
                        </div>
                      </div>

                      {isCustomModel ? (
                        <input
                          type="text"
                          className={styles.formControl}
                          placeholder="e.g. gpt-4o-mini"
                          value={integrationModel}
                          onChange={(e) => setIntegrationModel(e.target.value)}
                        />
                      ) : (
                        <select
                          className={styles.formControl}
                          value={integrationModel}
                          onChange={(e) => setIntegrationModel(e.target.value)}
                        >
                          <option value="">-- Select Predefined Model --</option>
                          {(config.predefinedOptions[config.providers.find(p => p.id === Number(integrationProviderId))?.provider || ""] || []).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {integrationModel && (
                    <div className={styles.priceContainer} style={{ marginBottom: "1.25rem" }}>
                      <span className={`${styles.formLabel} ${styles.textMuted}`} style={{ display: "inline-block", margin: 0 }}>Est. Token Price:</span>
                      <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginLeft: "0.5rem" }}>
                        {getModelPrice(integrationModel, integrationProviderId)}
                      </span>
                    </div>
                  )}

                  <button type="submit" className={`${styles.btn} ${styles.btnSuccess}`} style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }} disabled={saving}>
                    {saving ? "Saving..." : "Apply Integration Model"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PLAYGROUND TAB */}
      {activeTab === "playground" && config && (
        <div className={styles.playgroundGrid}>
          <div className={styles.card}>
            <div className={`${styles.cardHeader} ${styles.cardHeaderSecondary}`}>Playground Modality Tester</div>
            <div className={styles.cardBody}>
              <form onSubmit={handleTestPrompt}>
                <div style={{ display: "flex", gap: "16px", marginBottom: "1rem" }}>
                  <div style={{ flex: "0 0 320px", maxWidth: "100%" }}>
                    <label className={styles.formLabel}>Modality</label>
                    <select
                      className={styles.formControl}
                      value={playgroundModality}
                      onChange={(e) => setPlaygroundModality(e.target.value)}
                    >
                      {MODALITIES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                  <textarea
                    className={`${styles.formControl} ${styles.formControlMonospace}`}
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Write your test prompt here... e.g. 'Solve 15 * 12 and explain the solution.'"
                    disabled={testing}
                  ></textarea>
                </div>

                <div className={styles.textRight}>
                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.btnSuccess}`}
                    style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
                    disabled={testing || !prompt.trim()}
                  >
                    {testing ? "Generating..." : "Send Request"}
                  </button>
                </div>
              </form>

              {(playgroundResponse || playgroundError || playgroundModelUsed) && (
                <div className={styles.resultConsole}>
                  <h6 className={styles.bold} style={{ color: "#718096", margin: "0 0 8px 0" }}>Result Console:</h6>
                  {playgroundModelUsed && (
                    <div className={`${styles.small} ${styles.textMuted}`} style={{ marginBottom: "8px" }}>
                      🤖 <strong>Model resolved:</strong> <code>{playgroundModelUsed}</code>
                    </div>
                  )}
                  {playgroundError && (
                    <div className={styles.resultError}>
                      <strong>Request failed:</strong> {playgroundError}
                    </div>
                  )}
                  {playgroundResponse && (
                    <div className={styles.resultResponse}>
                      {playgroundResponse}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
