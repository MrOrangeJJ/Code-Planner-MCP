from fastapi import APIRouter
from .plans import router as plans_router

# 创建主路由
router = APIRouter()

# 包含子路由
router.include_router(plans_router) 