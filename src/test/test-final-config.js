#!/usr/bin/env node

const { spawn } = require('child_process');

async function testFinalConfiguration() {
    console.log('🧪 Testing Final Corrected OSS Configuration...\n');
    
    // Test the fully corrected configuration
    const command = 'codex';
    const args = ['--oss', '-c', 'model_provider=oss', '-c', 'model=llama3.2', 'proto'];
    
    console.log('🚀 Final Command:', command, args.join(' '));
    
    try {
        const codexProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdoutBuffer = '';
        let responseReceived = false;
        
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
                        console.log(`📨 Event [${event.msg.type}]:`, JSON.stringify(event, null, 2));
                        
                        if (event.msg.type === 'session_configured') {
                            console.log('✅ Session configured!');
                            console.log(`   📱 Model: ${event.msg.model}`);
                            console.log(`   🔧 Session ID: ${event.msg.session_id}`);
                            
                            // Send a test message after a short delay
                            setTimeout(() => {
                                const messageId = 'test-' + Date.now();
                                const submission = {
                                    id: messageId,
                                    op: {
                                        type: 'user_input',
                                        items: [{ type: 'text', text: 'Say "Hello from llama3.2!"' }]
                                    }
                                };
                                
                                console.log('📤 Sending test message...');
                                codexProcess.stdin.write(JSON.stringify(submission) + '\\n');
                            }, 1000);
                        }
                        
                        if (event.msg.type === 'task_started') {
                            console.log('🚀 Task started! AI is processing...');
                        }
                        
                        if (event.msg.type === 'agent_message_delta') {
                            if (!responseReceived) {
                                console.log('\\n📝 AI Response (streaming):');
                                responseReceived = true;
                            }
                            process.stdout.write(event.msg.delta || '');
                        }
                        
                        if (event.msg.type === 'agent_message') {
                            console.log('\\n✅ Complete response received!');
                            responseReceived = true;
                        }
                        
                        if (event.msg.type === 'task_complete') {
                            console.log('\\n🏁 Task completed successfully!');
                            console.log('✅ OSS configuration is working perfectly!');
                            setTimeout(() => codexProcess.kill('SIGTERM'), 1000);
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
            console.log(`\\n🏁 Process closed with code: ${code}`);
            console.log(`📊 Response received: ${responseReceived ? '✅' : '❌'}`);
            
            if (responseReceived) {
                console.log('\\n🎉 SUCCESS! Your VSCode extension configuration will work perfectly!');
                console.log('📋 Command that works: codex --oss -c model_provider=oss -c model=llama3.2 proto');
            } else {
                console.log('\\n❌ Still no response. Check Ollama and model availability.');
            }
        });
        
        // Handle error
        codexProcess.on('error', (error) => {
            console.error('❌ Process error:', error.message);
        });
        
        // Timeout
        setTimeout(() => {
            if (!codexProcess.killed) {
                console.log('\\n⏰ Test timeout...');
                codexProcess.kill('SIGTERM');
            }
        }, 25000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testFinalConfiguration();