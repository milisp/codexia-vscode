#!/usr/bin/env node

const { spawn } = require('child_process');

async function testOssConfiguration() {
    console.log('🧪 Testing OSS Configuration Specifically...\n');
    
    // Test the exact configuration you want
    const command = 'codex';
    const args = ['--oss', '-m', 'llama3.2', 'proto'];
    
    console.log('🚀 Command:', command, args.join(' '));
    
    try {
        const codexProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdoutBuffer = '';
        let sessionConfigured = false;
        
        // Handle stdout
        codexProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdoutBuffer += chunk;
            
            // Process complete lines
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const event = JSON.parse(line.trim());
                        console.log('📨 Event:', JSON.stringify(event, null, 2));
                        
                        if (event.msg.type === 'session_configured') {
                            sessionConfigured = true;
                            console.log('✅ Session configured!');
                            console.log(`   Model: ${event.msg.model}`);
                            console.log(`   Session ID: ${event.msg.session_id}`);
                            
                            // Check if the model matches what we expect
                            if (event.msg.model === 'llama3.2') {
                                console.log('🎯 ✅ Model configuration is CORRECT!');
                            } else {
                                console.log(`❌ Model mismatch! Expected: llama3.2, Got: ${event.msg.model}`);
                                console.log('💡 This suggests the configuration is not being applied properly.');
                            }
                            
                            // Close the process after checking
                            setTimeout(() => {
                                codexProcess.kill('SIGTERM');
                            }, 1000);
                        }
                    } catch (error) {
                        console.log('📝 Raw line:', line);
                    }
                }
            }
        });
        
        // Handle stderr
        codexProcess.stderr.on('data', (data) => {
            const errorText = data.toString();
            console.log('stderr:', errorText);
            
            // Check for specific errors
            if (errorText.includes('Could not find codex executable')) {
                console.log('❌ Codex CLI not found in PATH');
            } else if (errorText.includes('Connection refused')) {
                console.log('❌ Cannot connect to Ollama. Is it running?');
                console.log('💡 Try: ollama serve');
            } else if (errorText.includes('model not found')) {
                console.log('❌ Model llama3.2 not found in Ollama');
                console.log('💡 Try: ollama pull llama3.2');
            }
        });
        
        // Handle close
        codexProcess.on('close', (code) => {
            console.log(`\n🏁 Process closed with code: ${code}`);
            
            if (!sessionConfigured) {
                console.log('❌ Session was never configured. Possible issues:');
                console.log('   1. Codex CLI not properly installed');
                console.log('   2. Ollama not running (try: ollama serve)');
                console.log('   3. Model not available (try: ollama pull llama3.2)');
                console.log('   4. Configuration syntax error');
            }
        });
        
        // Handle error
        codexProcess.on('error', (error) => {
            console.error('❌ Process error:', error.message);
            if (error.message.includes('ENOENT')) {
                console.log('💡 Codex CLI not found. Make sure it\'s installed and in PATH.');
            }
        });
        
        // Kill after timeout
        setTimeout(() => {
            if (!codexProcess.killed) {
                console.log('\n⏰ Test timeout, terminating...');
                codexProcess.kill('SIGTERM');
            }
        }, 15000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testOssConfiguration();