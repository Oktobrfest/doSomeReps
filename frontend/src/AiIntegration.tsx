import React, { useState, useEffect } from "react";

interface AIConfig {
  provider: string;
  model: string;
  apiBase: string;
  hasKey: boolean;
  maskedKey: string;
  predefinedOptions: Record<string, string[]>;
  modelPrices?: Record<string, string>;
}

export default function AiIntegration() {
  const [activeTab, setActiveTab] = useState<"status" | "config" | "playground">("status");
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [formProvider, setFormProvider] = useState<string>("");
  const [formModel, setFormModel] = useState<string>("");
  const [formApiBase, setFormApiBase] = useState<string>("");
  const [formApiKey, setFormApiKey] = useState<string>("");
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [currentModelPrice, setCurrentModelPrice] = useState<string>("N/A");

  // Playground states
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

      // Initialize form fields
      setFormProvider(data.provider);
      setFormApiBase(data.apiBase);

      // Check if current model is in standard options
      const stdModels = data.predefinedOptions[data.provider] || [];
      if (data.model && !stdModels.includes(data.model)) {
        setIsCustomModel(true);
      } else {
        setIsCustomModel(false);
      }
      setFormModel(data.model);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred while fetching settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Helper function to get model price with normalization and debugging
  const getModelPrice = (modelName: string, providerName: string): string => {
    console.log('=== GET MODEL PRICE DEBUG ===');
    console.log('Input - Model:', modelName, 'Provider:', providerName);
    
    if (!config?.modelPrices) {
      console.log('No modelPrices in config');
      return "N/A";
    }
    
    console.log('Available prices:', config.modelPrices);
    
    // Normalize to lowercase for matching
    const normalizedModel = (modelName || "").trim().toLowerCase();
    const normalizedProvider = (providerName || "").trim().toLowerCase();
    
    console.log('Normalized - Model:', normalizedModel, 'Provider:', normalizedProvider);
    
    // Try multiple lookup strategies
    const lookupKeys = [
      modelName, // Original case
      normalizedModel, // Lowercase
      `${providerName}/${modelName}`, // With provider prefix
      `${normalizedProvider}/${normalizedModel}`, // Lowercase with provider
      modelName.split('/').pop() || modelName, // Just the model part after /
      (modelName.split('/').pop() || modelName).toLowerCase(), // Lowercase model part
    ];
    
    console.log('Trying lookup keys:', lookupKeys);
    
    for (const key of lookupKeys) {
      // Try exact match
      if (config.modelPrices[key]) {
        console.log('✓ Found price with key:', key, '→', config.modelPrices[key]);
        return config.modelPrices[key];
      }
      
      // Try case-insensitive match
      const lowerKey = key.toLowerCase();
      for (const [priceKey, priceValue] of Object.entries(config.modelPrices)) {
        if (priceKey.toLowerCase() === lowerKey) {
          console.log('✓ Found price with case-insensitive match:', priceKey, '→', priceValue);
          return priceValue;
        }
      }
    }
    
    console.log('✗ No price found for model');
    return "N/A";
  };

  // Update model price whenever formModel or formProvider changes
  useEffect(() => {
    console.log('=== MODEL PRICE EFFECT TRIGGERED ===');
    console.log('formModel:', formModel);
    console.log('formProvider:', formProvider);
    
    if (formModel && config) {
      const price = getModelPrice(formModel, formProvider);
      console.log('Setting currentModelPrice to:', price);
      setCurrentModelPrice(price);
    } else {
      console.log('Model or config not ready, setting N/A');
      setCurrentModelPrice("N/A");
    }
  }, [formModel, formProvider, config]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prov = e.target.value;
    console.log('=== PROVIDER CHANGED ===');
    console.log('New provider:', prov);
    setFormProvider(prov);

    // Auto-select first standard model or empty for custom
    if (config?.predefinedOptions[prov] && config.predefinedOptions[prov].length > 0) {
      const firstModel = config.predefinedOptions[prov][0];
      console.log('Auto-selecting first model:', firstModel);
      setFormModel(firstModel);
      setIsCustomModel(false);
    } else {
      console.log('No predefined models, using custom');
      setFormModel("");
      setIsCustomModel(true);
    }
  };

  const handleModelChange = (newModel: string) => {
    console.log('=== MODEL CHANGED ===');
    console.log('New model:', newModel);
    setFormModel(newModel);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setError(null);

    try {
      const res = await fetch("/integration/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formProvider,
          model: formModel,
          apiBase: formApiBase,
          apiKey: formApiKey,
        }),
      });

      let result;
      try {
        result = await res.json();
      } catch (jsonErr) {
        throw new Error(`Failed to save configuration: Server returned a non-JSON response (Status: ${res.status}).`);
      }

      if (res.ok && result.success) {
        setSuccessMsg(result.message || "Configuration saved successfully!");
        setFormApiKey(""); // Clear password field
        // Refresh local config state
        await fetchConfig();
      } else {
        throw new Error(result.error || "Failed to save configuration.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!window.confirm("Are you sure you want to delete the saved API key?")) {
      return;
    }
    setSaving(true);
    setSuccessMsg(null);
    setError(null);

    try {
      const res = await fetch("/integration/api/config/key", {
        method: "DELETE",
      });

      let result;
      try {
        result = await res.json();
      } catch (jsonErr) {
        throw new Error(`Failed to delete key: Server returned a non-JSON response (Status: ${res.status}).`);
      }

      if (res.ok && result.success) {
        setSuccessMsg(result.message || "API key deleted successfully!");
        setFormApiKey("");
        await fetchConfig();
      } else {
        throw new Error(result.error || "Failed to delete API key.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting the key.");
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
        body: JSON.stringify({ prompt }),
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Failed to generate completion: Server returned a non-JSON response (Status: ${res.status}).`);
      }

      if (res.ok && data.success) {
        setPlaygroundResponse(data.response);
        setPlaygroundModelUsed(data.model_used);
      } else {
        throw new Error(data.error || "Failed to generate completion.");
      }
    } catch (err: any) {
      setPlaygroundError(err.message || "An unexpected error occurred during the request.");
    } finally {
      setTesting(false);
    }
  };

  const loadPreset = (preset: string) => {
    switch (preset) {
      case "translate":
        setPrompt("Translate the following sentence into French, Spanish, and German:\n'Knowledge is power, but practice makes perfect.'");
        break;
      case "summarize":
        setPrompt("Summarize the main benefit of using LiteLLM in a single, punchy paragraph.");
        break;
      case "quiz":
        setPrompt("Generate 3 multiple-choice study questions about basic Flask routing with correct answers indicated.");
        break;
      case "greet":
        setPrompt("Say a friendly hello and let me know what model you are!");
        break;
      default:
        break;
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
            <i className="fa fa-plug mr-2"></i>AI Integration Engine
          </h2>
        </div>
      </div>

      {/* Navigation tabs */}
      <ul className="nav nav-pills mb-4">
        <li className="nav-item">
          <button
            className={`nav-link border-0 ${activeTab === "status" ? "active bg-primary text-white" : "bg-light text-dark mr-2"}`}
            onClick={() => setActiveTab("status")}
          >
            <i className="fa fa-dashboard mr-1"></i> Status & Info
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link border-0 ${activeTab === "config" ? "active bg-primary text-white" : "bg-light text-dark mr-2"}`}
            onClick={() => {
              setActiveTab("config");
              setSuccessMsg(null);
            }}
          >
            <i className="fa fa-gears mr-1"></i> Configurator
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link border-0 ${activeTab === "playground" ? "active bg-primary text-white" : "bg-light text-dark"}`}
            onClick={() => {
              setActiveTab("playground");
              setPlaygroundError(null);
              setPlaygroundResponse(null);
            }}
          >
            <i className="fa fa-flask mr-1"></i> Playground Tester
          </button>
        </li>
      </ul>

      {/* Global Errors / Messages */}
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

      {/* TAB CONTENTS */}

      {/* Tab: Status & Info */}
      {activeTab === "status" && config && (
        <div className="row">
          <div className="col-12 mb-4">
            <div className="card border-primary">
              <div className="card-header bg-primary text-white font-weight-bold">
                <i className="fa fa-info-circle mr-2"></i>Connection Summary
              </div>
              <div className="card-body">
                <table className="table table-borderless m-0">
                  <tbody>
                    <tr>
                      <th className="pl-0 text-muted" style={{ width: "25%" }}>AI Provider:</th>
                      <td>
                        {config.provider ? (
                          <span className="badge badge-info px-2 py-1 font-weight-bold">
                            {config.provider.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-danger italic">Not Set</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th className="pl-0 text-muted">Model ID:</th>
                      <td>
                        {config.model ? (
                          <code className="text-dark font-weight-bold">{config.model}</code>
                        ) : (
                          <span className="text-danger italic">Not Set</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th className="pl-0 text-muted">API Base URL:</th>
                      <td>
                        {config.apiBase ? (
                          <code className="text-secondary small">{config.apiBase}</code>
                        ) : (
                          <span className="text-muted italic">Default endpoint</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th className="pl-0 text-muted">Credential Key:</th>
                      <td>
                        {config.hasKey ? (
                          <span className="text-success font-weight-bold">
                            <i className="fa fa-check-circle mr-1"></i> Configured ({config.maskedKey})
                          </span>
                        ) : (
                          <span className="text-danger font-weight-bold">
                            <i className="fa fa-times-circle mr-1"></i> Missing Key
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-4 p-3 bg-light rounded text-center">
                  <span className="text-muted d-block small mb-2">Need to verify connection or update endpoints?</span>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => setActiveTab("config")}>
                      <i className="fa fa-edit mr-1"></i>Edit Configuration
                    </button>
                    {config.hasKey && config.model && (
                      <button className="btn btn-sm btn-outline-success" onClick={() => setActiveTab("playground")}>
                        <i className="fa fa-play mr-1"></i>Run Playground Test
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Configuration */}
      {activeTab === "config" && config && (
        <div className="card border-0 shadow-sm">
          <div className="card-body bg-light rounded border">
            <h5 className="font-weight-bold text-dark mb-4 border-bottom pb-2">
              Configure Connection Settings
            </h5>
            <form onSubmit={handleSaveConfig}>
              <div className="row">
                {/* Provider Dropdown */}
                <div className="col-md-4 form-group">
                  <label htmlFor="provider-select" className="font-weight-bold small text-secondary">
                    AI Provider
                  </label>
                  <select
                    id="provider-select"
                    className="form-control"
                    value={formProvider}
                    onChange={handleProviderChange}
                  >
                    <option value="">-- Select Provider --</option>
                    {Object.keys(config.predefinedOptions).map((prov) => (
                      <option key={prov} value={prov}>
                        {prov.toUpperCase()}
                      </option>
                    ))}
                    <option value="custom">CUSTOM / OTHER</option>
                  </select>
                  <small className="form-text text-muted">
                    Select a predefined provider, or select custom to specify full paths.
                  </small>
                </div>

                {/* Model ID Selection */}
                <div className="col-md-4 form-group">
                  <div className="d-flex justify-content-between align-items-center">
                    <label htmlFor="model-input" className="font-weight-bold small text-secondary m-0">
                      Model ID
                    </label>
                    <div className="form-check m-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="custom-model-check"
                        checked={isCustomModel}
                        onChange={(e) => {
                          setIsCustomModel(e.target.checked);
                          if (!e.target.checked && config.predefinedOptions[formProvider]?.length > 0) {
                            setFormModel(config.predefinedOptions[formProvider][0]);
                          }
                        }}
                      />
                      <label className="form-check-label small text-muted" htmlFor="custom-model-check">
                        Custom entry
                      </label>
                    </div>
                  </div>

                  {isCustomModel ? (
                    <input
                      id="model-input"
                      type="text"
                      className="form-control mt-1"
                      placeholder="e.g. anthropic/claude-3-5-sonnet-20240620"
                      value={formModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                    />
                  ) : (
                    <select
                      id="model-input"
                      className="form-control mt-1"
                      value={formModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                    >
                      {(config.predefinedOptions[formProvider] || []).map((mod) => (
                        <option key={mod} value={mod}>
                          {mod}
                        </option>
                      ))}
                      {(!config.predefinedOptions[formProvider] || config.predefinedOptions[formProvider].length === 0) && (
                        <option value="">No standard models available (check custom)</option>
                      )}
                    </select>
                  )}
                  <small className="form-text text-muted">
                    Identifier passed directly to the model selector.
                  </small>
                </div>

                {/* Model Price Column */}
                <div className="col-md-4 form-group">
                  <label htmlFor="model-price-display" className="font-weight-bold small text-secondary">
                    Model Price
                  </label>
                  <input
                    id="model-price-display"
                    type="text"
                    className="form-control mt-1"
                    readOnly
                    value={currentModelPrice}
                    style={{ backgroundColor: currentModelPrice !== "N/A" ? "#e7f5e7" : "#f8f9fa" }}
                  />
                  <small className="form-text text-muted">
                    {currentModelPrice !== "N/A" ? "LiteLLM pricing data" : "No pricing data available"}
                  </small>
                </div>
              </div>

              <div className="row mt-3">
                {/* API Base URL */}
                <div className="col-md-12 form-group">
                  <label htmlFor="api-base-input" className="font-weight-bold small text-secondary">
                    API Base URL (Optional)
                  </label>
                  <input
                    id="api-base-input"
                    type="text"
                    className="form-control"
                    placeholder="e.g. http://localhost:11434/v1 or custom proxy endpoint"
                    value={formApiBase}
                    onChange={(e) => setFormApiBase(e.target.value)}
                  />
                  <small className="form-text text-muted">
                    Only required for custom proxies, self-hosted Ollama setups, or private enterprise endpoints.
                  </small>
                </div>
              </div>

              <div className="row mt-3">
                {/* API Key Input */}
                <div className="col-md-12 form-group">
                  <label htmlFor="api-key-input" className="font-weight-bold small text-secondary">
                    {config.hasKey ? "Update API Key / Secret" : "API Key / Secret"}
                  </label>
                  <input
                    id="api-key-input"
                    type="password"
                    className="form-control"
                    placeholder={config.hasKey ? "•••••••••••••••• (Leave blank to keep existing key)" : "Enter API authentication key"}
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                  />
                  <small className="form-text text-muted">
                    Your key will be securely stored and encrypted in the database.
                  </small>
                </div>
              </div>

              <div className="border-top pt-4 mt-4 d-flex justify-content-between">
                {config.hasKey ? (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={handleDeleteKey}
                    disabled={saving}
                  >
                    <i className="fa fa-trash mr-2"></i>Delete Key
                  </button>
                ) : (
                  <div></div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary px-4"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fa fa-save mr-2"></i>Save Configuration
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Playground */}
      {activeTab === "playground" && config && (
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="card h-100 border-secondary">
              <div className="card-header bg-secondary text-white font-weight-bold small py-2">
                <i className="fa fa-magic mr-1"></i>Preset Helpers
              </div>
              <div className="card-body">
                <p className="small text-muted">
                  Use one of these preset prompt tasks to instantly load a validation test payload:
                </p>
                <div className="list-group">
                  <button
                    type="button"
                    className="list-group-item list-group-item-action py-2 text-left small"
                    onClick={() => loadPreset("greet")}
                  >
                    👋 Simple Connection Greeting
                  </button>
                  <button
                    type="button"
                    className="list-group-item list-group-item-action py-2 text-left small"
                    onClick={() => loadPreset("translate")}
                  >
                    🌎 Translate Sentence
                  </button>
                  <button
                    type="button"
                    className="list-group-item list-group-item-action py-2 text-left small"
                    onClick={() => loadPreset("summarize")}
                  >
                    📝 Summary Analysis
                  </button>
                  <button
                    type="button"
                    className="list-group-item list-group-item-action py-2 text-left small"
                    onClick={() => loadPreset("quiz")}
                  >
                    🧠 Sample Quiz Questions
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-8 mb-4">
            <div className="card h-100">
              <div className="card-body">
                <h5 className="font-weight-bold text-dark mb-3">AI Playground</h5>

                {!config.hasKey && (
                  <div className="alert alert-warning mb-3 small">
                    <i className="fa fa-exclamation-triangle mr-2"></i>
                    You have not configured an API Key. Please configure your key in the <strong>Configurator</strong> tab before testing.
                  </div>
                )}

                <form onSubmit={handleTestPrompt}>
                  <div className="form-group mb-3">
                    <textarea
                      className="form-control font-family-monospace"
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Write your test prompt here... e.g. 'Solve 15 * 12 and explain the solution.'"
                      disabled={testing || !config.hasKey}
                    ></textarea>
                  </div>
                  <div className="text-right">
                    <button
                      type="submit"
                      className="btn btn-success px-4"
                      disabled={testing || !prompt.trim() || !config.hasKey}
                    >
                      {testing ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2" aria-hidden="true"></span>
                          Generating...
                        </>
                      ) : (
                        <>
                          <i className="fa fa-paper-plane mr-2"></i>Send Request
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Response Block */}
                {(playgroundResponse || playgroundError || playgroundModelUsed) && (
                  <div className="mt-4 border-top pt-3">
                    <h6 className="font-weight-bold text-secondary mb-2">
                      Result Console:
                    </h6>

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
