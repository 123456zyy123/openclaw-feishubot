import re

with open("IntelliCodeAssistant/public/dashboard-redesign.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Empty the chatContainer
chat_container_start = content.find('<div id="chatContainer" class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide scroll-smooth">')
chat_container_end = content.find('<!-- Input box -->', chat_container_start)

empty_chat = """<div id="chatContainer" class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide scroll-smooth">
    <div id="welcomeScreen" class="h-full flex flex-col items-center justify-center text-center opacity-75">
        <div class="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-300 border border-indigo-100 mb-4">
            <i class="fa-solid fa-robot text-2xl"></i>
        </div>
        <h2 class="text-xl font-semibold text-slate-800 mb-2">Welcome to AgentOS</h2>
        <p class="text-sm text-slate-500 max-w-sm">Type a prompt below to initiate a task. The agent will process your request and stream its thought process here.</p>
    </div>
</div>
"""
content = content[:chat_container_start] + empty_chat + content[chat_container_end:]

# 2. Modify Agent Status Header to "Idle"
status_header_start = content.find('<!-- Agent Status Header -->')
status_header_end = content.find('<!-- Chat/Logs scrollable area -->')

new_status_header = """<!-- Agent Status Header -->
<div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
    <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-slate-100 flex items-center justify-center rounded-full border border-slate-200 text-slate-500" id="agentIcon">
            <i class="fa-solid fa-robot text-xl"></i>
        </div>
        <div>
            <div class="flex items-center gap-2">
                <h2 class="font-semibold text-slate-800 tracking-tight" id="agentName">General Agent</h2>
                <span id="agentStatusBadge" class="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full flex items-center gap-1.5 shadow-sm">
                    <span class="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> Idle
                </span>
            </div>
            <p id="agentStatusText" class="text-xs text-slate-500 mt-0.5">Waiting for task...</p>
        </div>
    </div>
    <div class="flex items-center gap-2">
        <button onclick="window.location.href='chats.html'" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="View History">
            <i class="fa-solid fa-clock-rotate-left"></i>
        </button>
    </div>
</div>
"""
content = content[:status_header_start] + new_status_header + content[status_header_end:]

# 3. Empty Right Sidebar Goals and Memory Contexts
content = re.sub(r'<ul class="text-sm text-slate-600 space-y-2">.*?</ul>', '<ul id="currentGoalsList" class="text-sm text-slate-600 space-y-2"><li class="text-slate-400 italic">No active goals.</li></ul>', content, count=1, flags=re.DOTALL)
content = re.sub(r'<div class="space-y-3 overflow-y-auto scrollbar-hide text-sm">.*?</div>\n                </div>', '<div id="memoryContextList" class="space-y-3 overflow-y-auto scrollbar-hide text-sm"><div class="text-slate-400 italic text-center py-4">No recent context</div></div>\n                </div>', content, count=1, flags=re.DOTALL)

# 4. Rewrite JS to make an actual API call
js_start = content.find('<!-- Simulation Script (Iteration & Upgrades) -->')
js_end = content.find('</body>')

new_js = """<!-- Simulation Script (Iteration & Upgrades) -->
<script>
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatContainer = document.getElementById('chatContainer');
    const agentStatusBadge = document.getElementById('agentStatusBadge');
    const agentStatusText = document.getElementById('agentStatusText');
    const agentIcon = document.getElementById('agentIcon');

    function setStatus(status) {
        if (status === 'running') {
            agentStatusBadge.className = 'px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1.5 shadow-sm';
            agentStatusBadge.innerHTML = '<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Running';
            agentStatusText.textContent = 'Agent is processing your task...';
            agentIcon.className = 'w-10 h-10 bg-indigo-50 flex items-center justify-center rounded-full border border-indigo-100 text-indigo-600';
        } else {
            agentStatusBadge.className = 'px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full flex items-center gap-1.5 shadow-sm';
            agentStatusBadge.innerHTML = '<span class="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> Idle';
            agentStatusText.textContent = 'Waiting for task...';
            agentIcon.className = 'w-10 h-10 bg-slate-100 flex items-center justify-center rounded-full border border-slate-200 text-slate-500';
        }
    }

    function appendUserMessage(text) {
        const welcome = document.getElementById('welcomeScreen');
        if (welcome) welcome.remove();

        const el = document.createElement('div');
        el.className = 'flex gap-4 fade-in mb-6';
        el.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200 shadow-sm">
                <i class="fa-regular fa-user text-sm"></i>
            </div>
            <div class="flex-1">
                <div class="text-sm font-medium text-slate-800 mb-1">User</div>
                <div class="text-slate-700 leading-relaxed text-[15px] bg-slate-50 px-4 py-2.5 rounded-2xl rounded-tl-sm border border-slate-200 inline-block shadow-sm whitespace-pre-wrap">
                    ${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                </div>
            </div>
        `;
        chatContainer.appendChild(el);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendAgentThinking() {
        const el = document.createElement('div');
        el.id = 'agentThinkingNode';
        el.className = 'flex gap-4 fade-in mb-6';
        el.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100">
                <i class="fa-solid fa-spinner fa-spin text-sm"></i>
            </div>
            <div class="flex-1">
                <div class="text-sm font-medium text-slate-800 mb-2 flex items-center gap-2">
                    Agent Thought Process
                    <span class="text-xs text-indigo-500 animate-pulse">Running...</span>
                </div>
                <div class="bg-[#1e1e2e] rounded-lg p-4 font-mono text-[13px] leading-[1.6] text-[#a6accd] overflow-x-auto shadow-inner min-h-[100px] scroll-smooth" id="liveExecutionLog">
                    <div class="text-blue-400">Initializing task execution...</div>
                    <div id="cursorPulse" class="animate-pulse text-slate-400 inline-block font-bold">_</div>
                </div>
            </div>
        `;
        chatContainer.appendChild(el);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return document.getElementById('liveExecutionLog');
    }

    function appendFinalResult(resultNode, data) {
        const cursor = document.getElementById('cursorPulse');
        if (cursor) cursor.remove();
        
        const steps = data.result?.step_results || [];
        let html = steps.map(s => `<div class="text-green-400">✔ ${s.task}</div>`).join('');
        if (!html) html = `<div class="text-green-400">✔ Success</div>`;
        
        const summary = data.summary ? JSON.stringify(data.summary) : "";
        if (summary) {
            html += `<div class="text-yellow-400 mt-2">Result: ${summary}</div>`;
        }

        const logNode = document.createElement('div');
        logNode.innerHTML = html;
        resultNode.appendChild(logNode);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        const icon = resultNode.parentElement.parentElement.querySelector('.fa-spinner');
        if (icon) {
            icon.className = 'fa-solid fa-check text-sm';
            icon.parentElement.className = 'w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100';
            const title = icon.parentElement.nextElementSibling.querySelector('span');
            if (title) {
                title.className = 'text-xs text-emerald-500';
                title.textContent = 'Completed';
            }
        }
        resultNode.parentElement.parentElement.id = ''; // Remove id
    }

    async function runAgentTask(prompt) {
        const token = localStorage.getItem('preview_demo_token');
        if (!token) {
            alert('Please login first by navigating to the login view if needed. (Mocking without token is disabled)');
            return;
        }

        setStatus('running');
        sendBtn.disabled = true;
        chatInput.disabled = true;
        const logWindow = appendAgentThinking();

        try {
            const response = await fetch('/api/agent/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ prompt: prompt })
            });
            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.message || 'Run failed');
            }

            appendFinalResult(logWindow, data);
            
            // Update goals randomly
            document.getElementById('currentGoalsList').innerHTML = '<li class="flex gap-2"><i class="fa-regular fa-circle-check text-emerald-500 mt-0.5"></i><span>Completed task: ' + prompt.substring(0, 20) + '...</span></li>';
        } catch (error) {
            const cursor = document.getElementById('cursorPulse');
            if (cursor) cursor.remove();
            const errNode = document.createElement('div');
            errNode.className = 'text-red-400 mt-2';
            errNode.textContent = 'Error: ' + error.message;
            logWindow.appendChild(errNode);
        } finally {
            setStatus('idle');
            sendBtn.disabled = false;
            chatInput.disabled = false;
            setTimeout(() => chatInput.focus(), 100);
        }
    }

    sendBtn.addEventListener('click', () => {
        const val = chatInput.value.trim();
        if(!val) return;
        
        appendUserMessage(val);
        chatInput.value = '';
        chatInput.style.height = '44px';
        
        runAgentTask(val);
    });

    chatInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    const style = document.createElement('style');
    style.textContent = `
        .fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
</script>
"""
content = content[:js_start] + new_js + content[js_end:]

with open("IntelliCodeAssistant/public/dashboard-redesign.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Done rewriting dashboard-redesign.html")
