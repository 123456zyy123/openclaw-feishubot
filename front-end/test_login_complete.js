// 登录功能完整测试脚本
const testLoginFlow = async () => {
    console.log('开始测试登录功能完整流程...');

    // 测试1: 正确的登录凭据
    try {
        console.log('📝 测试正确凭据登录...');
        const response1 = await fetch('http://127.0.0.1:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: '123456' })
        });
        const data1 = await response1.json();
        console.log(`✅ 正确凭据测试: ${response1.status === 200 && data1.ok && data1.token ? '通过' : '失败'}`);
        console.log(`   Token: ${data1.token ? data1.token.substring(0, 20) + '...' : '无'}`);
    } catch (error) {
        console.log('❌ 正确凭据测试失败:', error.message);
    }

    // 测试2: 错误的登录凭据
    try {
        console.log('📝 测试错误凭据登录...');
        const response2 = await fetch('http://127.0.0.1:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrong' })
        });
        console.log(`✅ 错误凭据测试: ${response2.status === 401 ? '通过' : '失败'} (状态码: ${response2.status})`);
    } catch (error) {
        console.log('❌ 错误凭据测试失败:', error.message);
    }

    // 测试3: 空用户名/密码
    try {
        console.log('📝 测试空凭据登录...');
        const response3 = await fetch('http://127.0.0.1:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: '', password: '' })
        });
        console.log(`✅ 空凭据测试: ${response3.status === 400 ? '通过' : '失败'} (状态码: ${response3.status})`);
    } catch (error) {
        console.log('❌ 空凭据测试失败:', error.message);
    }

    // 测试4: 检查dashboard页面是否包含登录模态框
    try {
        console.log('📝 测试页面加载...');
        const response4 = await fetch('http://127.0.0.1:3000/dashboard-redesign.html');
        const html = await response4.text();
        const hasModal = html.includes('loginModal') && html.includes('usernameInput');
        const hasStyling = html.includes('bg-gradient-to-r from-indigo-600');
        console.log(`✅ 页面加载测试: ${hasModal && hasStyling ? '通过' : '失败'}`);
        console.log(`   模态框: ${hasModal ? '✓' : '✗'}, 样式: ${hasStyling ? '✓' : '✗'}`);
    } catch (error) {
        console.log('❌ 页面加载测试失败:', error.message);
    }

    console.log('\n🎉 登录功能测试完成！');
    console.log('💡 现在可以在浏览器中访问 http://127.0.0.1:3000/dashboard-redesign.html 测试登录界面');
};

// 运行测试
testLoginFlow();