

# Planning Management System

A simple planning and task management system that helps organize and track project progress.

## Features

- Create and manage plans
- Add and manage tasks within plans
- Set task dependencies and order
- Update task status and progress
- Add comments and notes to tasks
- Automatically generate plans and tasks from text
- View next tasks to be executed

## Tech Stack

- Backend: FastAPI (Python)
- Frontend: Vanilla JavaScript, HTML, and CSS
- Data Storage: JSON files
- MCP Tools: TypeScript + Model Context Protocol (MCP)

## Installation and Setup

### Prerequisites

- Node.js 14+
- Python 3.8+
- An OpenAI API key (for AI agents)

### Environment Setup

1. Copy the example environment file:

```bash
cp example.env .env
```

2. Edit the .env file to set your environment variables:
   - Update `MODEL_API_KEY` with your OpenAI API key
   - Adjust ports and other settings as needed

### Backend

1. Install Python dependencies:

```bash
cd backend
pip install -r requirements.txt
```

2. Start the backend server:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The backend API will run at http://localhost:8000/.

### Frontend

1. Start the frontend proxy server:

```bash
python server.py
```

The frontend application will run at http://localhost:3000/.

### MCP Tools

1. Install dependencies:

```bash
cd mcp
npm install
```

2. Build the tools:

```bash
cd mcp
npm run build
```

3. Run the MCP service:

```bash
cd mcp
API_BASE_URL=http://localhost:8000 node dist/planner_tools.js
```

MCP tools will run in the background, interacting with AI assistants via the Cursor IDE.

## Planner Tools MCP Features

Planner Tools MCP integrates the following features, specifically designed for AI assistants in the Cursor IDE:

### Core Tools

1. **Create Plan (create_plan)**
   - Create structured plans from text
   - Automatically parse task descriptions and dependencies
   - Automatically set as the currently tracked plan

2. **Get Current Plan Tasks (get_current_plan_tasks)**
   - View all tasks in the current plan
   - Includes detailed information such as status, description, dependencies, and comments

3. **Get Next Tasks (get_next_tasks)**
   - Intelligently analyze and recommend which tasks should be executed next
   - Sort based on task status and dependencies

4. **Add Comment (add_comment)**
   - Add various types of comments (notes, questions, suggestions, issues) to specific tasks
   - Help record thoughts and decision processes related to tasks

5. **Update Task Status (update_task_status)**
   - Update the progress status of tasks
   - Support multiple statuses: Pending, Working, Pending For Review, Complete, Need Fixed

6. **Remove Comment (remove_comment)**
   - Delete completed or outdated comments
   - Keep task history clean and organized

### Use Cases

MCP tools are particularly suitable for the following scenarios:
- Managing development plans for large software projects
- Complex task sequences that need long-term tracking
- Projects that require remembering multiple steps and dependencies
- Scenarios where AI assistants need to understand and track project context

## API Documentation

After starting the backend server, you can access the API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
/
├── backend/                # Backend code
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── models/         # Data models
│   │   ├── services/       # Business logic
│   │   ├── agents/         # AI agents
│   │   ├── utils/          # Utility functions
│   │   ├── config.py       # Configuration
│   │   └── main.py         # Application entry
│   └── requirements.txt    # Dependencies
│
├── public/                 # Frontend static files
│   ├── css/                # Style files
│   ├── js/                 # JavaScript files
│   └── index.html          # Main HTML page
│
├── mcp/                    # MCP tools
│   ├── src/                # Source code
│   ├── dist/               # Compiled code
│   └── package.json        # Dependency configuration
│
├── .env                    # Environment variables
├── example.env             # Example environment configuration
│
└── server.py               # Frontend proxy server
```

## Usage Flow

1. Create a plan or automatically generate one from text
2. Add tasks to the plan
3. Set task dependencies and order
4. Update task status
5. Add comments and notes
6. Use the "Next Tasks" feature to see what to do next

## MCP Integration Examples

Through Cursor IDE, AI assistants can interact with Planner Tools as follows:

```
// Create a new plan
mcp_planner_tools_create_plan({
  name: "Website Development Project",
  text: "Task 1: Design Database Schema\nDesign user, content, and permission models.\n\nTask 2: Implement API Endpoints\nDevelop RESTful API endpoints.\nDepends on Task 1."
})

// Get all tasks in the current plan
mcp_planner_tools_get_current_plan_tasks({
  random_string: "check"
})

