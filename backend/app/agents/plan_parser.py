from typing import List, Dict, Any, Optional
import re
import logging
import json
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_random_exponential

from ..models.schemas import Plan, Task, Comment, TaskStatus, CommentType
from ..config import settings

# 尝试导入OpenAI支持，如果不可用则使用模拟解析器
try:
    from openai import OpenAI
    from openai import BadRequestError, RateLimitError, APIError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PlanParserAgent:
    """计划解析代理，将文本计划转换为结构化JSON"""
    
    def __init__(self):
        """初始化解析代理"""
        self.openai_client = None
        if OPENAI_AVAILABLE and settings.MODEL_API_KEY:
            try:
                self.openai_client = OpenAI(
                    api_key=settings.MODEL_API_KEY,
                    base_url=settings.MODEL_BASE_URL
                )
                logger.info("OpenAI 客户端初始化成功")
            except Exception as e:
                logger.error(f"OpenAI 客户端初始化失败: {e}")
        
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_random_exponential(min=1, max=10),
        reraise=True
    )
    async def _call_openai(self, text: str, name: Optional[str] = None) -> Dict[str, Any]:
        """调用OpenAI API解析计划文本"""
        if not self.openai_client:
            raise ValueError("OpenAI客户端未配置")
        
        # 构建提示
        prompt = self._build_prompt(text, name)
        
        # 最大重试次数
        max_json_retries = 3
        current_retry = 0
        
        while current_retry < max_json_retries:
            try:
                # 调用API
                logger.info(f"使用模型 {settings.MODEL_NAME} 解析计划文本 (JSON解析尝试 {current_retry + 1}/{max_json_retries})")
                response = self.openai_client.chat.completions.create(
                    model=settings.MODEL_NAME,
                    messages=[
                        {"role": "system", "content": "你是一个专业的项目计划解析助手，能够将自然语言描述的项目计划转换为结构化的JSON格式。你擅长识别任务、注意事项和任务之间的依赖关系。"},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    response_format={"type": "json_object"}
                )
                
                logger.info("OpenAI 响应已收到")
                
                # 提取JSON
                content = response.choices[0].message.content
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # 尝试从文本中提取JSON部分
                    match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
                    if match:
                        try:
                            return json.loads(match.group(1))
                        except json.JSONDecodeError:
                            pass
                    
                    # 如果还是失败，尝试提取花括号内容
                    match = re.search(r'\{.*\}', content, re.DOTALL)
                    if match:
                        try:
                            return json.loads(match.group(0))
                        except json.JSONDecodeError:
                            pass
                    
                    # 如果所有解析尝试都失败，增加重试计数
                    current_retry += 1
                    if current_retry >= max_json_retries:
                        raise ValueError(f"多次尝试后仍无法解析OpenAI返回的内容为JSON: {content}")
                    
                    logger.warning(f"JSON解析失败，尝试第 {current_retry + 1} 次调用API，强调返回有效JSON")
                    # 对提示进行增强，强调需要有效的JSON
                    prompt += "\n\nIMPORTANT: Your previous response could not be parsed as valid JSON. Please ensure you return ONLY a valid JSON object with no additional text or formatting."
            
            except (BadRequestError, RateLimitError, APIError) as e:
                logger.error(f"OpenAI API错误: {e}")
                raise
        
    def _build_prompt(self, text: str, name: Optional[str] = None) -> str:
        """构建提示，指导AI如何解析计划"""
        plan_name_hint = f"with the name: {name}" if name else "inferring an appropriate name from the content"
        
        return f"""
You are a professional Project Planning Assistant. Your task is to convert a natural language project plan description into a structured JSON format.

# INPUT
The following is a project plan text {plan_name_hint}:

```
{text}
```

# OUTPUT REQUIREMENTS
Parse this text into a structured JSON format that follows these specifications exactly:

```json
{{
  "name": "Plan name - use the provided name or infer from content",
  "description": "Overall plan description or objective",
  "notes": ["Important note 1", "Important note 2", ...],
  "tasks": [
    {{
      "title": "Task title - clear and concise",
      "description": "Detailed task description",
      "status": "Task status (Pending, Working, Pending For Review, Complete, Need Fixed)",
      "order": 1,
      "dependencies": ["Titles of tasks this depends on"],
      "comments": [
        "important details about the task, such as links user provided, path user provided, etc."
      ]
    }},
    ...more tasks...
  ]
}}
```

# PARSING RULES
1. COMPLETENESS: Extract ALL tasks mentioned in the text. Do not miss any task, no matter how minor it seems.
2. ACCURACY: Do not add any information that isn't explicitly stated or strongly implied in the original text.
3. TASK IDENTIFICATION: Tasks are typically indicated by numbers, bullet points, action verbs, or clearly defined activities.
4. STATUS: Default task status is "Pending" unless text explicitly states it's in progress ("Working"), needs review ("Pending For Review"), completed ("Complete"), or requires fixes ("Need Fixed").
5. DEPENDENCIES: Carefully identify dependencies between tasks. If task B depends on task A, list task A's title in task B's dependencies array.
6. ORDER: Assign sequential order numbers based on the logical sequence of tasks, considering dependencies.
7. NOTES: Distinguish between tasks and general notes/reminders. Notes are typically advisory information not tied to specific actions.
8. STRUCTURE: Ensure all JSON keys and values are properly formatted with correct data types.

# LANGUAGE INSTRUCTION
IMPORTANT: Return the JSON structure containing plan data, but use the SAME LANGUAGE as the user input text for all content (names, descriptions, notes, etc.).

# FINAL CHECK
Before submitting:
1. Verify all tasks from the original text are included
2. Confirm no fictional tasks or details were added
3. Check that dependencies are correctly identified
4. Ensure the response is valid JSON

Return ONLY the JSON object without any additional text, explanations, or markdown formatting.
"""
        
    async def parse_text_to_plan(self, text: str, name: Optional[str] = None) -> Plan:
        """
        解析文本，转换为Plan对象
        
        Args:
            text: 计划文本
            name: 可选的计划名称
            
        Returns:
            Plan: 结构化的计划对象
        """
        try:
            plan_data = None
            
            # 尝试使用OpenAI解析
            if self.openai_client:
                try:
                    logger.info("尝试使用OpenAI解析计划文本")
                    plan_data = await self._call_openai(text, name)
                    logger.info(f"OpenAI解析成功: {list(plan_data.keys())}")
                except Exception as e:
                    logger.warning(f"OpenAI解析失败，使用后备方法: {e}", exc_info=True)
                    raise e
            else:
                # 使用后备解析方法
                logger.info("OpenAI客户端未配置，使用后备解析方法")
                raise e
            
            # 创建Plan对象
            plan = Plan(
                name=plan_data.get("name", name or "未命名计划"),
                description=plan_data.get("description", ""),
                notes=plan_data.get("notes", []),
                tasks=[]
            )
            
            # 处理任务
            if "tasks" in plan_data and isinstance(plan_data["tasks"], list):
                for task_data in plan_data["tasks"]:
                    # 默认所有任务为Pending状态
                    status = TaskStatus.PENDING
                    if "status" in task_data:
                        status_str = task_data["status"]
                        try:
                            status = TaskStatus(status_str)
                        except ValueError:
                            # 尝试匹配最相似的状态
                            status_map = {
                                "pending": TaskStatus.PENDING,
                                "working": TaskStatus.WORKING,
                                "review": TaskStatus.PENDING_REVIEW,
                                "complete": TaskStatus.COMPLETE,
                                "fixed": TaskStatus.NEED_FIXED
                            }
                            for key, value in status_map.items():
                                if key in status_str.lower():
                                    status = value
                                    break
                    
                    comments = []
                    temps= task_data.get("comments", [])
                    for temp in temps:
                        comments.append(Comment(
                            content=temp,
                            type=CommentType.SUGGESTION
                        ))
                    task = Task(
                        title=task_data.get("title", "未命名任务"),
                        description=task_data.get("description", ""),
                        status=status,
                        order=task_data.get("order"),
                        dependencies=task_data.get("dependencies", []),
                        comments = comments
                    )
                    plan.tasks.append(task)
            
            return plan
        
        except Exception as e:
            logger.error(f"解析计划文本失败: {e}", exc_info=True)
            # 创建一个基本的Plan对象，表示解析失败
            return Plan(
                name=name or "解析失败的计划",
                description=f"无法解析文本为结构化计划: {str(e)}",
                notes=["解析失败，请手动创建计划或尝试提供更清晰的文本描述"],
                tasks=[]
            )