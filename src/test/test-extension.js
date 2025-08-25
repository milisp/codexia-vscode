#!/usr/bin/env node

const { CodexService } = require('./out/codexService');

async function testCodexService() {
    console.log('Testing Codex Service...');
    
    const codexService = new CodexService();
    
    try {
        // Test if Codex is available
        console.log('Checking if Codex is available...');
        const isAvailable = await codexService.isCodexAvailable();
        console.log(`Codex available: ${isAvailable}`);
        
        if (isAvailable) {
            // Get version
            console.log('Getting Codex version...');
            const version = await codexService.getCodexVersion();
            console.log(`Codex version: ${version}`);
            
            // Test a simple message
            console.log('Testing simple message...');
            const response = await codexService.sendMessage('echo "Hello from Codex!"');
            console.log(`Codex response: ${response}`);
        }
        
    } catch (error) {
        console.error('Error testing Codex service:', error.message);
    }
}

testCodexService();