// Get tasks that should be executed next
mcp_planner_tools_get_next_tasks({
  random_string: "next"
})
```

## Developer

This project was developed by Dream of Yang.

## License

MIT 

---

# 计划管理系统

一个简单的计划和任务管理系统，帮助组织和跟踪项目进度。

## 功能特点

- 创建和管理计划
- 在计划内添加和管理任务
- 设置任务的依赖关系和顺序
- 更新任务状态和进度
- 为任务添加评论和笔记
- 从文本自动生成计划和任务
- 查看下一步待执行任务

## 技术栈

- 后端: FastAPI (Python)
- 前端: 原生JavaScript、HTML和CSS
- 数据存储: JSON文件
- MCP工具: TypeScript + Model Context Protocol (MCP)

## 安装和运行

### 前提条件

- Node.js 14+
- Python 3.8+
- 一个OpenAI API密钥（用于AI代理）

### 环境配置

1. 复制示例环境文件:

```bash
cp example.env .env
```

2. 编辑.env文件，设置您的环境变量:
   - 更新`MODEL_API_KEY`为您的OpenAI API密钥
   - 根据需要调整端口和其他设置

### 后端

1. 安装Python依赖:

```bash
cd backend
pip install -r requirements.txt
```

2. 启动后端服务器:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

后端API将在 http://localhost:8000/ 上运行。

### 前端

1. 启动前端代理服务器:

```bash
python server.py
```

前端应用将在 http://localhost:3000/ 上运行。

### MCP工具

1. 安装依赖:

```bash
cd mcp
npm install
```

2. 构建工具:

```bash
cd mcp
npm run build
```

3. 运行MCP服务:

```bash
cd mcp
API_BASE_URL=http://localhost:8000 node dist/planner_tools.js
```

MCP工具将在后台运行，通过Cursor IDE与AI助手交互。

## Planner Tools MCP功能

Planner Tools MCP集成了以下功能，专为Cursor IDE中的AI助手设计：

### 核心工具

1. **创建计划 (create_plan)**
   - 通过文本创建结构化计划
   - 自动解析任务描述和依赖关系
   - 自动设置为当前跟踪计划

2. **获取当前计划任务 (get_current_plan_tasks)**
   - 查看当前计划的所有任务
   - 包含详细信息，如状态、描述、依赖和评论

3. **获取下一步任务 (get_next_tasks)**
   - 智能分析并推荐应该执行的下一步任务
   - 基于任务状态和依赖关系进行排序

4. **添加评论 (add_comment)**
   - 为特定任务添加各类评论（注释、问题、建议、问题）
   - 帮助记录任务相关的想法和决策过程

5. **更新任务状态 (update_task_status)**
   - 更新任务的进度状态
   - 支持多种状态：待处理、进行中、待审核、已完成、需修复

6. **删除评论 (remove_comment)**
   - 删除已完成或过时的评论
   - 保持任务历史记录的整洁

### 使用场景

MCP工具特别适合以下场景：
- 大型软件项目的开发计划管理
- 需要长期跟踪的复杂任务序列
- 需要记住多个步骤和依赖关系的项目
- AI助手需要理解和跟踪项目上下文的场景

## API文档

启动后端服务器后，可以在以下地址访问API文档:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 项目结构

```
/
├── backend/                # 后端代码
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── models/         # 数据模型
│   │   ├── services/       # 业务逻辑
│   │   ├── agents/         # AI代理
│   │   ├── utils/          # 工具函数
│   │   ├── config.py       # 配置
│   │   └── main.py         # 应用入口
│   └── requirements.txt    # 依赖
│
├── public/                 # 前端静态文件
│   ├── css/                # 样式文件
│   ├── js/                 # JavaScript文件
│   └── index.html          # 主HTML页面
│
├── mcp/                    # MCP工具
│   ├── src/                # 源代码
│   ├── dist/               # 编译后的代码
│   └── package.json        # 依赖配置
│
├── .env                    # 环境变量配置
├── example.env             # 示例环境变量配置
│
└── server.py               # 前端代理服务器
```

## 使用流程

1. 创建计划或从文本自动生成计划
2. 在计划中添加任务
3. 设置任务的依赖关系和顺序
4. 更新任务状态
5. 添加评论和笔记
6. 使用"下一步任务"功能查看接下来要做的事项

## MCP集成使用示例

通过Cursor IDE，AI助手可以使用以下方式与Planner Tools交互：

```
// 创建新计划
mcp_planner_tools_create_plan({
  name: "网站开发项目",
  text: "任务1: 设计数据库架构\n设计用户、内容和权限模型。\n\n任务2: 实现API接口\n开发RESTful API endpoints。\n依赖于任务1。"
})

// 获取当前计划的所有任务
mcp_planner_tools_get_current_plan_tasks({
  random_string: "check"
})

// 获取下一步应该执行的任务
mcp_planner_tools_get_next_tasks({
  random_string: "next"
})
```

## 开发者

本项目由Dream of Yang开发。

## 许可

MIT

