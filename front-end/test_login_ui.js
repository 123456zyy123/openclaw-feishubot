// 登录界面美化测试脚本
const testLoginUI = async () => {
    console.log('开始测试登录界面美化...');

    try {
        const response = await fetch('http://127.0.0.1:3000/dashboard-redesign.html');
        const html = await response.text();

        // 检查美化元素
        const checks = [
            { name: '渐变背景', pattern: 'bg-gradient-to-r from-indigo-600', found: html.includes('bg-gradient-to-r from-indigo-600') },
            { name: '动画样式', pattern: 'animate-modal-appear', found: html.includes('animate-modal-appear') },
            { name: '密码切换按钮', pattern: 'togglePassword', found: html.includes('togglePassword') },
            { name: '错误文本元素', pattern: 'errorText', found: html.includes('errorText') },
            { name: '毛玻璃效果', pattern: 'backdrop-blur', found: html.includes('backdrop-blur') },
            { name: '图标输入框', pattern: 'fa-solid fa-user', found: html.includes('fa-solid fa-user') },
            { name: '抖动动画', pattern: 'animate-shake', found: html.includes('animate-shake') }
        ];

        console.log('\n=== 登录界面美化检查结果 ===');
        checks.forEach(check => {
            console.log(`${check.found ? '✅' : '❌'} ${check.name}: ${check.found ? '通过' : '未找到'}`);
        });

        const passed = checks.filter(c => c.found).length;
        const total = checks.length;
        console.log(`\n🎨 美化元素通过率: ${passed}/${total} (${Math.round(passed/total*100)}%)`);

        if (passed === total) {
            console.log('🎉 登录界面美化完全成功！');
        } else {
            console.log('⚠️  部分美化元素可能未正确应用');
        }

    } catch (error) {
        console.log('❌ 测试失败:', error.message);
    }
};

// 运行测试
testLoginUI();