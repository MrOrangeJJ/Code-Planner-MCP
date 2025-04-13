/**
 * ui-helpers.js - UI辅助函数
 * 提供通用UI操作的辅助函数
 */

// UI辅助模块
const UI = (function() {
    /**
     * 添加波纹效果
     * @param {Event} e - 点击事件
     */
    function addRippleEffect(e) {
        const target = e.target;
        
        if (target.classList.contains('btn')) {
            const rect = target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            target.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        }
    }
    
    /**
     * 显示元素
     * @param {HTMLElement} element - 要显示的元素
     */
    function showElement(element) {
        if (!element) return;
        element.style.display = 'block';
    }
    
    /**
     * 隐藏元素
     * @param {HTMLElement} element - 要隐藏的元素
     */
    function hideElement(element) {
        if (!element) return;
        element.style.display = 'none';
    }
    
    /**
     * 显示状态消息
     * @param {HTMLElement} statusElement - 状态容器元素
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (info, success, warning, error)
     * @param {number} [timeout] - 自动消失时间(毫秒)，为0则不自动消失
     */
    function showStatus(statusElement, message, type, timeout = 5000) {
        if (!statusElement) return;
        
        statusElement.innerHTML = `
            <div class="status-message">
                <p class="status-${type}">${message}</p>
            </div>
        `;
        
        if (timeout > 0) {
            setTimeout(() => {
                statusElement.innerHTML = '';
            }, timeout);
        }
    }
    
    /**
     * 切换加载状态
     * @param {HTMLElement} loadingElement - 加载指示器元素
     * @param {boolean} isLoading - 是否加载中
     */
    function toggleLoading(loadingElement, isLoading) {
        if (!loadingElement) return;
        
        if (isLoading) {
            loadingElement.style.display = 'flex';
        } else {
            loadingElement.style.display = 'none';
        }
    }
    
    /**
     * 打开模态框
     * @param {HTMLElement} modalElement - 模态框元素
     */
    function openModal(modalElement) {
        if (!modalElement) return;
        
        modalElement.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * 关闭模态框
     * @param {HTMLElement} modalElement - 模态框元素
     */
    function closeModal(modalElement) {
        if (!modalElement) return;
        
        modalElement.classList.remove('open');
        document.body.style.overflow = '';
    }
    
    /**
     * 格式化日期
     * @param {string} dateString - ISO日期字符串
     * @returns {string} 格式化的日期字符串
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    /**
     * HTML转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的HTML安全文本
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    /**
     * 创建元素带类名
     * @param {string} tag - HTML标签名
     * @param {string} [className] - CSS类名
     * @param {string} [text] - 文本内容
     * @returns {HTMLElement} 创建的元素
     */
    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        
        if (className) {
            element.className = className;
        }
        
        if (text) {
            element.textContent = text;
        }
        
        return element;
    }
    
    /**
     * 显示加载指示器
     */
    function showLoading() {
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
    }
    
    /**
     * 隐藏加载指示器
     */
    function hideLoading() {
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
    
    /**
     * 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, info, warning, danger)
     * @param {number} [timeout] - 自动消失时间(毫秒)，为0则不自动消失
     */
    function showNotification(message, type, timeout = 3000) {
        // 获取或创建通知容器
        let notificationContainer = document.getElementById('notification-container');
        
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            document.body.appendChild(notificationContainer);
        }
        
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <p>${escapeHtml(message)}</p>
            </div>
            <button class="notification-close">×</button>
        `;
        
        // 添加到容器
        notificationContainer.appendChild(notification);
        
        // 绑定关闭按钮
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.classList.add('closing');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            });
        }
        
        // 设置自动消失
        if (timeout > 0) {
            setTimeout(() => {
                notification.classList.add('closing');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, timeout);
        }
    }
    
    // 对外暴露API
    return {
        addRippleEffect,
        showElement,
        hideElement,
        showStatus,
        toggleLoading,
        openModal,
        closeModal,
        formatDate,
        escapeHtml,
        createElement,
        showLoading,
        hideLoading,
        showNotification
    };
})();

// 将模块添加到全局命名空间
window.UI = UI; 