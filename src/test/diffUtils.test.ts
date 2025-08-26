import { parseUnifiedDiff, createChangeSummary, FileChange } from '../diffUtils';

// Test data - sample unified diff from git
const sampleDiff = `diff --git a/README.md b/README.md
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
 
 ## Installation`;

const newFileDiff = `diff --git a/newfile.js b/newfile.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/newfile.js
@@ -0,0 +1,3 @@
+console.log("Hello World");
+const x = 42;
+export default x;`;

const deletedFileDiff = `diff --git a/oldfile.txt b/oldfile.txt
deleted file mode 100644
index abcdefg..0000000
--- a/oldfile.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-This file will be deleted
-Second line`;

function runTests() {
  console.log('Testing parseUnifiedDiff...');
  
  // Test 1: Parse modified file
  console.log('\n1. Testing modified file parsing:');
  const modifiedFiles = parseUnifiedDiff(sampleDiff);
  console.log('Number of files:', modifiedFiles.length);
  console.log('File path:', modifiedFiles[0]?.filePath);
  console.log('Change type:', modifiedFiles[0]?.changeType);
  console.log('Number of hunks:', modifiedFiles[0]?.hunks.length);
  console.log('Is modified:', modifiedFiles[0]?.isModified);
  
  // Test 2: Parse new file
  console.log('\n2. Testing new file parsing:');
  const newFiles = parseUnifiedDiff(newFileDiff);
  console.log('Number of files:', newFiles.length);
  console.log('File path:', newFiles[0]?.filePath);
  console.log('Change type:', newFiles[0]?.changeType);
  console.log('Is added:', newFiles[0]?.isAdded);
  
  // Test 3: Parse deleted file
  console.log('\n3. Testing deleted file parsing:');
  const deletedFiles = parseUnifiedDiff(deletedFileDiff);
  console.log('Number of files:', deletedFiles.length);
  console.log('File path:', deletedFiles[0]?.filePath);
  console.log('Change type:', deletedFiles[0]?.changeType);
  console.log('Is deleted:', deletedFiles[0]?.isDeleted);
  
  // Test 4: Test summary creation
  console.log('\n4. Testing change summary:');
  const allChanges: FileChange[] = [...modifiedFiles, ...newFiles, ...deletedFiles];
  const summary = createChangeSummary(allChanges);
  console.log('Summary:', summary);
  
  // Test 5: Combined diff
  console.log('\n5. Testing combined diff parsing:');
  const combinedDiff = sampleDiff + '\n' + newFileDiff + '\n' + deletedFileDiff;
  const combinedFiles = parseUnifiedDiff(combinedDiff);
  console.log('Total files in combined diff:', combinedFiles.length);
  console.log('Combined summary:', createChangeSummary(combinedFiles));
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export { runTests };