/**
 * task-manager.js - 任务管理模块
 * 处理任务的添加、编辑、删除和查看详情等功能
 */

// 任务管理模块
const TaskManager = (function() {
    // 私有变量
    let addTaskModal;
    let addTaskModalClose;
    let addTaskForm;
    let addTaskPlanId;
    let addTaskStatusDiv;
    let taskDependenciesSelect;
    let addTaskTitle;
    let commentsContainer;
    
    let API_BASE_URL;
    let currentTaskData = null;
    let currentMode = 'add'; // 'add' 或 'edit'
    
    let planId;
    let tasks = [];
    let statusFilter = "all";
    let currentTaskId = null;
    
    // DOM元素
    const taskModalOpen = document.getElementById('add-task-button');
    const taskModal = document.getElementById('add-task-modal');
    const taskModalClose = document.getElementById('close-task-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const deleteConfirmBtn = document.getElementById('confirm-delete-btn');
    const deleteConfirmClose = document.getElementById('close-delete-confirm');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const taskList = document.getElementById('task-list');
    const taskStatusFilter = document.getElementById('task-status-filter');
    const taskTemplate = document.getElementById('task-template');
    const commentForm = document.getElementById('comment-form');
    const commentTypeSelect = document.getElementById('comment-type');
    const commentContainer = document.getElementById('comments-container');
    
    // 初始化函数
    function init(config) {
        // 保存配置
        API_BASE_URL = config.API_BASE_URL || '';
        
        console.log('[任务管理] 正在初始化，API基础URL:', API_BASE_URL);
        
        // 初始化DOM元素引用
        addTaskModal = document.getElementById('add-task-modal');
        addTaskModalClose = document.getElementById('add-task-modal-close');
        addTaskForm = document.getElementById('add-task-form');
        addTaskPlanId = document.getElementById('add-task-plan-id');
        addTaskStatusDiv = document.getElementById('add-task-status');
        taskDependenciesSelect = document.getElementById('task-dependencies');
        addTaskTitle = document.getElementById('add-task-title');
        commentsContainer = document.getElementById('comments-container');
        
        // 检查必要元素是否存在
        const missingElements = [];
        if (!addTaskModal) missingElements.push('add-task-modal');
        if (!addTaskForm) missingElements.push('add-task-form');
        if (!addTaskPlanId) missingElements.push('add-task-plan-id');
        if (!addTaskStatusDiv) missingElements.push('add-task-status');
        if (!commentsContainer) missingElements.push('comments-container');
        
        if (missingElements.length > 0) {
            console.error('[任务管理] 初始化失败: 找不到以下DOM元素:', missingElements.join(', '));
            return;
        }
        
        console.log('[任务管理] DOM元素初始化成功');
        
        // 绑定事件
        bindEvents();
        
        console.log('[任务管理] 初始化完成');
        
        // 绑定模态框关闭事件，确保模态框关闭后刷新主任务列表
        if (addTaskModalClose) {
            addTaskModalClose.addEventListener('click', function() {
                UI.closeModal(document.getElementById('add-task-modal'));
                
                // 如果有当前计划ID，则刷新该计划的任务列表
                if (currentPlanId) {
                    console.log("关闭任务模态框，刷新计划任务列表：", currentPlanId);
                    fetchTasks(currentPlanId);
                    
                    // 触发自定义事件，通知其他组件更新
                    const taskModalClosedEvent = new CustomEvent('task-modal-closed', {
                        detail: { planId: currentPlanId }
                    });
                    document.dispatchEvent(taskModalClosedEvent);
                }
            });
        }
    }
    
    // 事件绑定
    function bindEvents() {
        // 添加任务表单提交
        if (addTaskForm) {
            addTaskForm.addEventListener('submit', handleTaskFormSubmit);
        }
        
        // 模态框关闭按钮点击事件
        if (addTaskModalClose) {
            addTaskModalClose.addEventListener('click', () => UI.closeModal(addTaskModal));
        }
        
        // 模态框背景点击关闭
        if (addTaskModal) {
            addTaskModal.addEventListener('click', e => {
                if (e.target === addTaskModal) {
                    UI.closeModal(addTaskModal);
                }
            });
        }
        
        // 监听任务编辑模态框内的点击事件(进行事件委托)
        if (addTaskForm) {
            addTaskForm.addEventListener('click', handleTaskFormClick);
        }
    }
    
    // 任务表单点击处理(事件委托)
    async function handleTaskFormClick(e) {
        // 阻止表单提交按钮的默认行为
        if (e.target.type === 'submit' && e.target.closest('form') !== addTaskForm) {
            e.preventDefault();
        }
        
        // 处理状态更新按钮点击
        const statusButton = e.target.closest('.update-status-btn');
        if (statusButton && currentTaskData) {
            e.preventDefault();
            const newStatus = statusButton.dataset.status;
            const planId = currentTaskData.planId;
            const taskId = currentTaskData.id;
            
            if (newStatus && planId && taskId) {
                // 移除其他按钮的活动状态
                document.querySelectorAll('.update-status-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // 添加当前按钮的活动状态
                statusButton.classList.add('active');
                
                // 调用状态更新函数，但不再通过handleUpdateStatus间接调用，避免重复确认
                await updateTaskStatus(planId, taskId, newStatus, false); // 传false表示不显示确认弹窗
            }
        }
        
        // 处理删除任务按钮点击
        const deleteButton = e.target.closest('.delete-task-btn');
        if (deleteButton && currentTaskData) {
            e.preventDefault();
            const planId = currentTaskData.planId;
            const taskId = currentTaskData.id;
            
            if (planId && taskId) {
                await handleDeleteTask(planId, taskId);
            }
        }
        
        // 处理添加评论按钮点击
        const addCommentButton = e.target.closest('.add-comment-btn');
        if (addCommentButton && currentTaskData) {
            e.preventDefault();
            showAddCommentForm();
        }
        
        // 处理编辑评论按钮点击
        const editCommentButton = e.target.closest('.edit-comment-btn');
        if (editCommentButton && currentTaskData) {
            e.preventDefault();
            const commentId = editCommentButton.dataset.id;
            if (commentId) {
                const commentItem = editCommentButton.closest('.comment-item');
                const commentContent = commentItem?.querySelector('.comment-content')?.textContent.trim();
                const commentType = commentItem?.querySelector('.comment-type')?.textContent.trim().split(' ').pop(); // 获取类型文本
                
                showEditCommentForm(commentId, commentContent, commentType);
            }
        }
        
        // 处理评论表单提交
        const commentForm = e.target.closest('.comment-form');
        if (commentForm && e.target.type === 'submit') {
            e.preventDefault();
            
            // 检查是否是编辑表单
            if (commentForm.classList.contains('edit-form')) {
                handleEditCommentFormSubmit(commentForm);
            } else {
                handleAddCommentFormSubmit(commentForm);
            }
        }
        
        // 处理评论表单取消
        const cancelCommentButton = e.target.closest('.cancel-comment-btn');
        if (cancelCommentButton) {
            e.preventDefault();
            const commentFormContainer = cancelCommentButton.closest('.comment-form');
            if (commentFormContainer) {
                commentFormContainer.remove();
            }
        }
        
        // 处理删除评论按钮点击
        const deleteCommentButton = e.target.closest('.delete-comment-btn');
        if (deleteCommentButton && currentTaskData) {
            e.preventDefault();
            const commentId = deleteCommentButton.dataset.id;
            
            if (commentId) {
                await handleDeleteComment(currentTaskData.planId, currentTaskData.id, commentId);
            }
        }
    }
    
    // 任务表单提交处理
    async function handleTaskFormSubmit(e) {
        e.preventDefault();
        
        const planId = addTaskPlanId.value;
        const titleInput = document.getElementById('task-title');
        const descriptionInput = document.getElementById('task-description');
        const orderInput = document.getElementById('task-order');
        
        if (!planId || !titleInput) {
            UI.showStatus(addTaskStatusDiv, '缺少必要字段', 'error');
            return;
        }
        
        const title = titleInput.value.trim();
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        const order = orderInput && orderInput.value ? parseInt(orderInput.value.trim(), 10) : null;
        
        if (!title) {
            UI.showStatus(addTaskStatusDiv, '请输入任务标题', 'error');
            return;
        }
        
        // 获取依赖任务
        const dependencies = Array.from(taskDependenciesSelect.selectedOptions).map(option => option.value);
        
        if (currentMode === 'add') {
            // 添加新任务
            UI.showStatus(addTaskStatusDiv, '正在添加任务，请稍候...', 'info', 0);
            
            try {
                const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: title,
                        description: description,
                        order: order,
                        dependencies: dependencies
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    UI.showStatus(addTaskStatusDiv, '任务添加成功', 'success');
                    addTaskForm.reset();
                    commentsContainer.innerHTML = '';
                    UI.closeModal(addTaskModal);
                    
                    // 刷新计划详情或计划列表
                    if (typeof PlanManager !== 'undefined') {
                        PlanManager.fetchPlans();
                    }
                } else {
                    throw new Error(result.message || '添加任务失败');
                }
            } catch (error) {
                console.error('添加任务出错:', error);
                UI.showStatus(addTaskStatusDiv, `添加任务失败: ${error.message}`, 'error');
            }
        } else {
            // 更新现有任务
            UI.showStatus(addTaskStatusDiv, '正在更新任务...', 'info', 0);
            
            try {
                const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${currentTaskData.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title,
                        description,
                        order,
                        dependencies
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`更新任务失败: ${response.status}`);
                }
                
                UI.showStatus(addTaskStatusDiv, '任务更新成功!', 'success');
                
                // 刷新计划详情或列表
                if (typeof PlanManager !== 'undefined') {
                    PlanManager.fetchPlans();
                }
            } catch (error) {
                console.error('更新任务失败:', error);
                UI.showStatus(addTaskStatusDiv, `更新失败: ${error.message}`, 'error');
            }
        }
    }
    
    // 打开添加任务模态框
    function openAddTaskModal(planId, existingTasks = []) {
        if (!addTaskModal || !addTaskForm || !addTaskPlanId || !taskDependenciesSelect) {
            console.error('[任务管理] 无法打开添加任务模态框: 元素不存在');
            return;
        }
        
        // 设置模式
        currentMode = 'add';
        currentTaskData = null;
        
        // 设置模态框标题
        if (addTaskTitle) {
            addTaskTitle.textContent = '添加任务';
        }
        
        // 显示/隐藏状态和评论区域
        toggleEditFormSections(false);
        
        // 设置计划ID
        addTaskPlanId.value = planId;
        
        // 重置表单
        addTaskForm.reset();
        
        // 清空评论容器
        if (commentsContainer) {
            commentsContainer.innerHTML = '';
        }
        
        // 清空状态消息
        if (addTaskStatusDiv) {
            addTaskStatusDiv.innerHTML = '';
        }
        
        // 填充依赖任务选择框
        populateDependenciesSelect(existingTasks);
        
        // 打开模态框
        UI.openModal(addTaskModal);
    }
    
    // 填充依赖任务选择框
    function populateDependenciesSelect(tasks) {
        if (!taskDependenciesSelect) return;
        
        // 清空现有选项
        taskDependenciesSelect.innerHTML = '';
        
        // 添加任务选项
        if (tasks && tasks.length > 0) {
            tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.id;
                option.textContent = task.title;
                taskDependenciesSelect.appendChild(option);
            });
        }
    }
    
    // 加载任务列表
    async function loadTasks(planIdParam) {
        // 保存planId到模块变量
        planId = planIdParam;
        
        console.log(`正在加载计划(${planId})的任务列表`);
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks`);
            if (!response.ok) {
                throw new Error(`获取任务列表失败: ${response.status}`);
            }
            
            const tasksData = await response.json();
            console.log(`成功加载 ${tasksData.length} 个任务`);
            
            // 保存任务数据
            tasks = tasksData;
            
            // 渲染任务列表
            renderTaskList();
            
            return tasksData;
        } catch (error) {
            console.error('加载任务失败:', error);
            return [];
        }
    }
    
    // 打开编辑任务模态框 (现在同时承担查看和编辑功能)
    async function openEditTaskModal(planId, taskId) {
        // 设置模式
        currentMode = 'edit';
        
        // 检查必要元素是否存在
        if (!addTaskModal || !addTaskForm || !addTaskStatusDiv) {
            console.error('[任务管理] 无法打开编辑任务模态框: 元素不存在');
            return;
        }
        
        // 设置模态框标题
        if (addTaskTitle) {
            addTaskTitle.textContent = '查看/编辑任务';
        }
        
        // 显示加载信息
        UI.showStatus(addTaskStatusDiv, '正在加载任务数据...', 'info');
        
        try {
            // 如果传入的taskId是对象，则直接使用
            let taskData;
            if (typeof taskId === 'object' && taskId !== null) {
                taskData = taskId;
            } else {
                // 否则从API获取任务数据
                const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${taskId}`);
                
                if (!response.ok) {
                    throw new Error(`获取任务详情失败: ${response.status}`);
                }
                
                taskData = await response.json();
            }
            
            console.log('获取到任务数据:', taskData);
            
            // 保存当前任务数据
            currentTaskData = { ...taskData, planId };
            
            // 填充表单数据
            fillTaskForm(taskData, planId);
            
            // 显示状态和评论区域
            toggleEditFormSections(true);
            
            // 渲染评论区域
            renderCommentsInContainer(taskData.comments || []);
            
            // 打开模态框
            UI.openModal(addTaskModal);
            
            // 清除加载状态
            UI.showStatus(addTaskStatusDiv, '', 'info', 0);
            
            // 注意：不再单独绑定状态按钮事件，依靠事件委托处理
            // 这样避免事件重复绑定导致多次确认弹窗
            
        } catch (error) {
            console.error('获取任务详情失败:', error);
            UI.showStatus(addTaskStatusDiv, `无法加载任务: ${error.message}`, 'error');
        }
    }
    
    // 填充任务表单
    function fillTaskForm(task, planId) {
        const titleInput = document.getElementById('task-title');
        const descriptionInput = document.getElementById('task-description');
        const orderInput = document.getElementById('task-order');
        
        if (titleInput) titleInput.value = task.title || '';
        if (descriptionInput) descriptionInput.value = task.description || '';
        if (orderInput) orderInput.value = task.order || '';
        
        // 设置隐藏字段
        if (addTaskPlanId) addTaskPlanId.value = planId;
        
        // 高亮当前状态按钮
        highlightCurrentStatus(task.status);
        
        // 加载可依赖的任务并设置选中
        loadTasks(planId).then(tasks => {
            populateDependenciesSelect(tasks.filter(t => t.id !== task.id));
            
            // 选中已有的依赖
            if (task.dependencies && task.dependencies.length > 0) {
                for (const depId of task.dependencies) {
                    const option = taskDependenciesSelect.querySelector(`option[value="${depId}"]`);
                    if (option) option.selected = true;
                }
            }
        });
    }
    
    // 高亮当前状态按钮
    function highlightCurrentStatus(status) {
        const statusButtons = document.querySelectorAll('.update-status-btn');
        statusButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.status === status) {
                btn.classList.add('active');
            }
        });
    }
    
    // 切换编辑表单的附加部分
    function toggleEditFormSections(show) {
        console.log(`[任务管理] 切换编辑表单部分，show=${show}`);
        
        const statusSection = document.querySelector('.task-status-section');
        const commentsSection = document.querySelector('.comments-section');
        const deleteButton = document.querySelector('.delete-task-btn');
        const addCommentButton = document.querySelector('.add-comment-btn');
        
        if (statusSection) {
            statusSection.style.display = show ? 'block' : 'none';
            console.log(`[任务管理] 状态部分 ${show ? '显示' : '隐藏'}`);
        } else {
            console.warn('[任务管理] 未找到状态部分元素');
        }
        
        if (commentsSection) {
            commentsSection.style.display = show ? 'block' : 'none';
            console.log(`[任务管理] 评论部分 ${show ? '显示' : '隐藏'}`);
        } else {
            console.warn('[任务管理] 未找到评论部分元素');
        }
        
        if (deleteButton) {
            deleteButton.style.display = show ? 'inline-flex' : 'none';
            console.log(`[任务管理] 删除按钮 ${show ? '显示' : '隐藏'}`);
        } else {
            console.warn('[任务管理] 未找到删除按钮元素');
        }
        
        if (addCommentButton) {
            addCommentButton.style.display = show ? 'inline-flex' : 'none';
            console.log(`[任务管理] 添加评论按钮 ${show ? '显示' : '隐藏'}`);
        } else {
            console.warn('[任务管理] 未找到添加评论按钮元素');
        }
    }
    
    // 在容器中渲染评论
    function renderCommentsInContainer(comments) {
        if (!commentsContainer) return;
        
        if (!comments || comments.length === 0) {
            commentsContainer.innerHTML = `
                <div class="no-comments-message">
                    <i class="fas fa-comments"></i> 暂无评论，添加第一条评论吧！
                </div>
            `;
            return;
        }
        
        commentsContainer.innerHTML = comments.map(comment => `
            <div class="comment-item" data-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-type ${comment.type.toLowerCase()}">
                        ${getCommentTypeIcon(comment.type)} ${comment.type}
                    </span>
                    <span class="comment-date">${UI.formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-content">
                    ${UI.escapeHtml(comment.content)}
                </div>
                <div class="comment-actions">
                    <button class="btn btn-sm btn-primary edit-comment-btn" data-id="${comment.id}">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn btn-sm btn-danger delete-comment-btn" data-id="${comment.id}">
                        <i class="fas fa-trash-alt"></i> 删除
                    </button>
                </div>
            </div>
        `).join('');
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
    
    // 获取评论类型图标
    function getCommentTypeIcon(type) {
        switch (type) {
            case 'Note': return '<i class="fas fa-sticky-note"></i>';
            case 'Question': return '<i class="fas fa-question-circle"></i>';
            case 'Suggestion': return '<i class="fas fa-lightbulb"></i>';
            case 'Issue': return '<i class="fas fa-exclamation-circle"></i>';
            case 'Other': return '<i class="fas fa-comment"></i>';
            default: return '<i class="fas fa-comment"></i>';
        }
    }
    
    // 显示添加评论表单
    function showAddCommentForm() {
        if (!commentsContainer || !currentTaskData) return;
        
        // 如果已有评论表单，不再添加
        if (commentsContainer.querySelector('.comment-form')) {
            return;
        }
        
        const formHTML = `
            <div class="comment-form">
                <div class="form-group">
                    <label for="comment-content">评论内容</label>
                    <textarea id="comment-content" class="custom-textarea" placeholder="输入您的评论..." required></textarea>
                </div>
                <div class="form-group">
                    <label for="comment-type">评论类型</label>
                    <select id="comment-type" class="custom-select comment-type-select">
                        <option value="Note">Note</option>
                        <option value="Question">Question</option>
                        <option value="Suggestion">Suggestion</option>
                        <option value="Issue">Issue</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div id="comment-status" class="status-container"></div>
                <div class="form-actions">
                    <button type="button" class="btn btn-primary submit-comment-btn">
                        <i class="fas fa-save"></i> 添加评论
                    </button>
                    <button type="button" class="btn btn-light cancel-comment-btn">
                        <i class="fas fa-times"></i> 取消
                    </button>
                </div>
            </div>
        `;
        
        // 添加到容器的开头
        commentsContainer.insertAdjacentHTML('afterbegin', formHTML);
        
        // 绑定评论提交事件
        const submitBtn = commentsContainer.querySelector('.submit-comment-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                const form = this.closest('.comment-form');
                if (form) {
                    handleAddCommentFormSubmit(form);
                }
            });
        }
    }
    
    // 处理添加评论表单提交
    async function handleAddCommentFormSubmit(form) {
        if (!currentTaskData) return;
        
        const contentInput = form.querySelector('#comment-content');
        const typeSelect = form.querySelector('#comment-type');
        const statusDiv = form.querySelector('#comment-status');
        
        if (!contentInput || !typeSelect) {
            if (statusDiv) {
                UI.showStatus(statusDiv, '缺少必要字段', 'error');
            }
            return;
        }
        
        const content = contentInput.value.trim();
        const type = typeSelect.value;
        
        if (!content) {
            if (statusDiv) {
                UI.showStatus(statusDiv, '请输入评论内容', 'error');
            }
            return;
        }
        
        if (statusDiv) {
            UI.showStatus(statusDiv, '正在添加评论，请稍候...', 'info', 0);
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${currentTaskData.planId}/tasks/${currentTaskData.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content,
                    type: type
                })
            });
            
            if (!response.ok) {
                throw new Error(`添加评论失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (statusDiv) {
                UI.showStatus(statusDiv, '评论添加成功!', 'success');
            }
            
            // 刷新当前任务数据
            const taskResponse = await fetch(`${API_BASE_URL}/plans/${currentTaskData.planId}/tasks/${currentTaskData.id}`);
            const updatedTask = await taskResponse.json();
            
            // 更新当前任务数据
            currentTaskData = { ...updatedTask, planId: currentTaskData.planId };
            
            // 重新渲染评论列表
            renderCommentsInContainer(currentTaskData.comments || []);
            
        } catch (error) {
            console.error('添加评论出错:', error);
            if (statusDiv) {
                UI.showStatus(statusDiv, `添加评论失败: ${error.message}`, 'error');
            }
        }
    }
    
    // 更新任务状态
    async function updateTaskStatus(planId, taskId, newStatus, showConfirm = true) {
        console.log("尝试更新任务状态:", newStatus, "计划ID:", planId, "任务ID:", taskId);
        
        // 如果需要确认且用户取消，则不执行更新
        if (showConfirm && !confirm(`确定要将任务状态更新为"${newStatus}"吗?`)) {
            return;
        }
        
        UI.showLoading("正在更新任务状态...");
        
        // 第一种格式：尝试使用标准JSON对象
        fetch(`${API_BASE_URL}/plans/${planId}/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        })
        .then(response => {
            // 记录响应状态
            console.log("状态更新响应状态:", response.status);
            
            // 无论成功与否，尝试解析响应内容
            return response.text().then(text => {
                // 尝试将响应解析为JSON（如果可能）
                try {
                    const data = JSON.parse(text);
                    console.log("状态更新响应内容:", data);
                    if (!response.ok) {
                        throw new Error(data.detail || "更新失败");
                    }
                    return data;
                } catch (e) {
                    console.log("原始响应内容:", text);
                    if (!response.ok) {
                        throw new Error("更新失败: " + text);
                    }
                    return { message: "更新成功" };
                }
            });
        })
        .then(data => {
            console.log("任务状态更新成功:", data);
            UI.showSuccess("任务状态更新成功！");
            
            // 更新当前任务数据
            if (currentTaskData && currentTaskData.id === taskId) {
                currentTaskData.status = newStatus;
            }
            
            // 重要：使用全局触发事件通知所有任务管理器实例刷新数据
            const taskUpdateEvent = new CustomEvent('task-status-updated', {
                detail: { planId, taskId, newStatus }
            });
            document.dispatchEvent(taskUpdateEvent);
            
            // 重新获取任务列表并刷新显示
            fetchTasks(planId);
            
            // 如果有planManager实例，刷新计划列表
            if (typeof PlanManager !== 'undefined') {
                PlanManager.fetchPlans();
            }
        })
        .catch(error => {
            console.error("更新任务状态时出错:", error);
            UI.showError(`更新任务状态失败: ${error.message}`);
        })
        .finally(() => {
            UI.hideLoading();
        });
    }
    
    // 删除任务
    async function handleDeleteTask(planId, taskId) {
        if (!confirm('确定要删除这个任务吗？此操作不可恢复！')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${taskId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`删除任务失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            UI.showStatus(addTaskStatusDiv, '任务删除成功', 'success');
            
            // 关闭模态框
            setTimeout(() => {
                UI.closeModal(addTaskModal);
                
                // 刷新计划详情或计划列表
                if (typeof PlanManager !== 'undefined' && typeof PlanManager.fetchPlans === 'function') {
                    PlanManager.fetchPlans();
                }
            }, 1000);
        } catch (error) {
            console.error('删除任务出错:', error);
            UI.showStatus(addTaskStatusDiv, `删除失败: ${error.message}`, 'error');
        }
    }
    
    // 删除评论
    async function handleDeleteComment(planId, taskId, commentId) {
        if (!confirm('确定要删除这个评论吗？此操作不可恢复！')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${taskId}/comments/${commentId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`删除评论失败: ${response.status}`);
            }
            
            // 刷新当前任务数据
            const taskResponse = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${taskId}`);
            const updatedTask = await taskResponse.json();
            
            // 更新当前任务数据
            currentTaskData = { ...updatedTask, planId };
            
            // 重新渲染评论列表
            renderCommentsInContainer(currentTaskData.comments || []);
            
            UI.showStatus(addTaskStatusDiv, '评论删除成功', 'success', 2000);
            
        } catch (error) {
            console.error('删除评论出错:', error);
            UI.showStatus(addTaskStatusDiv, `删除评论失败: ${error.message}`, 'error');
        }
    }
    
    // 获取任务列表
    function fetchTasks() {
        UI.showLoading();
        
        fetch(`${API_BASE_URL}/plans/${planId}/tasks`)
        .then(response => {
            if (!response.ok) {
                throw new Error('获取任务列表失败');
            }
            return response.json();
        })
        .then(data => {
            tasks = data || [];
            renderTaskList();
        })
        .catch(error => {
            console.error('Error:', error);
            UI.showNotification(error.message, 'danger');
        })
        .finally(() => {
            UI.hideLoading();
        });
    }
    
    // 渲染任务列表
    function renderTaskList() {
        if (!taskList) return;
        
        taskList.innerHTML = '';
        
        if (tasks.length === 0) {
            taskList.innerHTML = '<div class="empty-message">暂无任务，请添加新任务</div>';
            return;
        }
        
        // 根据状态过滤任务
        const filteredTasks = statusFilter === 'all' 
            ? tasks 
            : tasks.filter(task => task.status === statusFilter);
        
        if (filteredTasks.length === 0) {
            taskList.innerHTML = '<div class="empty-message">没有符合当前筛选条件的任务</div>';
            return;
        }
        
        filteredTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card ${getTaskStatusClass(task.status)} fade-in`;
            card.setAttribute('data-id', task.id);
            
            // 构建任务标签HTML
            let tagsHtml = '';
            if (task.tags && task.tags.length > 0) {
                tagsHtml = '<div class="task-tags">';
                task.tags.forEach(tag => {
                    tagsHtml += `<span class="task-tag">${UI.escapeHtml(tag)}</span>`;
                });
                tagsHtml += '</div>';
            }

            card.innerHTML = `
                <div class="task-card-header">
                    <h3 class="task-title">${UI.escapeHtml(task.title)}</h3>
                    <div class="task-status-badge ${getTaskStatusClass(task.status)}">
                        ${getTaskStatusIcon(task.status)} ${task.status}
                    </div>
                </div>
                <div class="task-description">${UI.escapeHtml(task.description || '')}</div>
                ${tagsHtml}
                <div class="task-footer">
                    <div class="task-actions">
                        <button class="btn btn-sm btn-primary edit-task-btn" data-id="${task.id}" title="查看/编辑任务">
                            <i class="fas fa-edit"></i> 查看/编辑
                        </button>
                        <button class="btn btn-sm btn-danger delete-task-btn" data-id="${task.id}" title="删除任务">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="task-status-selector">
                        <select class="task-status-select" data-id="${task.id}">
                            <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>待处理</option>
                            <option value="Working" ${task.status === 'Working' ? 'selected' : ''}>进行中</option>
                            <option value="Complete" ${task.status === 'Complete' ? 'selected' : ''}>已完成</option>
                        </select>
                    </div>
                </div>
            `;
            
            taskList.appendChild(card);
        });
        
        // 绑定任务事件
        bindTaskEvents();
    }
    
    // 绑定任务事件
    function bindTaskEvents() {
        const editButtons = document.querySelectorAll('.edit-task-btn');
        const deleteButtons = document.querySelectorAll('.delete-task-btn');
        const statusSelectors = document.querySelectorAll('.task-status-select');
        
        editButtons.forEach(button => {
            button.addEventListener('click', handleEditTask);
        });
        
        deleteButtons.forEach(button => {
            button.addEventListener('click', handleDeleteTask);
        });
        
        statusSelectors.forEach(selector => {
            selector.addEventListener('change', function(e) {
                const taskId = this.dataset.id;
                const newStatus = this.value;
                updateTaskStatus(planId, taskId, newStatus);
            });
        });
    }
    
    // 处理编辑任务
    function handleEditTask(e) {
        const taskId = e.currentTarget.dataset.id;
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            openEditTaskModal(planId, taskId);
        } else {
            console.error(`任务ID ${taskId} 未找到`);
            UI.showNotification('无法找到该任务', 'error');
        }
    }
    
    // 处理删除任务
    function handleDeleteTask(e) {
        const taskId = e.currentTarget.dataset.id;
        currentTaskId = taskId;
        openDeleteConfirmModal();
    }
    
    // 处理更新任务状态
    function handleUpdateStatus(e) {
        console.log("状态按钮被点击");
        const button = e.currentTarget;
        
        if (!currentTaskData) {
            console.error("更新状态失败：当前任务数据不存在");
            return;
        }
        
        const taskId = currentTaskData.id;
        const newStatus = button.dataset.status;
        
        console.log(`点击的状态按钮: ${newStatus}, 任务ID: ${taskId}`);
        
        // 移除其他按钮的活动状态
        document.querySelectorAll('.update-status-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 添加当前按钮的活动状态
        button.classList.add('active');
        
        // 使用状态按钮上的状态值，不需要转换
        if (currentTaskData && currentTaskData.planId && taskId) {
            updateTaskStatus(currentTaskData.planId, taskId, newStatus, true); // 显式传true表示要显示确认弹窗
        } else {
            console.error("无法更新状态：缺少必要参数", {
                planId: currentTaskData?.planId,
                taskId: taskId
            });
        }
    }
    
    // 打开删除确认模态窗口
    function openDeleteConfirmModal() {
        deleteConfirmModal.classList.add('active');
        document.body.classList.add('modal-open');
        
        // 绑定删除确认事件
        deleteConfirmBtn.onclick = confirmDeleteTask;
    }
    
    // 关闭删除确认模态窗口
    function closeDeleteConfirmModal() {
        deleteConfirmModal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
    
    // 确认删除任务
    async function confirmDeleteTask() {
        if (!currentTaskId) return;
        
        UI.showLoading();
        
        try {
            const response = await fetch(`${API_BASE_URL}/plans/${planId}/tasks/${currentTaskId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`删除任务失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            UI.showStatus(addTaskStatusDiv, '任务删除成功', 'success');
            
            // 关闭模态框
            setTimeout(() => {
                UI.closeModal(addTaskModal);
                
                // 刷新计划详情或计划列表
                if (typeof PlanManager !== 'undefined' && typeof PlanManager.fetchPlans === 'function') {
                    PlanManager.fetchPlans();
                }
            }, 1000);
        } catch (error) {
            console.error('删除任务出错:', error);
            UI.showStatus(addTaskStatusDiv, `删除失败: ${error.message}`, 'error');
        } finally {
            UI.hideLoading();
        }
    }
    
    // 关闭任务模态窗口
    function closeTaskModal() {
        taskModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        
        // 重置表单
        if (addTaskForm) {
            addTaskForm.reset();
        }
        
        // 清空评论容器
        if (commentContainer) {
            commentContainer.innerHTML = '';
        }
    }
    
    // 添加全局事件监听器来响应任务状态更新事件
    document.addEventListener('task-status-updated', function(event) {
        const { planId } = event.detail;
        console.log("检测到任务状态更新事件，刷新计划任务：", planId);
        
        // 如果当前正在查看的是相同的计划，则刷新任务列表
        if (currentPlanId === planId) {
            fetchTasks(planId);
        }
    });
    
    // 添加显示编辑评论表单的函数
    function showEditCommentForm(commentId, content, type) {
        if (!commentsContainer || !currentTaskData) return;
        
        // 如果已有评论表单，先移除
        const existingForm = commentsContainer.querySelector('.comment-form');
        if (existingForm) {
            existingForm.remove();
        }
        
        // 找到要编辑的评论元素
        const commentItem = commentsContainer.querySelector(`.comment-item[data-id="${commentId}"]`);
        if (!commentItem) return;
        
        // 创建编辑表单
        const formHTML = `
            <div class="comment-form edit-form" data-comment-id="${commentId}">
                <div class="form-group">
                    <label for="edit-comment-content">评论内容</label>
                    <textarea id="edit-comment-content" class="custom-textarea" placeholder="输入您的评论..." required>${UI.escapeHtml(content)}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-comment-type">评论类型</label>
                    <select id="edit-comment-type" class="custom-select comment-type-select">
                        <option value="Note" ${type === 'Note' ? 'selected' : ''}>Note</option>
                        <option value="Question" ${type === 'Question' ? 'selected' : ''}>Question</option>
                        <option value="Suggestion" ${type === 'Suggestion' ? 'selected' : ''}>Suggestion</option>
                        <option value="Issue" ${type === 'Issue' ? 'selected' : ''}>Issue</option>
                        <option value="Other" ${type === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div id="edit-comment-status" class="status-container"></div>
                <div class="form-actions">
                    <button type="button" class="btn btn-primary submit-comment-btn">
                        <i class="fas fa-save"></i> 保存修改
                    </button>
                    <button type="button" class="btn btn-light cancel-comment-btn">
                        <i class="fas fa-times"></i> 取消
                    </button>
                </div>
            </div>
        `;
        
        // 将表单插入到评论后面
        commentItem.insertAdjacentHTML('afterend', formHTML);
        
        // 绑定评论提交事件
        const submitBtn = commentsContainer.querySelector('.submit-comment-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                const form = this.closest('.comment-form');
                if (form) {
                    handleEditCommentFormSubmit(form);
                }
            });
        }
    }
    
    // 添加处理编辑评论表单提交的函数
    async function handleEditCommentFormSubmit(form) {
        if (!currentTaskData) return;
        
        const commentId = form.dataset.commentId;
        const contentInput = form.querySelector('#edit-comment-content');
        const typeSelect = form.querySelector('#edit-comment-type');
        const statusDiv = form.querySelector('#edit-comment-status');
        
        if (!commentId || !contentInput || !typeSelect) {
            if (statusDiv) {
                UI.showStatus(statusDiv, '缺少必要字段', 'error');
            }
            return;
        }
        
        const content = contentInput.value.trim();
        const type = typeSelect.value;
        
        if (!content) {
            if (statusDiv) {
                UI.showStatus(statusDiv, '请输入评论内容', 'error');
            }
            return;
        }
        
        if (statusDiv) {
            UI.showStatus(statusDiv, '正在更新评论，请稍候...', 'info', 0);
        }
        
        try {
            // 由于后端没有直接修改评论的API，我们采用先删除后添加的策略
            
            // 步骤1：删除旧评论
            const deleteResponse = await fetch(`${API_BASE_URL}/plans/${currentTaskData.planId}/tasks/${currentTaskData.id}/comments/${commentId}`, {
                method: 'DELETE'
            });
            
            if (!deleteResponse.ok) {
                throw new Error(`删除原评论失败: ${deleteResponse.status}`);
            }
            
            // 步骤2：添加新评论
            const addResponse = await fetch(`${API_BASE_URL}/plans/${currentTaskData.planId}/tasks/${currentTaskData.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content,
                    type: type
                })
            });
            
            if (!addResponse.ok) {
                throw new Error(`添加新评论失败: ${addResponse.status}`);
            }
            
            const result = await addResponse.json();
            
            if (statusDiv) {
                UI.showStatus(statusDiv, '评论更新成功!', 'success');
            }
            
            // 刷新当前任务数据
            const taskResponse = await fetch(`${API_BASE_URL}/plans/${currentTaskData.planId}/tasks/${currentTaskData.id}`);
            const updatedTask = await taskResponse.json();
            
            // 更新当前任务数据
            currentTaskData = { ...updatedTask, planId: currentTaskData.planId };
            
            // 重新渲染评论列表
            renderCommentsInContainer(currentTaskData.comments || []);
            
        } catch (error) {
            console.error('更新评论出错:', error);
            if (statusDiv) {
                UI.showStatus(statusDiv, `更新评论失败: ${error.message}`, 'error');
            }
        }
    }
    
    // 对外暴露API
    return {
        init,
        openAddTaskModal,
        openEditTaskModal,
        loadTasks
    };
})();

// 将模块添加到全局命名空间
window.TaskManager = TaskManager; 