from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

from .api import router as api_router
from .config import settings

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="Cursor Planner API",
    description="项目计划管理API，帮助AI跟踪和管理软件开发计划",
    version="1.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有源，生产环境应该限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加API路由
app.include_router(api_router)

# 根路由
@app.get("/")
async def root():
    """API根路由，返回简单的欢迎信息"""
    return {"message": "欢迎使用Cursor Planner API", "docs": "/docs"}

# 启动应用
if __name__ == "__main__":
    # 确保数据目录存在
    settings.ensure_data_dir()
    
    # 启动服务
    uvicorn.run(
        "app.main:app", 
        host='0.0.0.0', 
        port=settings.PORT,
        reload=True
    ) 