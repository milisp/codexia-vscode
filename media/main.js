(function () {
  const vscode = acquireVsCodeApi();

  let messages = [];
  let isTyping = false;

  // DOM elements
  const messagesContainer = document.getElementById("messagesContainer");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const workingSection = document.getElementById("workingSection");
  const workingList = document.getElementById("workingList");

  // Initialize
  init();

  function init() {
    setupEventListeners();
    autoResizeTextarea();
    focusInput();
  }

  function setupEventListeners() {
    // Send button click
    sendButton.addEventListener("click", sendMessage);

    // Enter key to send (Shift+Enter for new line)
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    messageInput.addEventListener("input", autoResizeTextarea);

    // Listen for messages from extension
    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.type) {
        case "updateMessages":
          messages = message.messages;
          renderMessages();
          break;
        case "setTyping":
          isTyping = message.isTyping;
          updateTypingIndicator();
          break;
        case "focusInput":
          focusInput();
          break;
        case "updateWorkingTasks":
          updateWorkingTasks(message.tasks);
          break;
      }
    });
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isTyping) {
      return;
    }

    vscode.postMessage({
      type: "sendMessage",
      text: text,
    });

    messageInput.value = "";
    autoResizeTextarea();
  }

  function renderMessages() {
    messagesContainer.innerHTML = "";

    messages.forEach((message, index) => {
      const messageElement = createMessageElement(message, index);
      messagesContainer.appendChild(messageElement);
    });

    scrollToBottom();
  }

  function createMessageElement(message, index) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${message.type}`;

    // Add timeline connector for non-user messages
    if (message.type !== "user" && index > 0) {
      messageDiv.classList.add("timeline-item");
    }

    const headerDiv = document.createElement("div");
    headerDiv.className = "message-header";

    const typeLabel =
      message.type === "user"
        ? "You"
        : message.type === "assistant"
          ? "Codexia"
          : message.type === "exec-request"
            ? "Execution Request"
            : "System";
    const timestamp = new Date(message.timestamp).toLocaleTimeString();

    // Special handling for exec-request and system messages - make them collapsible
    if (message.type === "exec-request" || message.type === "system") {
      // console.log("Creating collapsible message:", message);
      const collapseId = `collapse-${message.id}`;

      const collapsibleHeader = document.createElement("div");
      collapsibleHeader.className = "collapsible-header";

      const iconSpan = document.createElement("span");
      iconSpan.className = "collapse-icon";
      iconSpan.textContent = "▶";

      const typeSpan = document.createElement("span");
      typeSpan.className = "message-type";
      typeSpan.textContent = typeLabel;

      collapsibleHeader.appendChild(iconSpan);
      collapsibleHeader.appendChild(typeSpan);

      collapsibleHeader.addEventListener("click", () => {
        toggleCollapse(collapseId);
        return false;
      });

      headerDiv.appendChild(collapsibleHeader);

      const contentDiv = document.createElement("div");
      contentDiv.className = "message-content collapsible-content collapsed";
      contentDiv.id = collapseId;
      contentDiv.innerHTML = formatMessageContent(message.content);

      // Add approval buttons for execution requests
      if (message.execRequestId) {
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "message-actions";
        
        const approveBtn = document.createElement("button");
        approveBtn.className = "approve-btn";
        approveBtn.textContent = "✓ Approve";
        approveBtn.addEventListener("click", () => {
          approveExecution(message.execRequestId, true);
        });

        const denyBtn = document.createElement("button");
        denyBtn.className = "deny-btn";
        denyBtn.textContent = "✗ Deny";
        denyBtn.addEventListener("click", () => {
          approveExecution(message.execRequestId, false);
        });

        actionsDiv.appendChild(approveBtn);
        actionsDiv.appendChild(denyBtn);

        contentDiv.appendChild(actionsDiv);
      }

      messageDiv.appendChild(headerDiv);
      messageDiv.appendChild(contentDiv);
    } else {
      const contentDiv = document.createElement("div");
      contentDiv.className = "message-content";
      contentDiv.innerHTML = formatMessageContent(message.content);

      messageDiv.appendChild(headerDiv);
      messageDiv.appendChild(contentDiv);
    }

    return messageDiv;
  }

  function formatMessageContent(content) {
    // Basic markdown-like formatting
    let formatted = content
      .replace(/\n/g, "<br>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/```([^```]+)```/g, "<pre><code>$1</code></pre>");

    return formatted;
  }

  function updateTypingIndicator() {
    const existingIndicator =
      messagesContainer.querySelector(".typing-indicator");

    if (isTyping) {
      if (!existingIndicator) {
        const typingDiv = document.createElement("div");
        typingDiv.className = "typing-indicator";
        typingDiv.innerHTML = `
					<span>Thinking</span>
					<div class="typing-dots">
						<div class="typing-dot"></div>
						<div class="typing-dot"></div>
						<div class="typing-dot"></div>
					</div>
				`;
        messagesContainer.appendChild(typingDiv);
        scrollToBottom();
      }
    } else {
      if (existingIndicator) {
        existingIndicator.remove();
      }
    }

    // Update send button state
    sendButton.disabled = isTyping;
  }

  function updateWorkingTasks(tasks) {
    if (tasks && tasks.length > 0) {
      workingList.innerHTML = "";
      tasks.forEach((task) => {
        const li = document.createElement("li");
        li.textContent = task;
        workingList.appendChild(li);
      });
      workingSection.style.display = "block";
    } else {
      workingSection.style.display = "none";
    }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function autoResizeTextarea() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
  }

  function focusInput() {
    setTimeout(() => {
      messageInput.focus();
    }, 100);
  }

  // Function to approve/deny execution requests
  window.approveExecution = function (requestId, approved) {
    vscode.postMessage({
      type: "approveExecution",
      requestId: requestId,
      approved: approved,
    });
  };

  // Function to toggle collapsible content
  window.toggleCollapse = function (collapseId) {
    const content = document.getElementById(collapseId);

    if (!content) {
      return;
    }

    const messageDiv = content.closest(".message");
    const icon = messageDiv ? messageDiv.querySelector(".collapse-icon") : null;

    const isCollapsed = content.classList.contains("collapsed");

    if (isCollapsed) {
      // Expand
      content.classList.remove("collapsed");
      if (icon) icon.textContent = "▼";
    } else {
      // Collapse
      content.classList.add("collapsed");
      if (icon) icon.textContent = "▶";
    }
  };

  // Expose functions for debugging
  window.codexiaChat = {
    sendMessage,
    focusInput,
    clearMessages: () => {
      vscode.postMessage({ type: "clearChat" });
    },
  };
})();
