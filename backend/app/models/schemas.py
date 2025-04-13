from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, UUID4
from uuid import uuid4

# 枚举定义
class TaskStatus(str, Enum):
    PENDING = "Pending"
    WORKING = "Working"
    PENDING_REVIEW = "Pending For Review"
    COMPLETE = "Complete"
    NEED_FIXED = "Need Fixed"

class CommentType(str, Enum):
    NOTE = "Note"
    QUESTION = "Question"
    SUGGESTION = "Suggestion"
    ISSUE = "Issue"
    OTHER = "Other"

# 基础模型
class BaseSchema(BaseModel):
    """基础模型，包含通用字段"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None

# 评论模型
class CommentCreate(BaseModel):
    """创建评论的输入模型"""
    content: str
    type: CommentType = CommentType.NOTE

class Comment(BaseSchema):
    """评论模型"""
    content: str
    type: CommentType = CommentType.NOTE

# 任务模型
class TaskCreate(BaseModel):
    """创建任务的输入模型"""
    title: str
    description: Optional[str] = None
    order: Optional[int] = None
    dependencies: List[str] = Field(default_factory=list)

class TaskUpdate(BaseModel):
    """更新任务的输入模型"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    order: Optional[int] = None
    dependencies: Optional[List[str]] = None

class TaskStatusUpdate(BaseModel):
    """更新任务状态的输入模型"""
    status: TaskStatus

class Task(BaseSchema):
    """任务模型"""
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    comments: List[Comment] = Field(default_factory=list)
    order: Optional[int] = None
    dependencies: List[str] = Field(default_factory=list)

# 计划模型
class PlanCreate(BaseModel):
    """创建计划的输入模型"""
    name: str
    description: Optional[str] = None
    notes: List[str] = Field(default_factory=list)

class PlanUpdate(BaseModel):
    """更新计划的输入模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[List[str]] = None

class Plan(BaseSchema):
    """计划模型"""
    name: str
    description: Optional[str] = None
    notes: List[str] = Field(default_factory=list)
    tasks: List[Task] = Field(default_factory=list)

# 文本转计划模型
class TextToPlan(BaseModel):
    """文本转计划的输入模型"""
    text: str
    name: Optional[str] = None

# 当前计划模型
class CurrentPlan(BaseModel):
    """当前计划的存储模型"""
    plan_id: Optional[str] = None

# API响应模型
class APIResponse(BaseModel):
    """API响应模型"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None 