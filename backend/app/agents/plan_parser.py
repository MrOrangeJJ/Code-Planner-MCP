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
        
        try:
            # 调用API
            logger.info(f"使用模型 {settings.MODEL_NAME} 解析计划文本")
            response = self.openai_client.chat.completions.create(
                model=settings.MODEL_NAME,
                messages=[
                    {"role": "system", "content": "你是一个专业的项目计划解析助手，能够将自然语言描述的项目计划转换为结构化的JSON格式。你擅长识别任务、注意事项和任务之间的依赖关系。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=2000,
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
                    return json.loads(match.group(1))
                
                # 如果还是失败，尝试提取花括号内容
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    return json.loads(match.group(0))
                
                raise ValueError(f"无法解析OpenAI返回的内容为JSON: {content}")
            
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
      "dependencies": ["Titles of tasks this depends on"]
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
    
    async def _fallback_parse(self, text: str, name: Optional[str] = None) -> Dict[str, Any]:
        """使用简单规则进行解析的后备方法"""
        logger.info("使用后备解析器解析计划文本")
        
        plan_name = name or "未命名计划"
        description = ""
        notes = []
        tasks = []
        
        # 提取计划描述（假设是文本开始的几行）
        lines = text.strip().split('\n')
        if lines:
            description_lines = []
            i = 0
            while i < min(3, len(lines)):
                line = lines[i].strip()
                # 如果第一行是标题格式（以#开头或全部大写），则作为计划名称
                if i == 0 and (line.startswith('#') or line.isupper()):
                    if not name:  # 只有在没有提供名称时才使用
                        plan_name = line.lstrip('#').strip()
                else:
                    # 如果行不是列表项，则添加到描述中
                    if not re.match(r'^\d+\.|\*|\-', line) and line:
                        description_lines.append(line)
                i += 1
            description = ' '.join(description_lines).strip()
        
        # 寻找注意事项部分
        notes_section = False
        notes_pattern = r'(?:注意事项|注意|Notes?)[：:]\s*(.*?)(?:\n\n|\n#|\Z)'
        notes_matches = re.findall(notes_pattern, text, re.DOTALL | re.IGNORECASE)
        
        # 如果找到注意事项部分，提取项目
        if notes_matches:
            for match in notes_matches:
                # 提取项目符号列表项
                note_items = re.findall(r'[-*•]\s*(.*?)(?:\n|$)', match, re.MULTILINE)
                # 如果找到项目，添加每个项目
                if note_items:
                    notes.extend([item.strip() for item in note_items if item.strip()])
                # 否则添加整个匹配内容
                elif match.strip():
                    notes.append(match.strip())
        
        # 查找文本中的任务列表
        # 先尝试查找数字列表（1. 任务一，2. 任务二）
        task_matches = re.findall(r'(?:^|\n)(\d+)\.\s*(.*?)(?=(?:\n\d+\.)|$)', text, re.DOTALL)
        
        # 如果找到了数字列表任务
        if task_matches:
            for order_str, task_text in task_matches:
                if task_text.strip() and "注意" not in task_text.lower() and "notes" not in task_text.lower():
                    # 尝试提取描述（假设任务后面的非列表文本是描述）
                    task_parts = task_text.strip().split('\n', 1)
                    title = task_parts[0].strip()
                    description = task_parts[1].strip() if len(task_parts) > 1 else ""
                    
                    # 创建任务
                    task = {
                        "title": title,
                        "description": description,
                        "status": "Pending",
                        "order": int(order_str),
                        "dependencies": []
                    }
                    
                    # 检查是否包含任务状态
                    if "已完成" in task_text or "完成" in task_text or "done" in task_text.lower():
                        task["status"] = "Complete"
                    elif "进行中" in task_text or "working" in task_text.lower():
                        task["status"] = "Working"
                    elif "审核" in task_text or "review" in task_text.lower():
                        task["status"] = "Pending For Review"
                    elif "修复" in task_text or "fix" in task_text.lower():
                        task["status"] = "Need Fixed"
                        
                    # 检查依赖关系
                    if "依赖" in task_text or "depend" in task_text.lower():
                        # 简单提取依赖信息
                        deps = re.findall(r'依赖[：:]\s*(.*?)(?:\n|$)', task_text)
                        if deps:
                            deps_list = []
                            for dep in deps[0].split(','):
                                dep = dep.strip()
                                # 如果依赖是数字，则引用对应序号的任务标题
                                if dep.isdigit() and 0 < int(dep) <= len(task_matches):
                                    dep_idx = int(dep) - 1
                                    if dep_idx < len(tasks):
                                        deps_list.append(tasks[dep_idx]["title"])
                                else:
                                    deps_list.append(dep)
                            task["dependencies"] = deps_list
                    
                    tasks.append(task)
        else:
            # 如果没有找到数字列表，尝试查找项目符号列表
            task_pattern = r'[-*•]\s*(.*?)(?=(?:\n[-*•])|$)'
            bullet_matches = re.findall(task_pattern, text)
            
            # 过滤掉已识别为注意事项的项目
            bullet_tasks = [m for m in bullet_matches if m.strip() and 
                           m.strip() not in notes and 
                           "注意" not in m.lower() and 
                           "notes" not in m.lower()]
            
            for i, task_text in enumerate(bullet_tasks):
                # 创建任务
                task = {
                    "title": task_text.strip(),
                    "description": "",
                    "status": "Pending",
                    "order": i + 1,
                    "dependencies": []
                }
                
                # 检查是否包含任务状态
                if "已完成" in task_text or "完成" in task_text or "done" in task_text.lower():
                    task["status"] = "Complete"
                elif "进行中" in task_text or "working" in task_text.lower():
                    task["status"] = "Working"
                elif "审核" in task_text or "review" in task_text.lower():
                    task["status"] = "Pending For Review"
                elif "修复" in task_text or "fix" in task_text.lower():
                    task["status"] = "Need Fixed"
                    
                tasks.append(task)
        
        # 如果没有找到任何任务，尝试查找隐含的任务
        if not tasks:
            task_indicators = ["需要", "应该", "必须", "实现", "开发", "创建", "设计", "测试"]
            for line in lines:
                for indicator in task_indicators:
                    if indicator in line and line.strip() not in notes:
                        tasks.append({
                            "title": line.strip(),
                            "description": "",
                            "status": "Pending",
                            "order": len(tasks) + 1,
                            "dependencies": []
                        })
                        break
        
        return {
            "name": plan_name,
            "description": description,
            "notes": notes,
            "tasks": tasks
        }
    
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
                    plan_data = await self._fallback_parse(text, name)
            else:
                # 使用后备解析方法
                logger.info("OpenAI客户端未配置，使用后备解析方法")
                plan_data = await self._fallback_parse(text, name)
            
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
                    
                    task = Task(
                        title=task_data.get("title", "未命名任务"),
                        description=task_data.get("description", ""),
                        status=status,
                        order=task_data.get("order"),
                        dependencies=task_data.get("dependencies", [])
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