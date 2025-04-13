import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, TypeVar, Type, Union

import aiofiles
from pydantic import BaseModel

# 类型变量，用于泛型函数
T = TypeVar('T', bound=BaseModel)

class DateTimeEncoder(json.JSONEncoder):
    """自定义的JSON编码器，处理日期时间"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

async def load_json(file_path: Union[str, Path]) -> Dict[str, Any]:
    """从文件异步加载JSON数据"""
    file_path = Path(file_path)
    if not file_path.exists():
        return {}
    
    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
        content = await f.read()
        return json.loads(content) if content else {}

async def save_json(file_path: Union[str, Path], data: Dict[str, Any]) -> None:
    """异步保存JSON数据到文件"""
    file_path = Path(file_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
        json_str = json.dumps(data, cls=DateTimeEncoder, ensure_ascii=False, indent=2)
        await f.write(json_str)

def pydantic_to_dict(obj: BaseModel) -> Dict[str, Any]:
    """将Pydantic模型转换为字典"""
    return obj.model_dump()

def dict_to_pydantic(data: Dict[str, Any], model_class: Type[T]) -> T:
    """将字典转换为Pydantic模型"""
    return model_class.model_validate(data)

def datetime_parser(json_dict: Dict[str, Any]) -> Dict[str, Any]:
    """解析字典中的日期时间字符串"""
    for key, value in json_dict.items():
        if isinstance(value, str) and len(value) > 10:
            try:
                json_dict[key] = datetime.fromisoformat(value)
            except ValueError:
                pass
        elif isinstance(value, dict):
            json_dict[key] = datetime_parser(value)
        elif isinstance(value, list):
            json_dict[key] = [
                datetime_parser(item) if isinstance(item, dict) else item 
                for item in value
            ]
    return json_dict 