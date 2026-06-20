import React, { useState, useEffect } from "react";

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
      <div className="text-center my-5 py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3 text-muted font-weight-bold">Fetching current AI status...</p>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3">
        <div>
          <h2 className="text-primary mb-1">
            <i className="fa fa-plug mr-2"></i>Multi-Modality AI Orchestrator
          </h2>
        </div>
      </div>

      <ul className="nav nav-pills mb-4">
        <li className="nav-item">
          <button
            className={`nav-link border-0 ${activeTab === "status" ? "active bg-primary text-white" : "bg-light text-dark mr-2"}`}
            onClick={() => setActiveTab("status")}
          >
            <i className="fa fa-dashboard mr-1"></i> Dashboard
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link border-0 ${activeTab === "providers" ? "active bg-primary text-white" : "bg-light text-dark mr-2"}`}
            onClick={() => setActiveTab("providers")}
          >
            <i className="fa fa-key mr-1"></i> 1. Credentials & API Keys
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link border-0 ${activeTab === "integrations" ? "active bg-primary text-white" : "bg-light text-dark mr-2"}`}
            onClick={() => setActiveTab("integrations")}
          >
            <i className="fa fa-gears mr-1"></i> 2. Modality Models
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link border-0 ${activeTab === "playground" ? "active bg-primary text-white" : "bg-light text-dark"}`}
            onClick={() => setActiveTab("playground")}
          >
            <i className="fa fa-flask mr-1"></i> 3. Playground
          </button>
        </li>
      </ul>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <strong>Error:</strong> {error}
          <button type="button" className="close" onClick={() => setError(null)}>
            <span>&times;</span>
          </button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
          <strong>Success!</strong> {successMsg}
          <button type="button" className="close" onClick={() => setSuccessMsg(null)}>
            <span>&times;</span>
          </button>
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === "status" && config && (
        <div className="row">
          <div className="col-md-6 mb-4">
            <div className="card h-100 border-primary">
              <div className="card-header bg-primary text-white font-weight-bold">
                <i className="fa fa-key mr-2"></i>Active Providers ({config.providers.length})
              </div>
              <div className="card-body">
                {config.providers.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <p className="mb-2">No API keys or provider credentials added yet.</p>
                    <button className="btn btn-sm btn-primary" onClick={() => setActiveTab("providers")}>
                      Add Credentials
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-borderless">
                      <thead>
                        <tr className="border-bottom">
                          <th>Provider</th>
                          <th>Endpoint</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.providers.map(p => (
                          <tr key={p.id}>
                            <td>
                              <span className="badge badge-info text-uppercase">{p.provider}</span>
                            </td>
                            <td>
                              <span className="small text-muted">{p.apiBase || "Default"}</span>
                            </td>
                            <td>
                              <span className="text-success small">
                                <i className="fa fa-check-circle mr-1"></i> Active
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
          </div>

          <div className="col-md-6 mb-4">
            <div className="card h-100 border-success">
              <div className="card-header bg-success text-white font-weight-bold">
                <i className="fa fa-sliders mr-2"></i>Modality Mapping
              </div>
              <div className="card-body">
                <table className="table table-sm table-borderless m-0">
                  <tbody>
                    {MODALITIES.map(m => {
                      const mapping = config.integrations.find(i => i.modality === m.value);
                      const providerObj = mapping ? config.providers.find(p => p.id === mapping.provider_id) : null;
                      return (
                        <tr key={m.value} className="border-bottom pb-2">
                          <td className="pl-0 py-2">
                            <strong>{m.label}</strong>
                          </td>
                          <td className="py-2">
                            {mapping && providerObj ? (
                              <div>
                                <span className="badge badge-secondary mr-2 text-uppercase">{providerObj.provider}</span>
                                <code>{mapping.model}</code>
                              </div>
                            ) : (
                              <span className="text-danger italic small">Unconfigured</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="text-center mt-4">
                  <button className="btn btn-sm btn-outline-success" onClick={() => setActiveTab("integrations")}>
                    Configure Modalities
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROVIDERS TAB */}
      {activeTab === "providers" && config && (
        <div className="row">
          <div className="col-md-5 mb-4">
            <div className="card border">
              <div className="card-header bg-light font-weight-bold">Add / Edit Credentials</div>
              <div className="card-body">
                <form onSubmit={handleSaveProvider}>
                  <div className="form-group">
                    <label className="font-weight-bold small">Select Provider</label>
                    <select className="form-control" value={providerName} onChange={handleProviderSelectChange}>
                      <option value="">-- Choose Provider --</option>
                      {Object.keys(config.predefinedOptions).map(p => (
                        <option key={p} value={p}>{p.toUpperCase()}</option>
                      ))}
                      <option value="custom">Other / Custom</option>
                    </select>
                  </div>

                  {providerName === "custom" && (
                    <div className="form-group">
                      <label className="font-weight-bold small">Custom Provider ID</label>
                      <input
                        type="text"
                        className="form-control text-lowercase"
                        placeholder="e.g. together_ai"
                        value={customProviderName}
                        onChange={(e) => setCustomProviderName(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="font-weight-bold small">Custom API Base URL (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Only for Ollama, Local, or Private Proxies"
                      value={providerApiBase}
                      onChange={(e) => setProviderApiBase(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="font-weight-bold small">API Key / Credentials Token</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Enter new key token"
                      value={providerApiKey}
                      onChange={(e) => setProviderApiKey(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
                    {saving ? "Saving..." : "Save Provider Credentials"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-md-7 mb-4">
            <div className="card">
              <div className="card-header font-weight-bold">Saved Credentials</div>
              <div className="card-body p-0">
                {config.providers.length === 0 ? (
                  <p className="text-muted text-center py-4">No providers configured yet.</p>
                ) : (
                  <table className="table table-striped table-hover m-0">
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
                            <strong className="text-uppercase text-primary">{p.provider}</strong>
                          </td>
                          <td>
                            <code className="small">{p.apiBase || "Default"}</code>
                          </td>
                          <td>
                            <span className="text-success small">
                              <i className="fa fa-lock mr-1"></i> Yes
                            </span>
                          </td>
                          <td>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteProvider(p.id)}>
                              <i className="fa fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTEGRATIONS TAB */}
      {activeTab === "integrations" && config && (
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="card">
              <div className="card-header bg-light font-weight-bold">Select Modality</div>
              <div className="card-body p-0">
                <div className="list-group list-group-flush">
                  {MODALITIES.map(m => (
                    <button
                      key={m.value}
                      className={`list-group-item list-group-item-action text-left py-3 border-0 ${selectedModality === m.value ? "bg-primary text-white" : ""}`}
                      onClick={() => setSelectedModality(m.value)}
                    >
                      <h6 className="font-weight-bold mb-1">{m.label}</h6>
                      <p className={`small mb-0 ${selectedModality === m.value ? "text-white-50" : "text-muted"}`}>{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-8 mb-4">
            <div className="card border shadow-sm">
              <div className="card-header font-weight-bold text-capitalize bg-light text-primary">
                Configure {selectedModality} Generation Modality
              </div>
              <div className="card-body">
                {config.providers.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted">You must add provider credentials before assigning models to modalities.</p>
                    <button className="btn btn-sm btn-primary" onClick={() => setActiveTab("providers")}>
                      Go to Credentials
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveIntegration}>
                    <div className="form-group">
                      <label className="font-weight-bold small">Assigned API Provider Key</label>
                      <select
                        className="form-control"
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
                      <div className="form-group">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="font-weight-bold small m-0">Target Model Name</label>
                          <div className="form-check m-0">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="custom-model-check"
                              checked={isCustomModel}
                              onChange={(e) => setIsCustomModel(e.target.checked)}
                            />
                            <label className="form-check-label small text-muted" htmlFor="custom-model-check">
                              Custom model path entry
                            </label>
                          </div>
                        </div>

                        {isCustomModel ? (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. gpt-4o-mini"
                            value={integrationModel}
                            onChange={(e) => setIntegrationModel(e.target.value)}
                          />
                        ) : (
                          <select
                            className="form-control"
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
                      <div className="form-group p-3 bg-light rounded border">
                        <span className="font-weight-bold small text-muted">Est. Token Price:</span>
                        <span className="badge badge-success ml-2 py-1 px-2 font-weight-bold">
                          {getModelPrice(integrationModel, integrationProviderId)}
                        </span>
                      </div>
                    )}

                    <button type="submit" className="btn btn-success px-4" disabled={saving}>
                      {saving ? "Saving..." : "Apply Integration Model"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAYGROUND TAB */}
      {activeTab === "playground" && config && (
        <div className="row">
          <div className="col-md-12 mb-4">
            <div className="card">
              <div className="card-header bg-secondary text-white font-weight-bold">Playground Modality Tester</div>
              <div className="card-body">
                <form onSubmit={handleTestPrompt}>
                  <div className="row mb-3">
                    <div className="col-md-4">
                      <label className="font-weight-bold small">Modality</label>
                      <select
                        className="form-control"
                        value={playgroundModality}
                        onChange={(e) => setPlaygroundModality(e.target.value)}
                      >
                        {MODALITIES.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group mb-3">
                    <textarea
                      className="form-control font-family-monospace"
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Write your test prompt here... e.g. 'Solve 15 * 12 and explain the solution.'"
                      disabled={testing}
                    ></textarea>
                  </div>

                  <div className="text-right">
                    <button
                      type="submit"
                      className="btn btn-success px-4"
                      disabled={testing || !prompt.trim()}
                    >
                      {testing ? "Generating..." : "Send Request"}
                    </button>
                  </div>
                </form>

                {(playgroundResponse || playgroundError || playgroundModelUsed) && (
                  <div className="mt-4 border-top pt-3">
                    <h6 className="font-weight-bold text-secondary mb-2">Result Console:</h6>
                    {playgroundModelUsed && (
                      <div className="small mb-2 text-muted">
                        🤖 <strong>Model resolved:</strong> <code>{playgroundModelUsed}</code>
                      </div>
                    )}
                    {playgroundError && (
                      <div className="p-3 bg-danger-light text-danger rounded border border-danger small">
                        <strong>Request failed:</strong> {playgroundError}
                      </div>
                    )}
                    {playgroundResponse && (
                      <div className="p-3 bg-light text-dark rounded border small whitespace-pre-wrap font-family-monospace shadow-sm">
                        {playgroundResponse}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
