// 登录功能测试脚本
const testLoginFunctionality = async () => {
    console.log('开始测试登录功能...');

    // 测试1: 正确的登录凭据
    try {
        const response1 = await fetch('http://127.0.0.1:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: '123456' })
        });
        const data1 = await response1.json();
        console.log('✅ 正确凭据测试:', response1.status === 200 && data1.ok ? '通过' : '失败');
    } catch (error) {
        console.log('❌ 正确凭据测试失败:', error.message);
    }

    // 测试2: 错误的登录凭据
    try {
        const response2 = await fetch('http://127.0.0.1:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrong' })
        });
        console.log('✅ 错误凭据测试:', response2.status === 401 ? '通过' : '失败');
    } catch (error) {
        console.log('❌ 错误凭据测试失败:', error.message);
    }

    // 测试3: 检查dashboard页面是否包含模态框
    try {
        const response3 = await fetch('http://127.0.0.1:3000/dashboard-redesign.html');
        const html = await response3.text();
        const hasModal = html.includes('loginModal') && html.includes('usernameInput');
        console.log('✅ 模态框HTML测试:', hasModal ? '通过' : '失败');
    } catch (error) {
        console.log('❌ 模态框HTML测试失败:', error.message);
    }

    console.log('登录功能测试完成！');
};

// 运行测试
testLoginFunctionality();