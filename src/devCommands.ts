import * as vscode from "vscode";
import { DiffViewerManager } from "./diffViewer";

export function registerDevCommands(context: vscode.ExtensionContext) {
  const diffViewer = DiffViewerManager.getInstance();

  // Test command for diff functionality (development only)
  const testDiffCommand = vscode.commands.registerCommand(
    "codexia.testDiff",
    async () => {
      const testDiff = `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1,4 +1,5 @@
 # My Project

+This is a new line added by Codex
 Welcome to my project.
 This is the second line.
@@ -10,7 +11,8 @@ Another section here.

 ## Features

-- Feature 1
+- Updated Feature 1
+- New Feature 2
- Feature 3

diff --git a/newfile.js b/newfile.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/newfile.js
@@ -0,0 +1,3 @@
+console.log("Hello World");
+const x = 42;
+export default x;`;
      
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      await diffViewer.showDiff(testDiff, workspaceRoot);
    },
  );

  context.subscriptions.push(testDiffCommand);
}
