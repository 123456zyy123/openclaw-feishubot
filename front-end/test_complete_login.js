// AgentOS 登录功能完整修复验证
const runCompleteTest = async () => {
    console.log('🚀 开始 AgentOS 登录功能完整测试...\n');

    // 1. 服务器连接测试
    console.log('1️⃣ 服务器连接测试');
    try {
        const healthResponse = await fetch('http://127.0.0.1:3000/health');
        const healthData = await healthResponse.json();
        console.log('✅ 服务器健康检查: 通过');
        console.log('   响应:', JSON.stringify(healthData));
    } catch (error) {
        console.log('❌ 服务器连接失败:', error.message);
        console.log('   请确保服务器正在运行: node preview_server.js');
        return;
    }

    // 2. CORS头测试
    console.log('\n2️⃣ CORS 配置测试');
    try {
        const corsResponse = await fetch('http://127.0.0.1:3000/health');
        const corsHeader = corsResponse.headers.get('access-control-allow-origin');
        if (corsHeader === '*' || corsHeader === 'http://127.0.0.1:3000') {
            console.log('✅ CORS 配置: 通过');
            console.log('   Access-Control-Allow-Origin:', corsHeader);
        } else {
            console.log('⚠️  CORS 配置: 未检测到预期头');
        }
    } catch (error) {
        console.log('❌ CORS 测试失败:', error.message);
    }

    // 3. 登录API测试
    console.log('\n3️⃣ 登录API功能测试');

    // 测试正确凭据
    try {
        console.log('   测试正确凭据...');
        const loginResponse = await fetch('http://127.0.0.1:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: '123456' })
        });
        const loginData = await loginResponse.json();

        if (loginResponse.ok && loginData.ok && loginData.token) {
            console.log('✅ 正确凭据登录: 通过');
            console.log('   Token 生成成功，长度:', loginData.token.length);
        } else {
            console.log('❌ 正确凭据登录失败:', loginData.message);
        }
    } catch (error) {
        console.log('❌ 正确凭据测试异常:', error.message);
    }

    // 测试错误凭据
    try {
        console.log('   测试错误凭据...');
        const failResponse = await fetch('http://127.0.0.1:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrong' })
        });

        if (failResponse.status === 401) {
            console.log('✅ 错误凭据拒绝: 通过 (401状态)');
        } else {
            console.log('❌ 错误凭据未正确拒绝，状态:', failResponse.status);
        }
    } catch (error) {
        console.log('❌ 错误凭据测试异常:', error.message);
    }

    // 4. 前端界面测试
    console.log('\n4️⃣ 前端界面测试');
    try {
        const pageResponse = await fetch('http://127.0.0.1:3000/dashboard-redesign.html');
        const html = await pageResponse.text();

        const checks = [
            { name: '登录模态框', pattern: 'loginModal', found: html.includes('loginModal') },
            { name: '渐变背景', pattern: 'bg-gradient-to-r from-indigo-600', found: html.includes('bg-gradient-to-r from-indigo-600') },
            { name: '密码切换', pattern: 'togglePassword', found: html.includes('togglePassword') },
            { name: '错误显示', pattern: 'errorText', found: html.includes('errorText') },
            { name: '动画效果', pattern: 'animate-modal-appear', found: html.includes('animate-modal-appear') }
        ];

        console.log('   界面元素检查:');
        checks.forEach(check => {
            console.log(`   ${check.found ? '✅' : '❌'} ${check.name}`);
        });

        const passed = checks.filter(c => c.found).length;
        console.log(`   通过率: ${passed}/${checks.length}`);

    } catch (error) {
        console.log('❌ 前端界面测试失败:', error.message);
    }

    // 5. 总结和建议
    console.log('\n🎯 测试总结');
    console.log('如果所有测试都通过，登录功能应该可以正常工作了！');
    console.log('\n📋 如果仍有问题，请尝试:');
    console.log('1. 清除浏览器缓存 (Ctrl+Shift+R)');
    console.log('2. 使用无痕模式');
    console.log('3. 检查浏览器控制台错误');
    console.log('4. 访问测试页面: http://127.0.0.1:3000/login-test.html');
    console.log('5. 重新启动服务器');

    console.log('\n🎉 测试完成！现在可以访问主页面测试登录功能。');
};

// 运行完整测试
runCompleteTest();