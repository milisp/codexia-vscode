#!/usr/bin/env node

const { spawn } = require('child_process');

async function testFixedConfiguration() {
    console.log('🧪 Testing Fixed OSS Configuration...\n');
    
    // Test the corrected configuration
    const command = 'codex';
    const args = ['--oss', '-c', 'model=llama3.2', 'proto'];
    
    console.log('🚀 Fixed Command:', command, args.join(' '));
    
    try {
        const codexProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdoutBuffer = '';
        
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
                        
                        if (event.msg.type === 'session_configured') {
                            console.log('✅ Session configured successfully!');
                            console.log(`   📱 Model: ${event.msg.model}`);
                            console.log(`   🆔 Session ID: ${event.msg.session_id}`);
                            
                            if (event.msg.model === 'llama3.2') {
                                console.log('🎯 ✅ Model configuration is PERFECT!');
                                console.log('📋 This configuration should work in your VSCode extension.');
                            } else {
                                console.log(`❌ Still wrong model. Expected: llama3.2, Got: ${event.msg.model}`);
                            }
                            
                            // Test sending a message
                            const testSubmission = {
                                id: 'test-' + Date.now(),
                                op: {
                                    type: 'user_input',
                                    items: [{ type: 'text', text: 'Hello! Just testing the connection.' }]
                                }
                            };
                            
                            console.log('📤 Sending test message...');
                            codexProcess.stdin.write(JSON.stringify(testSubmission) + '\n');
                            
                            // Close after a short delay
                            setTimeout(() => {
                                codexProcess.kill('SIGTERM');
                            }, 3000);
                        }
                        
                        if (event.msg.type === 'task_started') {
                            console.log('🚀 Task started successfully!');
                        }
                        
                        if (event.msg.type === 'agent_message_delta') {
                            process.stdout.write(event.msg.delta || '');
                        }
                        
                        if (event.msg.type === 'agent_message') {
                            console.log('\n📝 Agent response received!');
                        }
                        
                    } catch (error) {
                        console.log('📝 Raw line:', line);
                    }
                }
            }
        });
        
        // Handle stderr
        codexProcess.stderr.on('data', (data) => {
            console.log('stderr:', data.toString());
        });
        
        // Handle close
        codexProcess.on('close', (code) => {
            console.log(`\n🏁 Process closed with code: ${code}`);
        });
        
        // Handle error
        codexProcess.on('error', (error) => {
            console.error('❌ Process error:', error.message);
        });
        
        // Kill after timeout
        setTimeout(() => {
            if (!codexProcess.killed) {
                console.log('\n⏰ Test complete, terminating...');
                codexProcess.kill('SIGTERM');
            }
        }, 10000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testFixedConfiguration();