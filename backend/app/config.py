import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 基本配置
class Settings(BaseModel):
    PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    
    # 数据存储配置
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")
    PLANS_FILE: str = "plans.json"
    CURRENT_PLAN_FILE: str = "current_plan.json"
    
    # OpenAI配置（用于文本解析Agent）
    MODEL_API_KEY: Optional[str] = os.getenv("MODEL_API_KEY")
    MODEL_NAME: str = os.getenv("MODEL_NAME", "gpt-3.5-turbo")
    MODEL_BASE_URL: Optional[str] = os.getenv("MODEL_BASE_URL")
    
    @property
    def data_dir_path(self) -> Path:
        """获取数据目录的Path对象"""
        return Path(self.DATA_DIR)
    
    @property
    def plans_file_path(self) -> Path:
        """获取计划文件的Path对象"""
        return self.data_dir_path / self.PLANS_FILE
    
    @property
    def current_plan_file_path(self) -> Path:
        """获取当前计划文件的Path对象"""
        return self.data_dir_path / self.CURRENT_PLAN_FILE
    
    def ensure_data_dir(self) -> None:
        """确保数据目录存在"""
        self.data_dir_path.mkdir(parents=True, exist_ok=True)

# 创建全局设置实例
settings = Settings() 