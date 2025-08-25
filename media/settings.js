(function () {
  const vscode = acquireVsCodeApi();

  let currentConfig = {};
  let modelOptions = {};
  let providers = [];
  let approvalPolicies = [];
  let sandboxModes = [];

  // DOM elements
  const useOssCheckbox = document.getElementById("useOss");
  const modelSelect = document.getElementById("modelSelect");
  const customModelInput = document.getElementById("customModel");
  const providerSelect = document.getElementById("providerSelect");
  const providerGroup = document.getElementById("providerGroup");
  const approvalSelect = document.getElementById("approvalSelect");
  const sandboxSelect = document.getElementById("sandboxSelect");
  const customArgsTextarea = document.getElementById("customArgs");
  const commandPreview = document.getElementById("commandPreview");
  const saveButton = document.getElementById("saveButton");
  const resetButton = document.getElementById("resetButton");

  // Initialize
  init();

  function init() {
    setupEventListeners();
    requestInitialConfig();
  }

  function setupEventListeners() {
    // OSS mode toggle
    useOssCheckbox.addEventListener("change", () => {
      updateProviderVisibility();
      updateModelOptions();
      updateCommandPreview();
    });

    // Model selection
    modelSelect.addEventListener("change", () => {
      if (modelSelect.value === "custom") {
        customModelInput.style.display = "block";
        customModelInput.focus();
      } else {
        customModelInput.style.display = "none";
      }
      updateCommandPreview();
    });

    // Custom model input
    customModelInput.addEventListener("input", updateCommandPreview);

    // Provider selection
    providerSelect.addEventListener("change", () => {
      updateModelOptions();
      updateCommandPreview();
    });

    // Other controls
    approvalSelect.addEventListener("change", updateCommandPreview);
    sandboxSelect.addEventListener("change", updateCommandPreview);
    customArgsTextarea.addEventListener("input", updateCommandPreview);

    // Buttons
    saveButton.addEventListener("click", saveConfiguration);
    resetButton.addEventListener("click", resetConfiguration);

    // Listen for messages from extension
    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.type) {
        case "configData":
          handleConfigData(message);
          break;
      }
    });
  }

  function requestInitialConfig() {
    vscode.postMessage({ type: "getConfig" });
  }

  function handleConfigData(message) {
    currentConfig = message.config;
    modelOptions = message.modelOptions;
    providers = message.providers;
    approvalPolicies = message.approvalPolicies;
    sandboxModes = message.sandboxModes;

    populateUI();
  }

  function populateUI() {
    // Populate dropdowns
    populateSelect(providerSelect, providers, currentConfig.provider);
    populateSelect(
      approvalSelect,
      approvalPolicies,
      currentConfig.approvalPolicy,
    );
    populateSelect(sandboxSelect, sandboxModes, currentConfig.sandboxMode);

    // Set checkbox
    useOssCheckbox.checked = currentConfig.useOss;

    // Update model options and set current model
    updateModelOptions();
    if (currentConfig.model) {
      if (modelSelect.querySelector(`option[value="${currentConfig.model}"]`)) {
        modelSelect.value = currentConfig.model;
      } else {
        modelSelect.value = "custom";
        customModelInput.style.display = "block";
        customModelInput.value = currentConfig.model;
      }
    }

    // Set custom args
    if (currentConfig.customArgs && currentConfig.customArgs.length > 0) {
      customArgsTextarea.value = currentConfig.customArgs.join("\\n");
    }

    // Update UI state
    updateProviderVisibility();
    updateCommandPreview();
  }

  function populateSelect(selectElement, options, selectedValue) {
    // Keep the first option (placeholder)
    const firstOption = selectElement.firstElementChild;
    selectElement.innerHTML = "";
    selectElement.appendChild(firstOption);

    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = option;
      if (option === selectedValue) {
        optionElement.selected = true;
      }
      selectElement.appendChild(optionElement);
    });
  }

  function updateProviderVisibility() {
    if (useOssCheckbox.checked) {
      providerGroup.style.display = "none";
    } else {
      providerGroup.style.display = "flex";
    }
  }

  function updateModelOptions() {
    // Clear existing options except placeholder
    const firstOption = modelSelect.firstElementChild;
    modelSelect.innerHTML = "";
    modelSelect.appendChild(firstOption);

    let availableModels = [];

    if (useOssCheckbox.checked) {
      // OSS mode - show Ollama models
      availableModels = modelOptions.ollama || [];
    } else {
      // Non-OSS mode - show models for selected provider
      const selectedProvider = providerSelect.value;
      if (selectedProvider && modelOptions[selectedProvider]) {
        availableModels = modelOptions[selectedProvider];
      }
    }

    // Add model options
    availableModels.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });

    // Add custom option
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "Custom model...";
    modelSelect.appendChild(customOption);
  }

  function updateCommandPreview() {
    const args = ["codex"];

    if (useOssCheckbox.checked) {
      args.push("--oss");
    }

    // Model
    const model =
      modelSelect.value === "custom"
        ? customModelInput.value
        : modelSelect.value;
    if (model && model !== "custom") {
      args.push("-m", model);
    }

    // Provider (only if not OSS)
    if (!useOssCheckbox.checked && providerSelect.value) {
      args.push("-c", `model_provider=${providerSelect.value}`);
    }

    // Approval policy
    if (approvalSelect.value) {
      args.push("-c", `approval_policy=${approvalSelect.value}`);
    }

    // Sandbox mode
    if (sandboxSelect.value) {
      args.push("-c", `sandbox_mode=${sandboxSelect.value}`);
    }

    // Custom args
    const customArgs = customArgsTextarea.value.trim();
    if (customArgs) {
      const customArgsArray = customArgs
        .split("\\n")
        .filter((arg) => arg.trim());
      args.push(...customArgsArray);
    }

    args.push("proto");

    commandPreview.textContent = args.join(" ");
  }

  function saveConfiguration() {
    const config = {
      useOss: useOssCheckbox.checked,
      model:
        modelSelect.value === "custom"
          ? customModelInput.value
          : modelSelect.value,
      provider: providerSelect.value,
      approvalPolicy: approvalSelect.value,
      sandboxMode: sandboxSelect.value,
      customArgs: customArgsTextarea.value.trim()
        ? customArgsTextarea.value.split("\\n").filter((arg) => arg.trim())
        : [],
    };

    vscode.postMessage({
      type: "updateConfig",
      config: config,
    });
  }

  function resetConfiguration() {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      vscode.postMessage({ type: "resetConfig" });
    }
  }

  // Expose functions for debugging
  window.codexiaSettings = {
    saveConfiguration,
    resetConfiguration,
    updateCommandPreview,
  };
})();
