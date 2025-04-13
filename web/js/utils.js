/**
 * utils.js - 通用工具函数
 * 提供全局辅助工具函数
 */

// 工具函数模块
const Utils = (function() {
    /**
     * HTML转义函数
     * @param {string} text - 要转义的文本
     * @returns {string} 转义后的安全HTML文本
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
     * 格式化日期时间
     * @param {string} dateString - ISO格式日期字符串
     * @returns {string} 格式化的日期时间字符串
     */
    function formatDateTime(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    /**
     * 格式化日期
     * @param {string} dateString - ISO格式日期字符串
     * @returns {string} 格式化的日期字符串
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
    
    /**
     * 生成随机ID
     * @returns {string} 唯一ID字符串
     */
    function generateId() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
    
    /**
     * 防抖函数
     * @param {Function} func - 要执行的函数
     * @param {number} wait - 等待时间(毫秒)
     * @returns {Function} 防抖处理后的函数
     */
    function debounce(func, wait = 300) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 节流函数
     * @param {Function} func - 要执行的函数
     * @param {number} limit - 限制时间间隔(毫秒)
     * @returns {Function} 节流处理后的函数
     */
    function throttle(func, limit = 300) {
        let inThrottle;
        
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    }
    
    /**
     * 深度克隆对象
     * @param {Object} obj - 要克隆的对象
     * @returns {Object} 克隆后的对象
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => deepClone(item));
        }
        
        if (obj instanceof Object) {
            const copy = {};
            Object.keys(obj).forEach(key => {
                copy[key] = deepClone(obj[key]);
            });
            return copy;
        }
        
        return obj;
    }
    
    // 对外暴露API
    return {
        escapeHtml,
        formatDateTime,
        formatDate,
        generateId,
        debounce,
        throttle,
        deepClone
    };
})();

// 将模块添加到全局命名空间
window.Utils = Utils; 