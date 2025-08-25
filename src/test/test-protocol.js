#!/usr/bin/env node

const { spawn } = require('child_process');

async function testCodexProtocol() {
    console.log('🧪 Testing Codex Protocol Mode...\n');
    
    try {
        console.log('Starting codex proto...');
        const codexProcess = spawn('codex', ['proto'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdoutBuffer = '';
        let sessionId = null;
        
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
                            sessionId = event.msg.session_id;
                            console.log('✅ Session configured with ID:', sessionId);
                            
                            // Send a test message
                            const submission = {
                                id: generateId(),
                                op: {
                                    type: 'user_input',
                                    items: [{ type: 'text', text: "Say hello and tell me what you can do" }]
                                }
                            };
                            
                            console.log('📤 Sending submission:', JSON.stringify(submission, null, 2));
                            codexProcess.stdin.write(JSON.stringify(submission) + '\n');
                        }
                        
                        if (event.msg.type === 'agent_message') {
                            console.log('📝 Agent response:', event.msg.message || event.msg.last_agent_message);
                        }
                        
                        if (event.msg.type === 'agent_message_delta') {
                            process.stdout.write(event.msg.delta || '');
                        }
                        
                        if (event.msg.type === 'exec_request') {
                            console.log('🔧 Execution request:', event.msg.command);
                        }
                    } catch (error) {
                        console.warn('Failed to parse line:', line);
                    }
                }
            }
        });
        
        // Handle stderr
        codexProcess.stderr.on('data', (data) => {
            console.error('stderr:', data.toString());
        });
        
        // Handle close
        codexProcess.on('close', (code) => {
            console.log(`\n🏁 Process closed with code: ${code}`);
        });
        
        // Handle error
        codexProcess.on('error', (error) => {
            console.error('❌ Process error:', error);
        });
        
        // Kill after 30 seconds
        setTimeout(() => {
            console.log('\n⏰ Test timeout, closing process...');
            codexProcess.kill('SIGTERM');
        }, 30000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

testCodexProtocol();