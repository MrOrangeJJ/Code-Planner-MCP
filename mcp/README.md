# 计划管理MCP工具

该项目提供了一组MCP (Model Control Protocol) 工具，用于管理计划和任务。这些工具专为大型语言模型(LLM)设计，使模型能够与计划管理系统交互。

## 工具概述

该项目包含以下四个MCP工具：

1. **创建新任务工具 (create_task)**：
   - 在当前正在追踪的计划中创建新任务
   - 可指定任务标题、描述、顺序、依赖关系等

2. **查看下一步任务工具 (get_next_tasks)**：
   - 获取当前计划中应该执行的下一步任务
   - 基于任务状态、依赖关系和优先级进行智能排序

3. **添加评论工具 (add_comment)**：
   - 为当前计划中的特定任务添加评论
   - 可选择不同的评论类型：笔记、问题、建议等

4. **更新任务状态工具 (update_task_status)**：
   - 更新当前计划中特定任务的状态
   - 支持多种状态：待处理、进行中、待审核、已完成等

## 特点

- 所有工具都针对**当前正在追踪的计划**进行操作，无需指定计划ID
- 为LLM设计，提供清晰的指导和错误处理
- 工具描述和参数说明详细，易于理解和使用

## 安装与使用

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 运行

```bash
npm start
```

## 工具详细说明

### 1. 创建新任务工具 (create_task)

在当前计划中创建新任务。

**参数**：
- `title` (必填)：任务标题
- `description` (可选)：任务详细描述
- `order` (可选)：任务顺序
- `dependencies` (可选)：依赖任务ID列表
- `estimated_time` (可选)：预估完成时间

**返回**：创建的任务详情，包括ID和状态

### 2. 查看下一步任务工具 (get_next_tasks)

获取当前计划中下一步应该完成的任务列表。

**参数**：
- `random_string`：空参数占位符

**返回**：推荐执行的任务列表，包含详细信息

### 3. 添加评论工具 (add_comment)

为当前计划中的特定任务添加评论。

**参数**：
- `task_id` (必填)：目标任务ID
- `content` (必填)：评论内容
- `type` (可选)：评论类型，默认为"Note"

**返回**：添加的评论详情

### 4. 更新任务状态工具 (update_task_status)

更新当前计划中特定任务的状态。

**参数**：
- `task_id` (必填)：目标任务ID
- `status` (必填)：新的任务状态

**返回**：更新后的任务详情

## 注意事项

- 使用工具前确保已设置当前计划，否则工具将返回错误
- API基础URL默认为`http://localhost:8000`，可通过环境变量修改 