/**
 * main.js - 应用程序入口
 * 初始化所有模块，添加全局事件处理
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM内容加载完成，初始化应用...");
    
    // 配置信息
    const config = {
        API_BASE_URL: `${window.location.protocol}//${window.location.hostname}:${window.CODE_DOCK_CONFIG.API_PORT}`
    };

    // 初始化模块
    PlanManager.init(config);
    TaskManager.init(config);

    // 添加全局按钮点击波纹效果
    document.addEventListener('click', UI.addRippleEffect);

    // Escape 键关闭所有模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModalHandlers = {
                'plan-detail-modal': () => UI.closeModal(document.getElementById('plan-detail-modal')),
                'task-detail-modal': () => UI.closeModal(document.getElementById('task-detail-modal')),
                'add-task-modal': () => UI.closeModal(document.getElementById('add-task-modal')),
                'next-tasks-modal': () => UI.closeModal(document.getElementById('next-tasks-modal'))
            };
            
            // 检查所有可能打开的模态框
            for (const [modalId, closeHandler] of Object.entries(openModalHandlers)) {
                const modal = document.getElementById(modalId);
                if (modal && modal.classList.contains('open')) {
                    closeHandler();
                    break; // 一次只关闭一个模态框
                }
            }
        }
    });

    // 创建计划按钮点击事件
    const createPlanButton = document.getElementById('create-plan-button');
    if (createPlanButton) {
        createPlanButton.addEventListener('click', () => {
            const createSection = document.querySelector('.create-section');
            if (createSection) {
                createSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // 显示API地址
    const apiUrlDisplay = document.getElementById('api-url');
    if (apiUrlDisplay) {
        apiUrlDisplay.textContent = `API地址: ${config.API_BASE_URL}`;
    }

    console.log("应用程序初始化完成");
}); 