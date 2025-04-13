from datetime import datetime
from typing import Dict, List, Optional, Union, Any
import logging

from ..models.schemas import (
    Plan, PlanCreate, PlanUpdate,
    Task, TaskCreate, TaskUpdate, TaskStatusUpdate,
    Comment, CommentCreate, CommentType,
    CurrentPlan, TaskStatus
)
from ..utils.file_handler import load_json, save_json, datetime_parser
from ..config import settings
from ..agents.plan_parser import PlanParserAgent

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PlanService:
    """计划管理服务，处理计划的CRUD操作"""
    
    def __init__(self):
        """初始化服务，确保数据目录存在"""
        settings.ensure_data_dir()
        self.plan_parser = PlanParserAgent()
        
    async def _load_all_plans(self) -> Dict[str, Plan]:
        """加载所有计划数据"""
        # 加载JSON
        data = await load_json(settings.plans_file_path)
        
        # 解析日期时间字符串
        data = datetime_parser(data)
        
        # 转换为Plan对象字典
        plans = {}
        for plan_id, plan_data in data.items():
            try:
                # 创建Plan对象
                plan = Plan(**plan_data)
                plans[plan_id] = plan
            except Exception as e:
                logger.error(f"加载计划 {plan_id} 失败: {e}")
        
        return plans
    
    async def _save_all_plans(self, plans: Dict[str, Plan]) -> None:
        """保存所有计划数据"""
        # 转换为字典
        data = {}
        for plan_id, plan in plans.items():
            data[plan_id] = plan.model_dump()
        
        # 保存到文件
        await save_json(settings.plans_file_path, data)
        
    async def get_all_plans(self) -> List[Plan]:
        """获取所有计划"""
        plans = await self._load_all_plans()
        return list(plans.values())
    
    async def get_plan_by_id(self, plan_id: str) -> Optional[Plan]:
        """根据ID获取特定计划"""
        plans = await self._load_all_plans()
        return plans.get(plan_id)
    
    async def create_plan(self, plan_data: PlanCreate) -> Plan:
        """创建新计划"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 创建新计划
        plan = Plan(**plan_data.model_dump())
        
        # 添加到计划字典
        plans[plan.id] = plan
        
        # 保存
        await self._save_all_plans(plans)
        
        return plan
    
    async def update_plan(self, plan_id: str, plan_data: PlanUpdate) -> Optional[Plan]:
        """更新计划信息"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return None
        
        # 获取现有计划
        plan = plans[plan_id]
        
        # 更新数据（只更新非空字段）
        update_data = plan_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)
            
        # 更新时间
        plan.updated_at = datetime.now()
        
        # 保存
        await self._save_all_plans(plans)
        
        return plan
    
    async def delete_plan(self, plan_id: str) -> bool:
        """删除计划"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return False
        
        # 删除计划
        del plans[plan_id]
        
        # 保存
        await self._save_all_plans(plans)
        
        # 检查当前计划
        current_plan = await self.get_current_plan()
        if current_plan and current_plan.id == plan_id:
            await self.set_current_plan(None)
        
        return True
    
    async def create_plan_from_text(self, text: str, name: Optional[str] = None) -> Plan:
        """从文本创建计划"""
        # 使用解析代理解析文本
        plan = await self.plan_parser.parse_text_to_plan(text, name)
        
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 添加到计划字典
        plans[plan.id] = plan
        
        # 保存
        await self._save_all_plans(plans)
        
        # 设置为当前计划
        await self.set_current_plan(plan.id)
        
        return plan
    
    async def get_current_plan(self) -> Optional[Plan]:
        """获取当前计划"""
        try:
            # 加载当前计划ID
            data = await load_json(settings.current_plan_file_path)
            current_plan_data = CurrentPlan(**data)
            
            # 如果没有当前计划，返回None
            if not current_plan_data.plan_id:
                return None
            
            # 加载所有计划
            plans = await self._load_all_plans()
            
            # 获取当前计划
            return plans.get(current_plan_data.plan_id)
        except Exception as e:
            logger.error(f"获取当前计划失败: {e}")
            return None
    
    async def set_current_plan(self, plan_id: Optional[str]) -> bool:
        """设置当前计划"""
        try:
            # 如果plan_id不为空，检查计划是否存在
            if plan_id:
                plans = await self._load_all_plans()
                if plan_id not in plans:
                    return False
            
            # 创建CurrentPlan对象
            current_plan = CurrentPlan(plan_id=plan_id)
            
            # 保存
            await save_json(settings.current_plan_file_path, current_plan.model_dump())
            
            return True
        except Exception as e:
            logger.error(f"设置当前计划失败: {e}")
            return False
    
    async def get_next_tasks(self) -> List[Dict[str, Any]]:
        """获取下一步应该做的任务"""
        try:
            current_plan = await self.get_current_plan()
            if not current_plan:
                return []
            
            # 筛选状态为PENDING和NEED_FIXED的任务，这些是下一步可以做的
            next_tasks = []
            for task in current_plan.tasks:
                if task.status in [TaskStatus.PENDING, TaskStatus.NEED_FIXED]:
                    # 检查依赖任务是否都已完成
                    dependencies_met = True
                    for dep_id in task.dependencies:
                        # 查找依赖任务
                        dep_task = next((t for t in current_plan.tasks if t.id == dep_id), None)
                        # 如果没找到依赖任务ID，尝试查找标题匹配的任务
                        if not dep_task:
                            dep_task = next((t for t in current_plan.tasks if t.title == dep_id), None)
                        
                        # 如果依赖任务存在且未完成，则不满足依赖条件
                        if dep_task and dep_task.status != TaskStatus.COMPLETE:
                            dependencies_met = False
                            break
                    
                    if dependencies_met:
                        next_tasks.append({
                            "id": task.id,
                            "title": task.title,
                            "description": task.description or "",
                            "status": task.status.value,
                            "order": task.order or 999,
                            "dependencies": task.dependencies
                        })
            
            # 按顺序编号排序
            next_tasks.sort(key=lambda x: x.get("order", 999))
            
            return next_tasks
        except Exception as e:
            logger.error(f"获取下一步任务失败: {e}", exc_info=True)
            return []
    
    # 任务管理
    async def get_tasks(self, plan_id: str) -> List[Task]:
        """获取计划下的所有任务"""
        plan = await self.get_plan_by_id(plan_id)
        if not plan:
            return []
        return plan.tasks
    
    async def get_task_by_id(self, plan_id: str, task_id: str) -> Optional[Task]:
        """获取特定任务"""
        plan = await self.get_plan_by_id(plan_id)
        if not plan:
            return None
        
        # 查找任务
        for task in plan.tasks:
            if task.id == task_id:
                return task
        
        return None
    
    async def create_task(self, plan_id: str, task_data: TaskCreate) -> Optional[Task]:
        """创建新任务"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return None
        
        # 获取计划
        plan = plans[plan_id]
        
        # 创建新任务
        task = Task(**task_data.model_dump())
        
        # 添加到计划
        plan.tasks.append(task)
        plan.updated_at = datetime.now()
        
        # 保存
        await self._save_all_plans(plans)
        
        return task
    
    async def update_task(self, plan_id: str, task_id: str, task_data: TaskUpdate) -> Optional[Task]:
        """更新任务"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return None
        
        # 获取计划
        plan = plans[plan_id]
        
        # 查找任务
        task_index = None
        for i, task in enumerate(plan.tasks):
            if task.id == task_id:
                task_index = i
                break
        
        if task_index is None:
            return None
        
        # 获取现有任务
        task = plan.tasks[task_index]
        
        # 更新数据（只更新非空字段）
        update_data = task_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(task, key, value)
            
        # 更新时间
        task.updated_at = datetime.now()
        plan.updated_at = datetime.now()
        
        # 保存
        await self._save_all_plans(plans)
        
        return task
    
    async def update_task_status(self, plan_id: str, task_id: str, status_data: TaskStatusUpdate) -> Optional[Task]:
        """更新任务状态"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return None
        
        # 获取计划
        plan = plans[plan_id]
        
        # 查找任务
        task_index = None
        for i, task in enumerate(plan.tasks):
            if task.id == task_id:
                task_index = i
                break
        
        if task_index is None:
            return None
        
        # 获取现有任务
        task = plan.tasks[task_index]
        
        # 更新状态
        task.status = status_data.status
        task.updated_at = datetime.now()
        plan.updated_at = datetime.now()
        
        # 保存
        await self._save_all_plans(plans)
        
        return task
    
    async def delete_task(self, plan_id: str, task_id: str) -> bool:
        """删除任务"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return False
        
        # 获取计划
        plan = plans[plan_id]
        
        # 查找任务
        task_index = None
        for i, task in enumerate(plan.tasks):
            if task.id == task_id:
                task_index = i
                break
        
        if task_index is None:
            return False
        
        # 删除任务
        del plan.tasks[task_index]
        plan.updated_at = datetime.now()
        
        # 保存
        await self._save_all_plans(plans)
        
        return True
    
    # 评论管理
    async def add_comment(self, plan_id: str, task_id: str, comment_data: CommentCreate) -> Optional[Comment]:
        """添加评论"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return None
        
        # 获取计划
        plan = plans[plan_id]
        
        # 查找任务
        task_index = None
        for i, task in enumerate(plan.tasks):
            if task.id == task_id:
                task_index = i
                break
        
        if task_index is None:
            return None
        
        # 获取任务
        task = plan.tasks[task_index]
        
        # 创建新评论
        comment = Comment(**comment_data.model_dump())
        
        # 添加到任务
        task.comments.append(comment)
        task.updated_at = datetime.now()
        plan.updated_at = datetime.now()
        
        # 保存
        await self._save_all_plans(plans)
        
        return comment
    
    async def get_comments(self, plan_id: str, task_id: str) -> List[Comment]:
        """获取任务下的所有评论"""
        task = await self.get_task_by_id(plan_id, task_id)
        if not task:
            return []
        return task.comments
    
    async def delete_comment(self, plan_id: str, task_id: str, comment_id: str) -> bool:
        """删除评论"""
        # 加载现有计划
        plans = await self._load_all_plans()
        
        # 检查计划是否存在
        if plan_id not in plans:
            return False
        
        # 获取计划
        plan = plans[plan_id]
        
        # 查找任务
        task_index = None
        for i, task in enumerate(plan.tasks):
            if task.id == task_id:
                task_index = i
                break
        
        if task_index is None:
            return False
        
        # 获取任务
        task = plan.tasks[task_index]
        
        # 查找评论
        comment_index = None
        for i, comment in enumerate(task.comments):
            if comment.id == comment_id:
                comment_index = i
                break
                
        if comment_index is None:
            return False
            
        # 删除评论
        del task.comments[comment_index]
        task.updated_at = datetime.now()
        plan.updated_at = datetime.now()
        
        # 保存
        await self._save_all_plans(plans)
        
        return True 