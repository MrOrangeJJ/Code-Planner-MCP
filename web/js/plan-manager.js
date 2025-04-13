/**
 * plan-manager.js - 计划管理模块
 * 处理计划列表、创建、删除等功能
 */

// 计划管理模块
const PlanManager = (function() {
    // 私有变量
    let plansGrid;
    let plansLoading;
    let noPlansEl;
    let manageStatusDiv;
    let createFromTextForm;
    let textCreateStatusDiv;
    let API_BASE_URL;
    
    // 模态框元素
    let planDetailModal;
    let planDetailModalClose;
    let planDetailTitle;
    let planDetailContent;
    let planDetailLoading;
    
    // 下一步任务模态框元素
    let nextTasksModal;
    let nextTasksModalClose;
    let nextTasksContent;
    let nextTasksLoading;
    
    // 初始化函数
    function init(config) {
        // 保存配置
        API_BASE_URL = config.API_BASE_URL;
        
        // 初始化DOM元素引用
        plansGrid = document.getElementById('plans-grid');
        plansLoading = document.getElementById('plans-loading');
        noPlansEl = document.getElementById('no-plans');
        manageStatusDiv = document.getElementById('manage-status');
        createFromTextForm = document.getElementById('create-from-text-form');
        textCreateStatusDiv = document.getElementById('text-create-status');
        
        // 初始化模态框元素引用
        planDetailModal = document.getElementById('plan-detail-modal');
        planDetailModalClose = document.getElementById('plan-detail-modal-close');
        planDetailTitle = document.getElementById('plan-detail-title');
        planDetailContent = document.getElementById('plan-detail-content');
        planDetailLoading = document.getElementById('plan-detail-loading');
        
        // 初始化下一步任务模态框元素引用
        nextTasksModal = document.getElementById('next-tasks-modal');
        nextTasksModalClose = document.getElementById('next-tasks-modal-close');
        nextTasksContent = document.getElementById('next-tasks-content');
        nextTasksLoading = document.getElementById('next-tasks-loading');
        
        // 检查必要元素是否存在
        if (!plansGrid || !plansLoading) {
            console.error('[计划管理] 初始化失败: 找不到必要的DOM元素');
            return;
        }
        
        // 绑定事件
        bindEvents();
        
        // 在初始化时加载计划列表
        fetchPlans();
    }
    
    // 事件绑定
    function bindEvents() {
        // 从文本创建计划表单提交
        if (createFromTextForm) {
            createFromTextForm.addEventListener('submit', handleCreateFromTextFormSubmit);
        }
        
        // 计划网格点击事件委托
        if (plansGrid) {
            plansGrid.addEventListener('click', handlePlanGridClick);
        }
        
        // 刷新按钮点击事件
        const refreshButton = document.getElementById('refresh-plans');
        if (refreshButton) {
            refreshButton.addEventListener('click', fetchPlans);
        }
        
        // 创建计划按钮点击事件
        const createPlanButton = document.getElementById('create-plan-button');
        if (createPlanButton) {
            createPlanButton.addEventListener('click', scrollToCreateForm);
        }
        
        // 创建第一个计划按钮点击事件
        const uploadFirstPlanButton = document.getElementById('upload-first-plan');
        if (uploadFirstPlanButton) {
            uploadFirstPlanButton.addEventListener('click', scrollToCreateForm);
        }
        
        // 模态框关闭按钮点击事件
        if (planDetailModalClose) {
            planDetailModalClose.addEventListener('click', () => UI.closeModal(planDetailModal));
        }
        
        if (nextTasksModalClose) {
            nextTasksModalClose.addEventListener('click', () => UI.closeModal(nextTasksModal));
        }
        
        // 模态框背景点击关闭
        if (planDetailModal) {
            planDetailModal.addEventListener('click', e => {
                if (e.target === planDetailModal) {
                    UI.closeModal(planDetailModal);
                }
            });
        }
        
        if (nextTasksModal) {
            nextTasksModal.addEventListener('click', e => {
                if (e.target === nextTasksModal) {
                    UI.closeModal(nextTasksModal);
                }
            });
        }
    }
    
    // 滚动到创建表单
    function scrollToCreateForm() {
        const createSection = document.querySelector('.create-from-text-section');
        if (createSection) {
            createSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // 从文本创建计划表单提交处理
    async function handleCreateFromTextFormSubmit(e) {
        e.preventDefault();
        
        const nameInput = document.getElementById('text-plan-name');
        const textInput = document.getElementById('plan-text');
        
        if (!textInput) {
            UI.showStatus(textCreateStatusDiv, '表单缺少必要字段', 'error');
            return;
        }
        
        const name = nameInput ? nameInput.value.trim() : '';
        const text = textInput.value.trim();
        
        if (!text) {
            UI.showStatus(textCreateStatusDiv, '请输入计划文本描述', 'error');
            return;
        }
        
        UI.showStatus(textCreateStatusDiv, '正在从文本创建计划，请稍候...', 'info', 0);
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/from-text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    name: name || undefined
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UI.showStatus(textCreateStatusDiv, `计划从文本创建成功`, 'success');
                createFromTextForm.reset();
                fetchPlans(); // 刷新计划列表
            } else {
                throw new Error(result.message || '创建失败');
            }
        } catch (error) {
            console.error('从文本创建计划出错:', error);
            UI.showStatus(textCreateStatusDiv, `创建失败: ${error.message}`, 'error');
        }
    }
    
    // 计划网格点击处理(事件委托)
    async function handlePlanGridClick(e) {
        // 查找最近的按钮元素
        const button = e.target.closest('button');
        if (!button) return;
        
        // 获取计划ID
        const planId = button.getAttribute('data-id');
        
        // 根据按钮类型执行操作
        if (button.classList.contains('manage-tasks-btn') && planId) {
            openTasksModal(planId);
        } else if (button.classList.contains('set-current-btn') && planId) {
            await handleSetCurrentPlan(planId);
        } else if (button.classList.contains('delete-plan-btn') && planId) {
            await handleDeletePlan(planId);
        } else if (button.classList.contains('next-tasks-btn')) {
            showNextTasks();
        }
    }
    
    // 显示计划详情
    async function showPlanDetail(planId) {
        if (!planDetailModal || !planDetailContent || !planDetailLoading) {
            console.error('[计划管理] 无法打开详情: 模态框元素不存在');
            return;
        }
        
        // 显示加载状态
        UI.toggleLoading(planDetailLoading, true);
        planDetailContent.innerHTML = '';
        UI.openModal(planDetailModal);
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}`);
            
            if (!response.ok) {
                throw new Error(`获取计划详情失败: ${response.status}`);
            }
            
            const plan = await response.json();
            
            if (!plan) {
                throw new Error('API返回数据格式异常');
            }
            
            // 更新模态框标题
            planDetailTitle.textContent = `计划详情: ${plan.name}`;
            
            // 渲染计划详情
            renderPlanDetail(plan);
        } catch (error) {
            console.error('获取计划详情出错:', error);
            planDetailContent.innerHTML = `
                <div class="status-message">
                    <p class="status-error">获取计划详情失败: ${error.message}</p>
                </div>
            `;
        } finally {
            UI.toggleLoading(planDetailLoading, false);
        }
    }
    
    // 渲染计划详情
    function renderPlanDetail(plan) {
        if (!planDetailContent) return;
        
        // 创建详情内容
        const detailHTML = `
            <div class="plan-detail">
                <div class="plan-info">
                    <p><strong>名称:</strong> ${UI.escapeHtml(plan.name)}</p>
                    <p><strong>描述:</strong> ${UI.escapeHtml(plan.description || '无描述')}</p>
                    <p><strong>创建时间:</strong> ${UI.formatDate(plan.created_at)}</p>
                    <p><strong>更新时间:</strong> ${plan.updated_at ? UI.formatDate(plan.updated_at) : '无更新'}</p>
                </div>
                
                <h3>计划笔记</h3>
                ${plan.notes && plan.notes.length > 0 
                    ? `<ul>${plan.notes.map(note => `<li>${UI.escapeHtml(note)}</li>`).join('')}</ul>` 
                    : '<p>没有笔记</p>'}
                
                <h3>任务列表 (${plan.tasks ? plan.tasks.length : 0}个任务)</h3>
                ${renderTaskList(plan.tasks || [])}
                
                <div class="form-actions">
                    <button class="btn btn-primary" id="add-task-to-plan" data-id="${plan.id}">
                        <i class="fas fa-plus"></i> 添加任务
                    </button>
                </div>
            </div>
        `;
        
        planDetailContent.innerHTML = detailHTML;
        
        // 绑定添加任务按钮事件
        const addTaskButton = document.getElementById('add-task-to-plan');
        if (addTaskButton) {
            addTaskButton.addEventListener('click', () => {
                if (typeof TaskManager !== 'undefined' && typeof TaskManager.openAddTaskModal === 'function') {
                    TaskManager.openAddTaskModal(plan.id, plan.tasks || []);
                } else {
                    console.warn('TaskManager.openAddTaskModal 函数不存在');
                    UI.showStatus(manageStatusDiv, '任务管理模块未加载，无法添加任务', 'error');
                }
            });
        }
        
        // 绑定任务编辑按钮事件
        const editTaskButtons = planDetailContent.querySelectorAll('.edit-task-btn');
        
        editTaskButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.id;
                if (taskId) {
                    handleEditTask(plan.id, taskId);
                }
            });
        });
    }
    
    // 处理编辑任务按钮点击
    async function handleEditTask(planId, taskId) {
        console.log(`编辑任务: 计划ID=${planId}, 任务ID=${taskId}`);
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${taskId}`);
            
            if (!response.ok) {
                throw new Error(`获取任务详情失败: ${response.status}`);
            }
            
            const task = await response.json();
            
            // 打开任务编辑界面
            if (typeof TaskManager !== 'undefined' && typeof TaskManager.openEditTaskModal === 'function') {
                TaskManager.openEditTaskModal(planId, task);
            } else {
                UI.showStatus(manageStatusDiv, '任务管理模块未加载，无法编辑任务', 'error');
            }
            
        } catch (error) {
            console.error('获取任务详情失败:', error);
            UI.showStatus(manageStatusDiv, `无法编辑任务: ${error.message}`, 'error');
        }
    }

    // 处理开始任务按钮点击
    async function handleStartTask(taskId, planId) {
        console.log(`开始任务: 任务ID=${taskId}, 计划ID=${planId}`);
        
        UI.showStatus(manageStatusDiv, '正在更新任务状态...', 'info');
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'Working'
                })
            });
            
            if (!response.ok) {
                throw new Error(`更新任务状态失败: ${response.status}`);
            }
            
            const updatedTask = await response.json();
            
            UI.showStatus(manageStatusDiv, `任务"${updatedTask.title}"已开始`, 'success');
            
            // 刷新页面
            UI.closeModal(nextTasksModal);
            showNextTasks();
            
        } catch (error) {
            console.error('开始任务失败:', error);
            UI.showStatus(manageStatusDiv, `无法开始任务: ${error.message}`, 'error');
        }
    }
    
    // 渲染任务列表
    function renderTaskList(tasks) {
        if (!tasks || tasks.length === 0) {
            return '<p>没有任务</p>';
        }
        
        // 按顺序排序任务
        const sortedTasks = [...tasks].sort((a, b) => {
            if (a.order === null && b.order === null) return 0;
            if (a.order === null) return 1;
            if (b.order === null) return -1;
            return a.order - b.order;
        });
        
        // 生成任务列表HTML
        return `
            <div class="task-list">
                ${sortedTasks.map(task => `
                    <div class="task-card ${getTaskStatusClass(task.status)}">
                        <div class="task-header">
                            <h4 class="task-title">${UI.escapeHtml(task.title)}</h4>
                            <span class="status-badge ${getTaskStatusClass(task.status)}">
                                ${getTaskStatusIcon(task.status)} ${UI.escapeHtml(task.status)}
                            </span>
                        </div>
                        ${task.description ? `<div class="task-description">${UI.escapeHtml(task.description)}</div>` : ''}
                        <div class="task-meta">
                            <div>
                                ${task.order !== null ? `<span>顺序: ${task.order}</span> | ` : ''}
                                <span>评论: ${task.comments ? task.comments.length : 0}</span>
                            </div>
                            <div class="task-actions">
                                <button class="btn btn-sm btn-primary edit-task-btn" data-id="${task.id}" title="编辑任务">
                                    <i class="fas fa-edit"></i> 编辑
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // 获取任务状态类名
    function getTaskStatusClass(status) {
        switch (status) {
            case 'Pending': return 'pending';
            case 'Working': return 'working';
            case 'Pending For Review': return 'review';
            case 'Complete': return 'complete';
            case 'Need Fixed': return 'need-fixed';
            default: return 'pending';
        }
    }
    
    // 获取任务状态图标
    function getTaskStatusIcon(status) {
        switch (status) {
            case 'Pending': return '<i class="fas fa-clock"></i>';
            case 'Working': return '<i class="fas fa-spinner"></i>';
            case 'Pending For Review': return '<i class="fas fa-search"></i>';
            case 'Complete': return '<i class="fas fa-check"></i>';
            case 'Need Fixed': return '<i class="fas fa-exclamation-triangle"></i>';
            default: return '<i class="fas fa-clock"></i>';
        }
    }
    
    // 打开下一步任务模态框
    async function showNextTasks() {
        if (!nextTasksModal || !nextTasksContent || !nextTasksLoading) {
            console.error('[计划管理] 无法打开下一步任务: 模态框元素不存在');
            return;
        }
        
        // 显示加载状态
        UI.toggleLoading(nextTasksLoading, true);
        nextTasksContent.innerHTML = '';
        UI.openModal(nextTasksModal);
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/next-tasks`);
            
            if (!response.ok) {
                throw new Error(`获取下一步任务失败: ${response.status}`);
            }
            
            const tasks = await response.json();
            
            if (tasks.length === 0) {
                nextTasksContent.innerHTML = `
                    <div class="status-message">
                        <p class="status-info">当前没有可执行的下一步任务</p>
                    </div>
                `;
                return;
            }
            
            // 渲染下一步任务列表
            renderNextTasks(tasks);
        } catch (error) {
            console.error('获取下一步任务出错:', error);
            nextTasksContent.innerHTML = `
                <div class="status-message">
                    <p class="status-error">获取下一步任务失败: ${error.message}</p>
                </div>
            `;
        } finally {
            UI.toggleLoading(nextTasksLoading, false);
        }
    }
    
    // 渲染下一步任务列表
    function renderNextTasks(tasks) {
        if (!nextTasksContent) return;
        
        // 创建任务列表HTML
        const tasksHTML = `
            <div class="task-list">
                ${tasks.map(task => `
                    <div class="task-card ${getTaskStatusClass(task.status)}">
                        <div class="task-header">
                            <h4 class="task-title">${UI.escapeHtml(task.title)}</h4>
                            <span class="status-badge ${getTaskStatusClass(task.status)}">
                                ${getTaskStatusIcon(task.status)} ${UI.escapeHtml(task.status)}
                            </span>
                        </div>
                        ${task.description ? `<div class="task-description">${UI.escapeHtml(task.description)}</div>` : ''}
                        <div class="task-meta">
                            <div>
                                ${task.order !== null ? `<span>顺序: ${task.order}</span>` : ''}
                                ${task.dependencies && task.dependencies.length > 0 ? 
                                    `<span> | 依赖任务: ${task.dependencies.length}个</span>` : ''}
                            </div>
                            <div class="task-actions">
                                <button class="btn btn-sm btn-success start-task-btn" data-id="${task.id}" data-plan-id="${task.plan_id}" title="开始任务">
                                    <i class="fas fa-play"></i> 开始
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        nextTasksContent.innerHTML = tasksHTML;
        
        // 绑定开始任务按钮事件
        const startTaskButtons = nextTasksContent.querySelectorAll('.start-task-btn');
        startTaskButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.id;
                const planId = btn.dataset.planId;
                if (taskId && planId) {
                    handleStartTask(taskId, planId);
                }
            });
        });
    }
    
    // 设置当前计划处理
    async function handleSetCurrentPlan(planId) {
        UI.showStatus(manageStatusDiv, '正在设置当前计划...', 'info', 0);
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}/set-current`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UI.showStatus(manageStatusDiv, '当前计划设置成功', 'success');
                fetchPlans(); // 刷新计划列表
            } else {
                throw new Error(result.message || '设置当前计划失败');
            }
        } catch (error) {
            console.error('设置当前计划出错:', error);
            UI.showStatus(manageStatusDiv, `设置当前计划失败: ${error.message}`, 'error');
        }
    }
    
    // 删除计划处理
    async function handleDeletePlan(planId) {
        if (!confirm('确定要删除这个计划吗？此操作不可恢复！')) {
            return;
        }
        
        UI.showStatus(manageStatusDiv, '正在删除计划...', 'info', 0);
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UI.showStatus(manageStatusDiv, '计划删除成功', 'success');
                fetchPlans(); // 刷新计划列表
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('删除计划出错:', error);
            UI.showStatus(manageStatusDiv, `删除失败: ${error.message}`, 'error');
        }
    }
    
    // 显示加载中元素
    function showLoadingElement() {
        if (plansLoading) {
            UI.showElement(plansLoading);
        }
    }
    
    // 隐藏加载中元素
    function hideLoadingElement() {
        if (plansLoading) {
            UI.hideElement(plansLoading);
        }
    }
    
    // 显示计划网格
    function showPlansGrid() {
        if (plansGrid) {
            plansGrid.style.display = 'grid';  // 直接设置为grid，而不是使用UI.showElement
        }
    }
    
    // 隐藏计划网格
    function hidePlansGrid() {
        if (plansGrid) {
            UI.hideElement(plansGrid);
        }
    }
    
    // 显示无计划提示
    function showNoPlansElement(message) {
        if (noPlansEl) {
            if (message) {
                const messageElem = noPlansEl.querySelector('p');
                if (messageElem) {
                    messageElem.textContent = message;
                }
            }
            UI.showElement(noPlansEl);
        }
    }
    
    // 隐藏无计划提示
    function hideNoPlansElement() {
        if (noPlansEl) {
            UI.hideElement(noPlansEl);
        }
    }
    
    // 获取计划列表
    async function fetchPlans() {
        // 显示加载中
        showLoadingElement();
        hideNoPlansElement();
        hidePlansGrid();
        
        try {
            // 首先获取当前计划ID
            let currentPlanId = null;
            try {
                const currentPlanResponse = await fetch(`${API_BASE_URL}/plans/current`);
                if (currentPlanResponse.ok) {
                    const currentPlanData = await currentPlanResponse.json();
                    if (currentPlanData && currentPlanData.id) {
                        currentPlanId = currentPlanData.id;
                    }
                } else {
                    console.warn('获取当前计划失败', currentPlanResponse.status);
                }
            } catch (error) {
                console.error('获取当前计划出错:', error);
                // 继续执行获取所有计划
            }
            
            // 获取所有计划
            const response = await fetch(`${API_BASE_URL}/plans/`);
            
            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }
            
            const plans = await response.json();
            
            if (plans && plans.length > 0) {
                renderPlanCards(plans, currentPlanId);
                showPlansGrid();
                hideNoPlansElement();
            } else {
                hidePlansGrid();
                showNoPlansElement();
            }
        } catch (error) {
            console.error('获取计划失败:', error);
            UI.showStatus(manageStatusDiv, `获取计划失败: ${error.message}`, 'error');
            hideLoadingElement();
            hidePlansGrid();
            showNoPlansElement('获取计划时出现错误，请刷新页面重试');
        } finally {
            // 隐藏加载中
            hideLoadingElement();
        }
    }
    
    // 渲染计划卡片
    function renderPlanCards(plans, currentPlanId) {
        if (!plansGrid) {
            console.error('[计划管理] 渲染失败: plansGrid元素不存在');
            return;
        }
        
        console.log('[计划管理] 渲染计划卡片:', plans);
        
        // 清空现有内容
        plansGrid.innerHTML = '';
        
        // 如果没有计划，显示空状态
        if (!plans || plans.length === 0) {
            console.log('[计划管理] 没有计划可显示');
            showNoPlansElement();
            return;
        }
        
        // 创建计划卡片
        plans.forEach((plan, index) => {
            const isCurrent = plan.id === currentPlanId;
            const totalTasks = plan.tasks ? plan.tasks.length : 0;
            const completedTasks = plan.tasks ? plan.tasks.filter(task => task.status === 'Complete').length : 0;
            const pendingTasks = totalTasks - completedTasks;
            
            console.log(`[计划管理] 渲染计划: ${plan.name}, ID: ${plan.id}, 当前计划: ${isCurrent}`);
            
            // 创建计划卡片HTML
            const planCard = document.createElement('div');
            planCard.className = `plan-card${isCurrent ? ' current' : ''} delay-${index % 5}00`;
            planCard.innerHTML = `
                <div class="plan-card-header">
                    <h3 class="plan-name">
                        ${UI.escapeHtml(plan.name)}
                        ${isCurrent ? '<span class="plan-current-badge"><i class="fas fa-star"></i> 当前计划</span>' : ''}
                    </h3>
                </div>
                <div class="plan-description">${UI.escapeHtml(plan.description || '无描述')}</div>
                <div class="plan-stats">
                    <div class="stat-item">
                        <div class="stat-value">${totalTasks}</div>
                        <div class="stat-label">总任务</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${completedTasks}</div>
                        <div class="stat-label">已完成</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${pendingTasks}</div>
                        <div class="stat-label">待完成</div>
                    </div>
                </div>
                <div class="plan-actions">
                    <button class="btn btn-sm btn-primary manage-tasks-btn" data-id="${plan.id}" title="管理任务">
                        <i class="fas fa-tasks"></i> 管理任务
                    </button>
                    ${!isCurrent ? `
                        <button class="btn btn-sm btn-success set-current-btn" data-id="${plan.id}" title="设为当前计划">
                            <i class="fas fa-star"></i> 设为当前
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-info next-tasks-btn" title="查看下一步任务">
                            <i class="fas fa-arrow-right"></i> 下一步任务
                        </button>
                    `}
                    <button class="btn btn-sm btn-danger delete-plan-btn" data-id="${plan.id}" title="删除计划">
                        <i class="fas fa-trash-alt"></i> 删除
                    </button>
                </div>
            `;
            
            // 添加到网格
            plansGrid.appendChild(planCard);
            
            // 动画显示
            setTimeout(() => {
                planCard.style.opacity = '1';
                planCard.style.transform = 'translateY(0)';
            }, 50 + index * 100);
        });
        
        // 显示计划网格
        plansGrid.style.display = 'grid';
        hideNoPlansElement();
        console.log('[计划管理] 计划渲染完成');
    }
    
    // 打开任务管理模态框
    function openTasksModal(planId) {
        console.log('正在打开任务管理，计划ID:', planId);
        
        // 尝试获取计划详情并显示任务
        showPlanDetail(planId);
        
        // 显示提示消息
        UI.showStatus(manageStatusDiv, '正在加载任务列表...', 'info');
        
        // 如果有独立任务管理器则调用它
        if (typeof TaskManager !== 'undefined' && typeof TaskManager.loadTasks === 'function') {
            TaskManager.loadTasks(planId);
        } else {
            console.info('当前页面未集成独立任务管理器，将通过计划详情显示任务');
        }
    }
    
    // 对外暴露API
    return {
        init,
        fetchPlans,
        showPlanDetail,
        showNextTasks
    };
})();

// 将模块添加到全局命名空间
window.PlanManager = PlanManager; 