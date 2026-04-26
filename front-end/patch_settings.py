import re

with open('IntelliCodeAssistant/public/settings.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Make the nave links NOT have href="#" so they don't get caught by the "coming soon" alert
nav_html = '''
                <nav class="space-y-1" id="settingsNav">
                    <a data-target="profile" href="javascript:void(0)" class="nav-item flex items-center justify-between px-3 py-2.5 bg-slate-50 text-indigo-600 rounded-lg font-medium">
                        <span>General Profiles</span>
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </a>
                    <a data-target="env" href="javascript:void(0)" class="nav-item flex items-center justify-between px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg font-medium transition-colors">
                        <span>Environment Config</span>
                        <i class="fa-solid fa-chevron-right text-xs hidden"></i>
                    </a>
                    <a data-target="api" href="javascript:void(0)" class="nav-item flex items-center justify-between px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg font-medium transition-colors">
                        <span>API Keys</span>
                        <i class="fa-solid fa-chevron-right text-xs hidden"></i>
                    </a>
                    <a data-target="logs" href="javascript:void(0)" class="nav-item flex items-center justify-between px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg font-medium transition-colors">
                        <span>System Logs</span>
                        <i class="fa-solid fa-chevron-right text-xs hidden"></i>
                    </a>
                </nav>
'''
content = re.sub(r'<nav class="space-y-1">.*?</nav>', nav_html, content, flags=re.DOTALL)


content_area = '''
            <div class="max-w-3xl flex-1 w-full" id="settingsContent">
                
                <div id="section-profile" class="settings-section">
                    <h1 class="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-3">General Profiles</h1>
                    <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 class="text-sm font-semibold text-slate-800 mb-4">Workspace Identity</h2>
                        <div class="flex items-center gap-6 mb-6">
                            <div class="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold border border-indigo-200 relative group cursor-pointer">
                                JD
                                <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i class="fa-solid fa-camera text-white text-sm"></i>
                                </div>
                            </div>
                            <div class="flex-1">
                                <label class="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                                <input type="text" id="displayName" value="John Doe" class="w-full max-w-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors">
                            </div>
                        </div>
                    </section>
                </div>

                <div id="section-env" class="settings-section hidden">
                    <h1 class="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-3">Environment Config</h1>
                    <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 class="text-sm font-semibold text-slate-800 mb-4">Global Variables</h2>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">DEBUG_MODE</label>
                                <select id="debugMode" class="w-full max-w-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                    <option value="true">True (Verbose logging)</option>
                                    <option value="false" selected>False (Standard)</option>
                                </select>
                            </div>
                        </div>
                    </section>
                </div>

                <div id="section-api" class="settings-section hidden">
                    <h1 class="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-3">API Keys</h1>
                    <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">OpenAI API Key</label>
                                <div class="flex gap-2 max-w-md">
                                    <input type="password" id="openaiKey" value="sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors">
                                </div>
                            </div>
                            <div class="pt-2">
                                <label class="block text-sm font-medium text-slate-700 mb-1">Anthropic API Key</label>
                                <input type="password" id="anthropicKey" placeholder="sk-ant-..." class="w-full max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors">
                            </div>
                        </div>
                    </section>
                </div>

                <div id="section-logs" class="settings-section hidden">
                    <h1 class="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-3">System Logs</h1>
                    <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <div class="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto h-48">
                            [INFO] Settings loaded.<br>
                            [INFO] Connection to AgentOS daemon stable.<br>
                            [WARN] Missing Anthropic API key.<br>
                        </div>
                        <button class="mt-4 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Clear Logs</button>
                    </section>
                </div>

                <div class="flex justify-end gap-3 mt-8 border-t border-slate-200 pt-6" id="saveActionContainer">
                    <button id="cancelBtn" class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                    <button id="saveSettingsBtn" class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                        <i class="fa-solid fa-save"></i> <span>Save Changes</span>
                    </button>
                </div>

            </div>
'''
content = re.sub(r'<div class="max-w-3xl">.*?</div>\s*</div>\s*</main>', content_area + '</div></main>', content, flags=re.DOTALL)


custom_js = '''
<script>
document.addEventListener('DOMContentLoaded', () => {
    // Nav logic
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.settings-section');
    const saveContainer = document.getElementById('saveActionContainer');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            
            // update UI
            navItems.forEach(nav => {
                nav.classList.remove('bg-slate-50', 'text-indigo-600');
                nav.classList.add('text-slate-600');
                const arrow = nav.querySelector('i');
                if(arrow) arrow.classList.add('hidden');
            });
            item.classList.add('bg-slate-50', 'text-indigo-600');
            item.classList.remove('text-slate-600');
            const arrow = item.querySelector('i');
            if(arrow) arrow.classList.remove('hidden');

            sections.forEach(sec => sec.classList.add('hidden'));
            document.getElementById('section-' + targetId).classList.remove('hidden');
            
            // hide save container on logs tab
            if(targetId === 'logs') saveContainer.classList.add('hidden');
            else saveContainer.classList.remove('hidden');
        });
    });

    // Save Action
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const originalText = saveBtn.querySelector('span').innerText;
            const originalIcon = saveBtn.querySelector('i').className;
            
            saveBtn.querySelector('span').innerText = 'Saving...';
            saveBtn.querySelector('i').className = 'fa-solid fa-spinner fa-spin';
            saveBtn.classList.add('opacity-75');
            saveBtn.disabled = true;

            setTimeout(() => {
                saveBtn.querySelector('span').innerText = 'Saved Successfully!';
                saveBtn.querySelector('i').className = 'fa-solid fa-check';
                saveBtn.classList.replace('bg-indigo-600', 'bg-emerald-500');
                saveBtn.classList.replace('hover:bg-indigo-700', 'hover:bg-emerald-600');
                
                // Show notification toast
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 right-4 bg-emerald-50 text-emerald-600 px-4 py-3 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-3 fade-in z-50';
                toast.innerHTML = '<i class="fa-solid fa-check-circle"></i><span class="text-sm font-medium">Settings saved locally.</span>';
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.5s';
                    setTimeout(() => toast.remove(), 500);
                    
                    saveBtn.querySelector('span').innerText = originalText;
                    saveBtn.querySelector('i').className = originalIcon;
                    saveBtn.classList.replace('bg-emerald-500', 'bg-indigo-600');
                    saveBtn.classList.replace('hover:bg-emerald-600', 'hover:bg-indigo-700');
                    saveBtn.classList.remove('opacity-75');
                    saveBtn.disabled = false;
                }, 3000);
            }, 800);
        });
    }
});
</script>
'''

content = content.replace('</body>', custom_js + '</body>')

with open('IntelliCodeAssistant/public/settings.html', 'w', encoding='utf-8', errors='ignore') as f:
    f.write(content)

print("done settings")
