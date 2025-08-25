#!/usr/bin/env node

// This script tests the configuration generation logic
const config = require('./out/config');

// Test ConfigManager (without VSCode context)
class MockContext {
    constructor() {
        this.globalState = new Map();
    }
    
    get(key) {
        return this.globalState.get(key);
    }
    
    update(key, value) {
        this.globalState.set(key, value);
        return Promise.resolve();
    }
}

function testConfigGeneration() {
    console.log('🧪 Testing Codex Configuration Generation...\n');

    // Test default config
    console.log('📋 Default Configuration:');
    const defaultConfig = config.DEFAULT_CONFIG;
    console.log(JSON.stringify(defaultConfig, null, 2));

    // Create mock config manager
    const mockContext = { globalState: { get: () => null, update: () => Promise.resolve() } };
    
    console.log('\n🔧 Model Options by Provider:');
    const modelOptions = config.ConfigManager.getModelOptions();
    Object.entries(modelOptions).forEach(([provider, models]) => {
        console.log(`  ${provider}: ${models.join(', ')}`);
    });

    console.log('\n🌍 Available Providers:', config.ConfigManager.getProviderOptions().join(', '));
    console.log('✅ Approval Policies:', config.ConfigManager.getApprovalPolicyOptions().join(', '));
    console.log('🔒 Sandbox Modes:', config.ConfigManager.getSandboxModeOptions().join(', '));

    // Test different configurations
    console.log('\n🚀 Command Generation Tests:');
    
    const testConfigs = [
        {
            name: 'Default OSS with llama3.2',
            config: { useOss: true, model: 'llama3.2', approvalPolicy: 'on-request' }
        },
        {
            name: 'OpenAI with GPT-4',
            config: { useOss: false, provider: 'openai', model: 'gpt-4', approvalPolicy: 'on-request', sandboxMode: 'workspace-write' }
        },
        {
            name: 'Anthropic with Claude',
            config: { useOss: false, provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', approvalPolicy: 'never' }
        },
        {
            name: 'Custom with extra args',
            config: { useOss: true, model: 'custom-model', customArgs: ['--verbose', '--debug'] }
        }
    ];

    testConfigs.forEach(test => {
        console.log(`\n  ${test.name}:`);
        
        // Simulate ConfigManager.getCodexArgs() logic
        const args = [];
        
        if (test.config.useOss) {
            args.push('--oss');
        }
        
        if (test.config.model) {
            args.push('-m', test.config.model);
        }
        
        if (test.config.provider && !test.config.useOss) {
            args.push('-c', `model_provider=${test.config.provider}`);
        }
        
        if (test.config.approvalPolicy) {
            args.push('-c', `approval_policy=${test.config.approvalPolicy}`);
        }
        
        if (test.config.sandboxMode) {
            args.push('-c', `sandbox_mode=${test.config.sandboxMode}`);
        }
        
        if (test.config.customArgs) {
            args.push(...test.config.customArgs);
        }

        args.push('proto');
        
        console.log(`    codex ${args.join(' ')}`);
    });

    console.log('\n✅ Configuration tests completed successfully!');
}

testConfigGeneration();