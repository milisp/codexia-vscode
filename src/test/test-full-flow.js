#!/usr/bin/env node

const { spawn } = require('child_process');

async function testFullFlow() {
    console.log('🧪 Testing Full Chat Flow with llama3.2...\n');
    
    const command = 'codex';
    const args = ['--oss', '-c', 'model=llama3.2', 'proto'];
    
    console.log('🚀 Command:', command, args.join(' '));
    
    try {
        const codexProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdoutBuffer = '';
        let sessionConfigured = false;
        let taskStarted = false;
        let messageId = null;
        
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
                            sessionConfigured = true;
                            console.log('✅ Session configured! Model:', event.msg.model);
                            
                            // Send a simple test message
                            setTimeout(() => {
                                messageId = 'test-' + Date.now();
                                const submission = {
                                    id: messageId,
                                    op: {
                                        type: 'user_input',
                                        items: [{ type: 'text', text: 'Hello! Please respond with just "Hi there!"' }]
                                    }
                                };
                                
                                console.log('📤 Sending message:', JSON.stringify(submission, null, 2));
                                codexProcess.stdin.write(JSON.stringify(submission) + '\n');
                            }, 1000);
                        }
                        
                        if (event.msg.type === 'task_started') {
                            taskStarted = true;
                            console.log('🚀 Task started! Waiting for AI response...');
                        }
                        
                        if (event.msg.type === 'agent_message_delta') {
                            console.log('📝 Delta:', JSON.stringify(event.msg.delta));
                            process.stdout.write(event.msg.delta || '');
                        }
                        
                        if (event.msg.type === 'agent_message') {
                            console.log('\\n✅ Complete message received!');
                            console.log('Content:', event.msg.message || event.msg.last_agent_message);
                        }
                        
                        if (event.msg.type === 'task_complete') {
                            console.log('\\n🏁 Task completed!');
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
            const errorText = data.toString();
            console.log('stderr:', errorText);
            
            if (errorText.includes('connection refused')) {
                console.log('❌ Cannot connect to Ollama. Is ollama serve running?');
            }
        });
        
        // Handle close
        codexProcess.on('close', (code) => {
            console.log(`\\n🏁 Process closed with code: ${code}`);
            
            console.log('\\n📊 Summary:');
            console.log(`   Session configured: ${sessionConfigured ? '✅' : '❌'}`);
            console.log(`   Task started: ${taskStarted ? '✅' : '❌'}`);
            console.log(`   Message ID: ${messageId || 'Not sent'}`);
        });
        
        // Handle error
        codexProcess.on('error', (error) => {
            console.error('❌ Process error:', error.message);
        });
        
        // Extended timeout for local model response
        setTimeout(() => {
            if (!codexProcess.killed) {
                console.log('\\n⏰ Extended timeout (30s), checking Ollama status...');
                
                // Check if Ollama is responding
                const ollamaCheck = spawn('curl', ['-s', 'http://localhost:11434/api/tags'], { shell: true });
                ollamaCheck.on('close', (code) => {
                    if (code === 0) {
                        console.log('✅ Ollama is running, but model might be slow');
                    } else {
                        console.log('❌ Ollama might not be running. Try: ollama serve');
                    }
                    codexProcess.kill('SIGTERM');
                });
            }
        }, 30000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testFullFlow();