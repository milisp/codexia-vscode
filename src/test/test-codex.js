#!/usr/bin/env node

const { spawn } = require('child_process');

async function testCodex() {
    console.log('Testing Codex CLI integration...\n');
    
    // Test 1: Check if codex is available
    console.log('1. Testing codex availability...');
    try {
        const version = await runCommand('codex', ['-V']);
        console.log(`✅ Codex CLI found: ${version.trim()}`);
    } catch (error) {
        console.log(`❌ Codex CLI not found: ${error.message}`);
        return;
    }
    
    // Test 2: Test help command
    console.log('\n2. Testing help command...');
    try {
        const help = await runCommand('codex', ['-h']);
        console.log(`✅ Help command works (${help.length} characters)`);
    } catch (error) {
        console.log(`❌ Help command failed: ${error.message}`);
    }
    
    // Test 3: Test exec command with simple shell command
    console.log('\n3. Testing exec command...');
    try {
        const result = await runCommand('codex', ['exec', 'Write a simple "Hello World" message'], 15000);
        console.log(`✅ Exec command works:\n${result.substring(0, 500)}...`);
    } catch (error) {
        console.log(`❌ Exec command failed: ${error.message}`);
    }
    
    console.log('\n📊 Codex CLI integration test completed!');
}

function runCommand(command, args, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { 
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || `Command failed with exit code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            reject(new Error(`Failed to start command: ${error.message}`));
        });
        
        // Set timeout
        setTimeout(() => {
            if (!child.killed) {
                child.kill('SIGTERM');
                reject(new Error('Command timed out'));
            }
        }, timeout);
    });
}

testCodex().catch(console.error);