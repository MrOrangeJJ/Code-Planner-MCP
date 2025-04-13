from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Path, Body, Query

from ..models.schemas import (
    Plan, PlanCreate, PlanUpdate, 
    Task, TaskCreate, TaskUpdate, TaskStatusUpdate,
    Comment, CommentCreate,
    TextToPlan, APIResponse
)
from ..services.plan_service import PlanService

# 创建路由器
router = APIRouter(prefix="/plans", tags=["plans"])

# 依赖项：获取PlanService实例
def get_plan_service():
    return PlanService()

# 计划管理API
@router.get("/", response_model=List[Plan])
async def get_all_plans(plan_service: PlanService = Depends(get_plan_service)):
    """获取所有计划"""
    return await plan_service.get_all_plans()

@router.post("/", response_model=Plan)
async def create_plan(
    plan_data: PlanCreate = Body(...),
    plan_service: PlanService = Depends(get_plan_service)
):
    """创建新计划"""
    return await plan_service.create_plan(plan_data)

@router.get("/current", response_model=Optional[Plan])
async def get_current_plan(plan_service: PlanService = Depends(get_plan_service)):
    """获取当前正在跟踪的计划"""
    plan = await plan_service.get_current_plan()
    if not plan:
        return None
    return plan

@router.post("/from-text", response_model=Plan)
async def create_plan_from_text(
    text_data: TextToPlan = Body(...),
    plan_service: PlanService = Depends(get_plan_service)
):
    """从文本创建计划"""
    return await plan_service.create_plan_from_text(text_data.text, text_data.name)

@router.get("/next-tasks", response_model=List[dict])
async def get_next_tasks(plan_service: PlanService = Depends(get_plan_service)):
    """获取下一步应该做的任务"""
    return await plan_service.get_next_tasks()

@router.get("/{plan_id}", response_model=Plan)
async def get_plan_by_id(
    plan_id: str = Path(..., title="计划ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """获取特定计划详情"""
    plan = await plan_service.get_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    return plan

@router.put("/{plan_id}", response_model=Plan)
async def update_plan(
    plan_id: str = Path(..., title="计划ID"),
    plan_data: PlanUpdate = Body(...),
    plan_service: PlanService = Depends(get_plan_service)
):
    """更新特定计划"""
    plan = await plan_service.update_plan(plan_id, plan_data)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    return plan

@router.delete("/{plan_id}", response_model=APIResponse)
async def delete_plan(
    plan_id: str = Path(..., title="计划ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """删除特定计划"""
    success = await plan_service.delete_plan(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="计划不存在")
    return APIResponse(message="计划已删除")

@router.put("/{plan_id}/set-current", response_model=APIResponse)
async def set_current_plan(
    plan_id: str = Path(..., title="计划ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """将特定计划设置为当前跟踪的计划"""
    success = await plan_service.set_current_plan(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="计划不存在")
    return APIResponse(message="当前计划已更新")

# 任务管理API
@router.get("/{plan_id}/tasks", response_model=List[Task])
async def get_tasks(
    plan_id: str = Path(..., title="计划ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """获取计划下所有任务"""
    plan = await plan_service.get_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    return plan.tasks

@router.post("/{plan_id}/tasks", response_model=Task)
async def create_task(
    plan_id: str = Path(..., title="计划ID"),
    task_data: TaskCreate = Body(...),
    plan_service: PlanService = Depends(get_plan_service)
):
    """添加新任务"""
    task = await plan_service.create_task(plan_id, task_data)
    if not task:
        raise HTTPException(status_code=404, detail="计划不存在")
    return task

@router.get("/{plan_id}/tasks/{task_id}", response_model=Task)
async def get_task_by_id(
    plan_id: str = Path(..., title="计划ID"),
    task_id: str = Path(..., title="任务ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """获取特定任务详情"""
    task = await plan_service.get_task_by_id(plan_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task

@router.put("/{plan_id}/tasks/{task_id}", response_model=Task)
async def update_task(
    plan_id: str = Path(..., title="计划ID"),
    task_id: str = Path(..., title="任务ID"),
    task_data: TaskUpdate = Body(...),
    plan_service: PlanService = Depends(get_plan_service)
):
    """更新特定任务"""
    task = await plan_service.update_task(plan_id, task_id, task_data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task

@router.put("/{plan_id}/tasks/{task_id}/status", response_model=Task)
async def update_task_status(
    plan_id: str = Path(..., title="计划ID"),
    task_id: str = Path(..., title="任务ID"),
    status_data: TaskStatusUpdate = Body(...),
    plan_service: PlanService = Depends(get_plan_service)
):
    """更新任务状态"""
    task = await plan_service.update_task_status(plan_id, task_id, status_data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task

@router.delete("/{plan_id}/tasks/{task_id}", response_model=APIResponse)
async def delete_task(
    plan_id: str = Path(..., title="计划ID"),
    task_id: str = Path(..., title="任务ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """删除特定任务"""
    success = await plan_service.delete_task(plan_id, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="任务不存在")
    return APIResponse(message="任务已删除")

# 评论管理API
@router.post("/{plan_id}/tasks/{task_id}/comments", response_model=Comment)
async def add_comment(
    plan_id: str = Path(..., title="计划ID"),
    task_id: str = Path(..., title="任务ID"),
    comment_data: CommentCreate = Body(...),
    plan_service: PlanService = Depends(get_plan_service)
):
    """添加评论"""
    comment = await plan_service.add_comment(plan_id, task_id, comment_data)
    if not comment:
        raise HTTPException(status_code=404, detail="任务不存在")
    return comment

@router.get("/{plan_id}/tasks/{task_id}/comments", response_model=List[Comment])
async def get_comments(
    plan_id: str = Path(..., title="计划ID"),
    task_id: str = Path(..., title="任务ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """获取任务下所有评论"""
    task = await plan_service.get_task_by_id(plan_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task.comments

@router.delete("/{plan_id}/tasks/{task_id}/comments/{comment_id}", response_model=APIResponse)
async def delete_comment(
    plan_id: str = Path(..., title="计划ID"),
    task_id: str = Path(..., title="任务ID"),
    comment_id: str = Path(..., title="评论ID"),
    plan_service: PlanService = Depends(get_plan_service)
):
    """删除评论"""
    success = await plan_service.delete_comment(plan_id, task_id, comment_id)
    if not success:
        raise HTTPException(status_code=404, detail="评论不存在")
    return APIResponse(message="评论已删除") 