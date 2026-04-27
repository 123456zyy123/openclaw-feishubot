// 测试浏览器中的登录功能
const testBrowserLogin = async () => {
    console.log('开始测试浏览器登录功能...');

    // 模拟浏览器中的fetch请求
    const testFetch = async (url, options) => {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            return { response, data };
        } catch (error) {
            return { error: error.message };
        }
    };

    // 测试正确的登录
    console.log('📝 测试正确登录凭据...');
    const result1 = await testFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '123456' })
    });

    if (result1.error) {
        console.log('❌ 浏览器fetch请求失败:', result1.error);
        console.log('💡 这可能是CORS问题，请检查服务器CORS配置');
    } else if (result1.response.ok && result1.data.ok) {
        console.log('✅ 浏览器登录成功！');
        console.log('   Token长度:', result1.data.token.length);
    } else {
        console.log('❌ 登录API返回错误:', result1.data.message);
    }

    // 测试错误的登录
    console.log('📝 测试错误登录凭据...');
    const result2 = await testFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' })
    });

    if (result2.error) {
        console.log('❌ 错误凭据测试失败:', result2.error);
    } else if (result2.response.status === 401) {
        console.log('✅ 错误凭据正确返回401状态');
    } else {
        console.log('❌ 错误凭据未返回预期状态:', result2.response.status);
    }

    console.log('\n🎯 如果浏览器测试失败，请尝试：');
    console.log('1. 清除浏览器缓存');
    console.log('2. 尝试无痕模式');
    console.log('3. 检查浏览器控制台的CORS错误');
    console.log('4. 确认服务器CORS头设置正确');
};

// 只有在浏览器环境中才运行
if (typeof window !== 'undefined') {
    // 页面加载完成后运行测试
    window.addEventListener('load', () => {
        setTimeout(testBrowserLogin, 1000);
    });
} else {
    console.log('此脚本需要在浏览器环境中运行');
}