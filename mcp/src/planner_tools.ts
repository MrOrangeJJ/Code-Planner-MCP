#!/usr/bin/env node
// @ts-nocheck
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// 加载环境变量
dotenv.config();

// 从环境变量中获取API基础URL
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// 定义参数接口
interface CreatePlanArgs {
  name: string;
  description?: string;
  text?: string;
}

interface CommentArgs {
  task_id: string;
  content: string;
  type?: string; // "Note", "Question", "Suggestion", "Issue", "Other"
}

interface UpdateTaskStatusArgs {
  task_id: string;
  status: string; // "Pending", "Working", "Pending For Review", "Complete", "Need Fixed"
}

interface RemoveCommentArgs {
  task_id: string;
  comment_id: string;
}

// 参数验证函数
function isValidCreatePlanArgs(args: unknown): args is CreatePlanArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "name" in args &&
    typeof (args as CreatePlanArgs).name === "string" &&
    (
      !("description" in args) || 
      typeof (args as CreatePlanArgs).description === "string"
    ) &&
    (
      !("text" in args) || 
      typeof (args as CreatePlanArgs).text === "string"
    )
  );
}

function isValidCommentArgs(args: unknown): args is CommentArgs {
  const validTypes = ["Note", "Question", "Suggestion", "Issue", "Other"];
  return (
    typeof args === "object" &&
    args !== null &&
    "task_id" in args &&
    typeof (args as CommentArgs).task_id === "string" &&
    "content" in args &&
    typeof (args as CommentArgs).content === "string" &&
    (
      !("type" in args) || 
      (typeof (args as CommentArgs).type === "string" &&
       validTypes.includes((args as CommentArgs).type))
    )
  );
}

function isValidUpdateTaskStatusArgs(args: unknown): args is UpdateTaskStatusArgs {
  const validStatuses = ["Pending", "Working", "Pending For Review", "Complete", "Need Fixed"];
  return (
    typeof args === "object" &&
    args !== null &&
    "task_id" in args &&
    typeof (args as UpdateTaskStatusArgs).task_id === "string" &&
    "status" in args &&
    typeof (args as UpdateTaskStatusArgs).status === "string" &&
    validStatuses.includes((args as UpdateTaskStatusArgs).status)
  );
}

function isValidRemoveCommentArgs(args: unknown): args is RemoveCommentArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "task_id" in args &&
    typeof (args as RemoveCommentArgs).task_id === "string" &&
    "comment_id" in args &&
    typeof (args as RemoveCommentArgs).comment_id === "string"
  );
}

// 获取当前计划ID的辅助函数
async function getCurrentPlanId(): Promise<string> {
  try {
    const response = await axios.get(`${API_BASE_URL}/plans/current`);
    if (response.data && response.data.id) {
      return response.data.id;
    }
    throw new Error("没有设置当前计划");
  } catch (error) {
    console.error("获取当前计划失败:", error);
    throw new Error("获取当前计划失败，请确保有一个计划被设置为当前计划");
  }
}

