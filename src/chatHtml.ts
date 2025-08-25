import * as vscode from "vscode";

export function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri, nonce: string) {
  const styleResetUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "reset.css"),
  );
  const styleVSCodeUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "vscode.css"),
  );
  const styleMainUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "main.css"),
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "main.js"),
  );

  return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <title>Codexia Chat</title>
      </head>
      <body>
        <div class="container">
          <div class="working-section" id="workingSection" style="display: none;">
            <h3>Working</h3>
            <ul id="workingList">
            </ul>
          </div>

          <div class="messages-container" id="messagesContainer">
            <!-- Messages will be inserted here -->
          </div>

          <div class="input-container">
            <div class="input-wrapper">
              <textarea 
                id="messageInput" 
                placeholder="Ask Codex to do anything"
                rows="1"
              ></textarea>
              <button id="sendButton" class="send-button">
                <span class="send-icon">▶</span>
              </button>
            </div>
          </div>
        </div>

        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
}

export function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