// MCP服务器类
class PlannerToolsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "planner-tools", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error: Error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: [
          {
            name: "create_plan",
            description: "Creates a new plan and automatically sets it as the currently tracked plan. This tool is used to initialize a new project development plan by directly providing a plan name and text content for the system to parse into a structured plan.\n\nWhen using this tool, you need to provide:\n- name: The plan name (required), briefly describing the overall goal of the plan\n- text: The plan text content (optional), which the system will parse to generate a structured task list\n\nBest practices for creating plans:\n- The plan name should clearly reflect the project objectives\n- If providing text, include clear task descriptions, dependencies, and expected outcomes\n- Text format should be structured to facilitate system recognition of task divisions\n\nThis tool returns the details of the created plan, including the automatically generated plan ID and initial task list (if created from text). The newly created plan is automatically set as the currently tracked plan.\n\nExample of a well-structured plan text:\n```\nTask 1: Design Database Schema\nCreate the required data models and relationships.\n\nTask 2: Implement API Endpoints\nDevelop the necessary API endpoints according to specifications.\nDepends on Task 1.\n\nTask 3: Create Frontend Components\nBuild user interface components for the application.\nDepends on Task 2.\n```",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The plan name, briefly describing the overall goal of the plan"
                },
                text: {
                  type: "string",
                  description: "The plan text content, which the system will parse to generate a structured task list"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "get_current_plan_tasks",
            description: "Retrieves all tasks from the currently tracked plan. This tool provides a complete view of all tasks in the active plan, helping you understand the entire project structure and progress.\n\nThe results are sorted by task order and include detailed information for each task:\n- Task ID and title\n- Detailed description\n- Current status (such as 'Pending', 'Working', etc.)\n- Dependencies\n- Estimated time\n- Comment list\n\nThis tool is particularly useful for:\n- Getting a complete task overview at the beginning of a project\n- Regularly checking project progress and structure\n- Finding dependencies between tasks\n- Understanding the entire project architecture and components before writing code\n\nThis tool doesn't require any input parameters as it automatically identifies the currently tracked plan. If no current plan is set, it will return an appropriate error message.",
            inputSchema: {
              type: "object",
              properties: {
                random_string: {
                  type: "string",
                  description: "Empty parameter placeholder, can provide any content, the parameter will not be used"
                }
              },
              required: ["random_string"]
            }
          },
          {
            name: "get_next_tasks",
            description: "Identifies and retrieves the next tasks that should be executed in the current plan. This tool analyzes the currently tracked plan and intelligently determines which tasks should be worked on next, based on task status, dependencies, and priority.\n\nThe tool helps prioritize work and progress through the plan in a logical order. Results include detailed information about each recommended task, including title, description, current status, and any relevant dependencies.\n\nBest times to use this tool:\n- After completing a task, to determine what to work on next\n- When planning a new work session or workday, to evaluate upcoming tasks\n- When you need to understand which tasks in the plan are ready for execution, still have dependencies, or are already in progress\n\nThis tool doesn't require any input parameters as it automatically identifies the currently tracked plan. If no current plan exists, it will return an error message.",
            inputSchema: {
              type: "object",
              properties: {
                random_string: {
                  type: "string",
                  description: "Empty parameter placeholder, can provide any content, the parameter will not be used"
                }
              },
              required: ["random_string"]
            }
          },
          {
            name: "add_comment",
            description: "Adds a comment to a specific task in the current plan. This tool is used to record thoughts, questions, suggestions, or additional information related to tasks, helping track progress and decision-making processes.\n\nComment types can be one of the following:\n- Note (default): Regular notes or information\n- Question: Questions that need answers\n- Suggestion: Improvement suggestions\n- Issue: Problems or obstacles\n- Other: Other types of comments\n\nWhen using this tool, you need to specify:\n- task_id: The ID of the target task (required)\n- content: The comment content (required)\n- type: The comment type (optional, defaults to 'Note')\n\nComments cannot be modified once added but can be deleted and re-added. Comments are displayed in chronological order with the most recent comments shown first. Adding meaningful comments helps team members understand task context and progress.",
            inputSchema: {
              type: "object",
              properties: {
                task_id: {
                  type: "string",
                  description: "The ID of the task to add a comment to"
                },
                content: {
                  type: "string",
                  description: "The content of the comment"
                },
                type: {
                  type: "string",
                  enum: ["Note", "Question", "Suggestion", "Issue", "Other"],
                  description: "The type of comment, defaults to 'Note'"
                }
              },
              required: ["task_id", "content"]
            }
          },
          {
            name: "update_task_status",
            description: "Updates the status of a specific task in the current plan. This tool allows you to track task progress from initial stages through completion.\n\nTask status can be one of the following:\n- Pending: Waiting to be started (initial status)\n- Working: Currently in progress\n- Pending For Review: Waiting for review\n- Complete: Finished\n- Need Fixed: Requires fixes\n\nWhen using this tool, you need to specify:\n- task_id: The ID of the target task (required)\n- status: The new task status (required)\n\nBest practices for status updates:\n- When starting to work on a task, update status from 'Pending' to 'Working'\n- When a task needs review by others, use 'Pending For Review'\n- Only set status to 'Complete' when the task is truly finished\n- Use 'Need Fixed' status when issues are discovered that require fixing\n\nThis tool returns the updated task details, including the new status. Status updates are critical for accurately tracking plan progress and identifying next steps.",
            inputSchema: {
              type: "object",
              properties: {
                task_id: {
                  type: "string",
                  description: "The ID of the task to update the status for"
                },
                status: {
                  type: "string",
                  enum: ["Pending", "Working", "Pending For Review", "Complete", "Need Fixed"],
                  description: "The new status for the task"
                }
              },
              required: ["task_id", "status"]
            }
          },
          {
            name: "remove_comment",
            description: "Removes a specific comment from a task in the current plan. This tool is useful for cleaning up completed action items, removing outdated notes, or deleting incorrect information.\n\nComments often contain temporary information such as implementation steps, review notes, or reminders that become irrelevant once addressed. Removing these comments helps maintain a clean, focused task history with only relevant current information.\n\nWhen using this tool, you need to specify:\n- task_id: The ID of the task containing the comment (required)\n- comment_id: The ID of the comment to remove (required)\n\nThis tool is particularly useful in these scenarios:\n- After completing action items mentioned in a comment\n- When information in a comment becomes outdated or irrelevant\n- To clean up task history for better readability\n- When a comment was added incorrectly or to the wrong task\n\nThe tool will return a success message if the comment was successfully removed, or an error message if the comment or task couldn't be found.",
            inputSchema: {
              type: "object",
              properties: {
                task_id: {
                  type: "string",
                  description: "The ID of the task containing the comment to remove"
                },
                comment_id: {
                  type: "string",
                  description: "The ID of the comment to remove"
                }
              },
              required: ["task_id", "comment_id"]
            }
          }
        ]
      })
    );

    // 处理工具调用
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        switch (request.params.name) {
          case "create_plan": {
            try {
              if (!isValidCreatePlanArgs(request.params.arguments)) {
                throw new McpError(
                  "无效的创建计划参数", 
                  ErrorCode.InvalidParams
                );
              }
              
              // 准备请求数据
              const planData = {
                name: request.params.arguments.name,
                text: request.params.arguments.text
              };
              
              // 发送API请求创建计划 - 使用正确的from-text API
              const response = await axios.post(`${API_BASE_URL}/plans/from-text`, planData);
              
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(response.data, null, 2)
                }]
              };
            } catch (error) {
              console.error("创建计划失败:", error);
              return {
                content: [{
                  type: "text",
                  text: `创建计划失败: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
              };
            }
          }
          
          case "get_current_plan_tasks": {
            try {
              // 获取当前计划中的所有任务列表
              const response = await axios.get(`${API_BASE_URL}/plans/current`);
              
              if (!response.data || !response.data.tasks || response.data.tasks.length === 0) {
                return {
                  content: [{
                    type: "text",
                    text: "没有找到当前计划中的任务，所有任务可能已完成或尚未创建任务。"
                  }]
                };
              }
              
              // 格式化为字符串，而不是直接返回JSON
              const formattedResponse = JSON.stringify(response.data.tasks, null, 2);
              
              return {
                content: [{
                  type: "text",
                  text: formattedResponse
                }]
              };
            } catch (error) {
              console.error("获取当前计划任务失败:", error);
              return {
                content: [{
                  type: "text",
                  text: `获取当前计划任务失败: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
              };
            }
          }
          
          case "get_next_tasks": {
            try {
              // 获取下一步任务
              const response = await axios.get(`${API_BASE_URL}/plans/next-tasks`);
              
              if (!response.data || response.data.length === 0) {
                return {
                  content: [{
                    type: "text",
                    text: "没有找到下一步任务，所有任务可能已完成或尚未创建任务。"
                  }]
                };
              }
              
              // 格式化为字符串，而不是直接返回JSON
              const formattedResponse = JSON.stringify(response.data, null, 2);
              
              return {
                content: [{
                  type: "text",
                  text: formattedResponse
                }]
              };
            } catch (error) {
              console.error("获取下一步任务失败:", error);
              return {
                content: [{
                  type: "text",
                  text: `获取下一步任务失败: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
              };
            }
          }
          
          case "add_comment": {
            try {
              if (!isValidCommentArgs(request.params.arguments)) {
                throw new McpError(
                  "无效的评论参数", 
                  ErrorCode.InvalidParams
                );
              }
              
              // 获取当前计划ID
              const planId = await getCurrentPlanId();
              const taskId = request.params.arguments.task_id;
              
              // 准备评论数据
              const commentData = {
                content: request.params.arguments.content,
                type: request.params.arguments.type || "Note"
              };
              
              // 发送API请求添加评论
              const response = await axios.post(
                `${API_BASE_URL}/plans/${planId}/tasks/${taskId}/comments`,
                commentData
              );
              
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(response.data, null, 2)
                }]
              };
            } catch (error) {
              console.error("添加评论失败:", error);
              return {
                content: [{
                  type: "text",
                  text: `添加评论失败: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
              };
            }
          }
          
          case "update_task_status": {
            try {
              if (!isValidUpdateTaskStatusArgs(request.params.arguments)) {
                throw new McpError(
                  "Invalid task status update parameters", 
                  ErrorCode.InvalidParams
                );
              }
              
              // 获取当前计划ID
              const planId = await getCurrentPlanId();
              const taskId = request.params.arguments.task_id;
              
              // 准备状态更新数据
              const statusData = {
                status: request.params.arguments.status
              };
              
              // 发送API请求更新任务状态
              const response = await axios.put(
                `${API_BASE_URL}/plans/${planId}/tasks/${taskId}/status`,
                statusData
              );
              
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(response.data, null, 2)
                }]
              };
            } catch (error) {
              console.error("Failed to update task status:", error);
              return {
                content: [{
                  type: "text",
                  text: `Failed to update task status: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
              };
            }
          }
          
          case "remove_comment": {
            try {
              if (!isValidRemoveCommentArgs(request.params.arguments)) {
                throw new McpError(
                  "Invalid comment removal parameters", 
                  ErrorCode.InvalidParams
                );
              }
              
              // 获取当前计划ID
              const planId = await getCurrentPlanId();
              const taskId = request.params.arguments.task_id;
              const commentId = request.params.arguments.comment_id;
              
              // 发送API请求删除评论
              const response = await axios.delete(
                `${API_BASE_URL}/plans/${planId}/tasks/${taskId}/comments/${commentId}`
              );
              
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(response.data, null, 2)
                }]
              };
            } catch (error) {
              console.error("Failed to remove comment:", error);
              return {
                content: [{
                  type: "text",
                  text: `Failed to remove comment: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
              };
            }
          }
          
          default:
            throw new McpError(
              `Unknown tool: ${request.params.name}`, 
              ErrorCode.InvalidParams
            );
        }
      }
    );
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// 启动服务器
const server = new PlannerToolsServer();
server.run().catch(error => {
  console.error("服务器启动失败:", error);
  process.exit(1);
}); 